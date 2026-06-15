import { useEffect, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";

const KEY = "caltrack.v2";
const today = () => new Date().toISOString().slice(0, 10);
const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const r = v => Math.round((n(v) + Number.EPSILON) * 10) / 10;

const baseData = {
  profile: { dailyTarget: 1800, proteinTarget: 130, weight: 114.3, goalWeight: 95, usdaKey: "" },
  diary: {},
  weights: [],
  customFoods: []
};

function load() {
  try { return { ...baseData, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return baseData; }
}
function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
function sum(items) {
  return items.reduce((a, x) => ({ cal: a.cal + n(x.cal), protein: a.protein + n(x.protein), carbs: a.carbs + n(x.carbs), fat: a.fat + n(x.fat) }), { cal: 0, protein: 0, carbs: 0, fat: 0 });
}
function parseOCR(text) {
  const t = text.replace(/,/g, ".").replace(/\s+/g, " ").toLowerCase();
  const find = arr => { for (const p of arr) { const m = t.match(p); if (m) return r(m[1]); } return ""; };
  return {
    cal: find([/(?:calories|kcal|energy)[^0-9]{0,20}(\d+(?:\.\d+)?)/, /(\d+(?:\.\d+)?)\s*kcal/]),
    protein: find([/protein[^0-9]{0,16}(\d+(?:\.\d+)?)/]),
    carbs: find([/(?:carbohydrate|carbohydrates|carbs)[^0-9]{0,16}(\d+(?:\.\d+)?)/]),
    fat: find([/(?:total fat|fat)[^0-9]{0,16}(\d+(?:\.\d+)?)/]),
    grams: find([/(?:serving size|per serving|serving)[^0-9]{0,16}(\d+(?:\.\d+)?)/]) || 100
  };
}
function offFood(p) {
  const m = p.nutriments || {};
  const grams = Number(p.serving_quantity) || 100;
  const per100 = { cal: n(m["energy-kcal_100g"]), protein: n(m.proteins_100g), carbs: n(m.carbohydrates_100g), fat: n(m.fat_100g) };
  return { name: p.product_name || p.generic_name || p.brands || "Packaged food", source: "Open Food Facts", grams, cal: r(per100.cal * grams / 100), protein: r(per100.protein * grams / 100), carbs: r(per100.carbs * grams / 100), fat: r(per100.fat * grams / 100), ingredients: p.ingredients_text || "" };
}

export default function AppV2() {
  const [data, setData] = useState(load);
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState("today");
  const [q, setQ] = useState("");
  const [barcode, setBarcode] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [draft, setDraft] = useState({ name: "", grams: "100", cal: "", protein: "", carbs: "", fat: "" });
  const [weight, setWeight] = useState({ weight: data.profile.weight, waist: "" });

  useEffect(() => save(data), [data]);
  const items = data.diary[date] || [];
  const totals = useMemo(() => sum(items), [items]);
  const left = data.profile.dailyTarget - totals.cal;
  const weights = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = weights.at(-1)?.weight || data.profile.weight;
  const firstWeight = weights[0]?.weight || data.profile.weight;

  const setProfile = p => setData(d => ({ ...d, profile: { ...d.profile, ...p } }));
  const addFood = food => setData(d => ({ ...d, diary: { ...d.diary, [date]: [...(d.diary[date] || []), { ...food, id: id(), date }] } }));
  const removeFood = fid => setData(d => ({ ...d, diary: { ...d.diary, [date]: (d.diary[date] || []).filter(x => x.id !== fid) } }));

  async function searchOFF() {
    if (!q.trim()) return;
    setStatus("Searching free Open Food Facts...");
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12`;
      const res = await fetch(url);
      const js = await res.json();
      setResults((js.products || []).map(offFood).filter(x => x.cal));
      setStatus("");
    } catch { setStatus("Open Food Facts failed. Check internet."); }
  }
  async function lookupBarcode() {
    if (!barcode.trim()) return;
    setStatus("Looking up barcode in Open Food Facts...");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode.trim()}.json`);
      const js = await res.json();
      if (js.status !== 1) throw new Error();
      setResults([offFood(js.product)]);
      setStatus("");
    } catch { setStatus("Barcode not found. Use OCR scan or manual entry."); }
  }
  async function searchUSDA() {
    if (!data.profile.usdaKey) return setStatus("Add free USDA API key in Settings first.");
    setStatus("Searching USDA FoodData Central...");
    try {
      const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${data.profile.usdaKey}&query=${encodeURIComponent(q)}&pageSize=10`);
      const js = await res.json();
      const foods = (js.foods || []).map(f => {
        const get = word => f.foodNutrients?.find(x => x.nutrientName?.toLowerCase().includes(word))?.value || 0;
        return { name: f.description, source: "USDA", grams: 100, cal: r(get("energy")), protein: r(get("protein")), carbs: r(get("carbohydrate")), fat: r(get("total lipid")) };
      }).filter(x => x.cal);
      setResults(foods); setStatus("");
    } catch { setStatus("USDA failed. Check key or internet."); }
  }
  async function scanLabel(file) {
    if (!file) return;
    setStatus("Reading label locally with Tesseract OCR...");
    try {
      const worker = await createWorker("eng");
      const out = await worker.recognize(file);
      await worker.terminate();
      const text = out.data.text;
      const parsed = parseOCR(text);
      setOcrText(text);
      setDraft(d => ({ ...d, ...parsed, name: d.name || "Scanned package" }));
      setStatus("OCR done. Verify numbers before saving.");
    } catch { setStatus("OCR failed. Try a clearer close-up label photo."); }
  }
  function saveManual() {
    const food = { name: draft.name || "Custom food", source: "Manual/OCR verified", grams: n(draft.grams) || 100, cal: r(draft.cal), protein: r(draft.protein), carbs: r(draft.carbs), fat: r(draft.fat) };
    setData(d => ({ ...d, customFoods: [food, ...d.customFoods] }));
    addFood(food);
  }
  function saveWeight() {
    const entry = { id: id(), date, weight: r(weight.weight), waist: r(weight.waist) || "" };
    setData(d => ({ ...d, weights: [...d.weights.filter(x => x.date !== date), entry], profile: { ...d.profile, weight: entry.weight } }));
  }

  return <div className="app">
    <header className="hero"><div><p>CalTrack V2</p><h1>{Math.round(totals.cal)} / {data.profile.dailyTarget} cal</h1><span className={left >= 0 ? "good" : "bad"}>{Math.abs(Math.round(left))} cal {left >= 0 ? "left" : "over"}</span></div><b>{Math.min(100, Math.round(totals.cal / data.profile.dailyTarget * 100))}%</b></header>
    <section className="cards"><div><b>{r(totals.protein)}g</b><small>protein</small></div><div><b>{r(totals.carbs)}g</b><small>carbs</small></div><div><b>{r(totals.fat)}g</b><small>fat</small></div></section>
    <nav>{["today", "search", "scan", "progress", "settings"].map(t => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</nav>
    {status && <p className="notice">{status}</p>}
    {tab === "today" && <main><div className="row"><h2>Diary</h2><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>{items.length === 0 && <p className="empty">No food logged.</p>}{items.map(x => <div className="food" key={x.id}><div><b>{x.name}</b><small>{x.source} · {x.grams || 100}g</small></div><b>{x.cal} cal</b><button onClick={() => removeFood(x.id)}>×</button></div>)}</main>}
    {tab === "search" && <main><h2>Real food search</h2><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search food..." /><div className="row"><button onClick={searchOFF}>Open Food Facts</button><button onClick={searchUSDA}>USDA</button></div><div className="row"><input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Barcode number" /><button onClick={lookupBarcode}>Lookup</button></div>{results.map((x, i) => <div className="food" key={i}><div><b>{x.name}</b><small>{x.source} · P{x.protein} C{x.carbs} F{x.fat}</small></div><b>{x.cal} cal</b><button onClick={() => addFood(x)}>Add</button></div>)}</main>}
    {tab === "scan" && <main><h2>Nutrition label scanner</h2><p className="hint">Real OCR runs locally in browser. Always verify label values.</p><input type="file" accept="image/*" onChange={e => scanLabel(e.target.files?.[0])} /><div className="grid"><input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /><input placeholder="grams" value={draft.grams} onChange={e => setDraft({ ...draft, grams: e.target.value })} /><input placeholder="calories" value={draft.cal} onChange={e => setDraft({ ...draft, cal: e.target.value })} /><input placeholder="protein" value={draft.protein} onChange={e => setDraft({ ...draft, protein: e.target.value })} /><input placeholder="carbs" value={draft.carbs} onChange={e => setDraft({ ...draft, carbs: e.target.value })} /><input placeholder="fat" value={draft.fat} onChange={e => setDraft({ ...draft, fat: e.target.value })} /></div><button onClick={saveManual}>Save & add</button>{ocrText && <details><summary>Raw OCR text</summary><pre>{ocrText}</pre></details>}</main>}
    {tab === "progress" && <main><h2>Progress</h2><section className="cards"><div><b>{latestWeight}</b><small>kg now</small></div><div><b>{r(firstWeight - latestWeight)}</b><small>kg lost</small></div><div><b>{data.profile.goalWeight}</b><small>goal</small></div></section><div className="grid"><input value={weight.weight} onChange={e => setWeight({ ...weight, weight: e.target.value })} placeholder="Weight kg" /><input value={weight.waist} onChange={e => setWeight({ ...weight, waist: e.target.value })} placeholder="Waist cm" /></div><button onClick={saveWeight}>Save progress</button>{weights.slice(-10).map(w => <p className="line" key={w.id}>{w.date}: {w.weight}kg {w.waist && `· waist ${w.waist}cm`}</p>)}</main>}
    {tab === "settings" && <main><h2>Settings</h2><div className="grid"><input value={data.profile.dailyTarget} onChange={e => setProfile({ dailyTarget: n(e.target.value) })} placeholder="Daily target" /><input value={data.profile.proteinTarget} onChange={e => setProfile({ proteinTarget: n(e.target.value) })} placeholder="Protein target" /><input value={data.profile.goalWeight} onChange={e => setProfile({ goalWeight: n(e.target.value) })} placeholder="Goal weight" /><input value={data.profile.usdaKey} onChange={e => setProfile({ usdaKey: e.target.value })} placeholder="USDA API key" /></div><p className="hint">Plate-photo AI is not added because free reliable hosted vision is not available. Label OCR + Open Food Facts are real.</p></main>}
  </div>;
}
