const MAX_TEXT_LENGTH = 4000;
const MAX_IMAGE_LENGTH = 5_000_000;
const ALLOWED_MODES = new Set(["daily-review", "nutrition-label", "ingredients", "restaurant", "portion", "recipe", "meal-photo"]);

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

function validText(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

const ALLOWED_ORIGINS = new Set([
  "https://caltrack-orpin.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: "Forbidden." });
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "GEMINI_API_KEY is not configured on the server." });
  }

  const input = req.body || {};
  if (!ALLOWED_MODES.has(input.mode)) {
    return res.status(400).json({ error: "Invalid analysis mode." });
  }
  if (input.text && typeof input.text !== "string") {
    return res.status(400).json({ error: "Invalid text." });
  }
  if (input.text && input.text.length > MAX_TEXT_LENGTH) {
    return res.status(413).json({ error: "Text is too long." });
  }
  if (input.image && (!validText(input.image, MAX_IMAGE_LENGTH) || !input.image.startsWith("data:image/"))) {
    return res.status(400).json({ error: "Invalid image." });
  }

  const instruction = `You are a cautious nutrition estimation helper. Mode: ${input.mode}. Never claim certainty. Return concise plain text with: confidence level (low/medium/high), findings, warnings for hidden sugar/sodium/ultra-processing when relevant, nutrition or portion estimates as ranges, and what the user must verify. Restaurant or meal-photo analysis must start with "Estimate only". Recipe mode may suggest breakfast, lunch, dinner, snacks, smoothies, or salads from pantry ingredients, but must say database calculation is required before logging. Do not create automatic meal plans and do not claim to save data. Context: ${String(input.text || "").slice(0, 4000)}. Daily data: ${JSON.stringify(input.daily || {}).slice(0, 3000)}. Pantry: ${JSON.stringify(input.pantry || []).slice(0, 5000)}. Saved recipes: ${JSON.stringify(input.recipes || []).slice(0, 2000)}`;
  const parts = [{ text: instruction }];

  if (input.image) {
    const [, mimeType, data] = input.image.match(/^data:(image\/[^;]+);base64,(.+)$/) || [];
    if (data) parts.push({ inline_data: { mime_type: mimeType, data } });
  }

  try {
    const apiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 900 } }),
      },
    );
    const payload = await apiResponse.json();
    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({ error: payload.error?.message || "Gemini request failed." });
    }
    const analysis = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n") || "No analysis returned.";
    const confidence = analysis.match(/confidence(?: level)?:?\s*(low|medium|high)/i)?.[1]?.toLowerCase() || "unknown";
    return res.status(200).json({ analysis, confidence });
  } catch {
    return res.status(502).json({ error: "Gemini request failed." });
  }
};
