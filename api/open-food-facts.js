const MAX_QUERY_LENGTH = 200;

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

function validText(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function normalizeSearchHits(payload, query) {
  if (Array.isArray(payload.products)) return payload;
  const products = (payload.hits || []).map((hit) => ({
    code: hit.code,
    product_name: hit.product_name || hit.product_name_en || hit.generic_name || query,
    generic_name: hit.generic_name || "",
    brands: Array.isArray(hit.brands) ? hit.brands.join(", ") : hit.brands || "",
    serving_quantity: hit.serving_quantity,
    ingredients_text: hit.ingredients_text || hit.ingredients_text_en || "",
    nutriments: hit.nutriments || {},
  }));
  return { products };
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("Open Food Facts returned a temporary non-JSON response.");
  return response.json();
}

async function searchPrimary(params) {
  const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CalTrack/2.0 (personal calorie tracker)",
    },
  });
  if (!response.ok) throw new Error("Open Food Facts search failed.");
  return readJson(response);
}

async function searchFallback(query, pageSize) {
  const params = new URLSearchParams({
    q: query,
    page_size: String(pageSize),
  });
  const response = await fetch(`https://search.openfoodfacts.org/search?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CalTrack/2.0 (personal calorie tracker)",
    },
  });
  if (!response.ok) throw new Error("Open Food Facts search failed.");
  return readJson(response);
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const input = req.body || {};
  if (!validText(input.query, MAX_QUERY_LENGTH)) {
    return res.status(400).json({ error: "Enter a food name." });
  }

  const query = input.query.trim();
  const pageSize = Math.min(25, Math.max(1, Number(input.pageSize) || 20));
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(pageSize),
    sort_by: "unique_scans_n",
    fields: "code,product_name,generic_name,brands,serving_quantity,ingredients_text,nutriments",
  });

  try {
    const payload = await searchPrimary(params).catch(() => searchFallback(query, pageSize));
    return res.status(200).json(normalizeSearchHits(payload, query));
  } catch {
    return res.status(502).json({ error: "Food search is unavailable right now. Try again in a moment." });
  }
};
