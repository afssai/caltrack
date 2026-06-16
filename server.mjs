import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const port = Number(process.env.PORT) || 4173;
const maxBody = 2_100_000;
const requests = new Map();
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

function headers(type = "application/json") {
  return {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(self)",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' blob: https://fr.openfoodfacts.org https://world.openfoodfacts.org https://cdn.jsdelivr.net; script-src 'self' blob: https://cdn.jsdelivr.net 'wasm-unsafe-eval'; worker-src 'self' blob:; child-src 'self' blob:",
  };
}

function send(response, status, payload) {
  response.writeHead(status, headers());
  response.end(JSON.stringify(payload));
}

function limited(ip) {
  const now = Date.now();
  const entry = requests.get(ip) || { start: now, count: 0 };
  if (now - entry.start > 60_000) Object.assign(entry, { start: now, count: 0 });
  entry.count += 1;
  requests.set(ip, entry);
  return entry.count > 45;
}

async function body(request) {
  let value = "";
  for await (const chunk of request) {
    value += chunk;
    if (Buffer.byteLength(value) > maxBody) throw new Error("Request is too large.");
  }
  return JSON.parse(value || "{}");
}

function validText(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

async function usda(request, response) {
  if (!process.env.USDA_API_KEY) return send(response, 503, { error: "USDA_API_KEY is not configured on the server." });
  const input = await body(request);
  if (!validText(input.query, 200)) return send(response, 400, { error: "Enter a valid search query." });
  const apiResponse = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(process.env.USDA_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: input.query.trim(), pageSize: Math.min(25, Math.max(1, Number(input.pageSize) || 20)) }),
  });
  const payload = await apiResponse.json();
  send(response, apiResponse.status, payload);
}

async function ai(request, response) {
  if (!process.env.GEMINI_API_KEY) return send(response, 503, { error: "GEMINI_API_KEY is not configured on the server." });
  const input = await body(request);
  const allowed = ["daily-review", "nutrition-label", "ingredients", "restaurant", "portion", "recipe", "meal-photo"];
  if (!allowed.includes(input.mode)) return send(response, 400, { error: "Invalid analysis mode." });
  if (input.text && typeof input.text !== "string") return send(response, 400, { error: "Invalid text." });
  if (input.image && (!validText(input.image, 2_050_000) || !input.image.startsWith("data:image/"))) return send(response, 400, { error: "Invalid image." });
  const instruction = `You are a cautious nutrition estimation helper. Mode: ${input.mode}. Never claim certainty. Return concise plain text with: confidence level (low/medium/high), findings, warnings for hidden sugar/sodium/ultra-processing when relevant, nutrition or portion estimates as ranges, and what the user must verify. Restaurant or meal-photo analysis must start with "Estimate only". Recipe mode may suggest breakfast, lunch, dinner, snacks, smoothies, or salads from pantry ingredients, but must say database calculation is required before logging. Do not create automatic meal plans and do not claim to save data. Context: ${String(input.text || "").slice(0, 4000)}. Daily data: ${JSON.stringify(input.daily || {}).slice(0, 3000)}. Pantry: ${JSON.stringify(input.pantry || []).slice(0, 5000)}. Saved recipes: ${JSON.stringify(input.recipes || []).slice(0, 2000)}`;
  const parts = [{ text: instruction }];
  if (input.image) {
    const [, mimeType, data] = input.image.match(/^data:(image\/[^;]+);base64,(.+)$/) || [];
    if (data) parts.push({ inline_data: { mime_type: mimeType, data } });
  }
  const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 900 } }),
  });
  const payload = await apiResponse.json();
  if (!apiResponse.ok) return send(response, apiResponse.status, { error: payload.error?.message || "Gemini request failed." });
  const analysis = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n") || "No analysis returned.";
  const confidence = analysis.match(/confidence(?: level)?:?\s*(low|medium|high)/i)?.[1]?.toLowerCase() || "unknown";
  send(response, 200, { analysis, confidence });
}

async function staticFile(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  let path = join(root, clean || "index.html");
  try {
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
  } catch {
    path = join(root, "index.html");
  }
  const content = await readFile(path);
  response.writeHead(200, headers(mime[extname(path)] || "application/octet-stream"));
  response.end(content);
}

createServer(async (request, response) => {
  try {
    if (limited(request.socket.remoteAddress || "unknown")) return send(response, 429, { error: "Too many requests. Try again shortly." });
    if (request.method === "POST" && request.url === "/api/usda") return await usda(request, response);
    if (request.method === "POST" && request.url === "/api/gemini") return await ai(request, response);
    if (request.method === "GET" || request.method === "HEAD") return await staticFile(request, response);
    send(response, 405, { error: "Method not allowed." });
  } catch (error) {
    send(response, error.message === "Request is too large." ? 413 : 500, { error: error.message || "Server error." });
  }
}).listen(port, "0.0.0.0", () => console.log(`CalTrack preview: http://localhost:${port}`));
