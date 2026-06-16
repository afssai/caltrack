const MAX_QUERY_LENGTH = 200;

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

function validText(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.USDA_API_KEY) {
    return res.status(503).json({ error: "USDA_API_KEY is not configured on the server." });
  }

  const input = req.body || {};
  if (!validText(input.query, MAX_QUERY_LENGTH)) {
    return res.status(400).json({ error: "Enter a valid search query." });
  }

  try {
    const apiResponse = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(process.env.USDA_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input.query.trim(),
          pageSize: Math.min(25, Math.max(1, Number(input.pageSize) || 20)),
        }),
      },
    );
    const payload = await apiResponse.json();
    return res.status(apiResponse.status).json(payload);
  } catch {
    return res.status(502).json({ error: "USDA request failed." });
  }
};
