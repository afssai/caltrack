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

  const modeInstructions = {
    "meal-photo": `You are a nutrition estimator. The user has sent a food photo${input.text ? ` and described it as: "${input.text}"` : ""}. Identify every food and drink visible. For each item estimate: name, portion size in grams, calories, protein (g), carbs (g), fat (g), fiber (g). Then give a TOTAL line. Format:\n- [food name]: ~[grams]g — [cal]kcal, P[g]g, C[g]g, F[g]g\nTOTAL: ~[cal]kcal, P[g]g, C[g]g, F[g]g\nConfidence: low/medium/high\nNote anything hidden (sauces, oils, dressings). Start response with "Estimate only —".`,
    "portion": `You are a nutrition estimator. The user described: "${input.text}". Identify the foods, estimate portions and give per-item and total nutrition (calories, protein, carbs, fat, fiber). Format:\n- [food]: ~[cal]kcal, P[g]g, C[g]g, F[g]g\nTOTAL: ~[cal]kcal, P[g]g, C[g]g, F[g]g\nConfidence: low/medium/high`,
    "nutrition-label": `Extract nutrition facts from this label photo. Return: serving size (g), calories, protein (g), carbs (g), fat (g), fiber (g). If unclear say so.`,
    "ingredients": `Estimate nutrition for these ingredients: ${input.text}. Give per-ingredient and total (calories, protein, carbs, fat, fiber).`,
    "restaurant": `Estimate nutrition for this restaurant meal: ${input.text}. Give total calories, protein, carbs, fat, fiber. Note hidden oils/sauces. Start with "Estimate only —".`,
    "recipe": `Suggest a recipe using these pantry items: ${JSON.stringify(input.pantry || []).slice(0, 3000)}. Give ingredients, steps, and estimated total nutrition (calories, protein, carbs, fat, fiber). State values are estimates.`,
    "daily-review": `Review this daily food log: ${JSON.stringify(input.daily || {}).slice(0, 3000)}. Comment on balance, missing nutrients, and one actionable suggestion. Keep it under 100 words.`,
  };
  const instruction = modeInstructions[input.mode] || `Nutrition analysis mode: ${input.mode}. Context: ${String(input.text || "").slice(0, 4000)}.`;
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
