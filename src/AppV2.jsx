import React, { useEffect, useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import {
  cacheFoodResult,
  checkSupabaseConnection,
  enableCloudSync,
  getCurrentSession,
  optimizeImage,
  pullRemoteData,
  readSyncStatus,
  searchFoodCache,
  sendMagicLink,
  signOut,
  subscribeToAuthChanges,
  supabaseConfig,
  syncCalTrack,
} from "./supabaseSync";
import { STARTER_FOODS } from "./starterFoods";

const STORAGE_KEY = "caltrack.v2";
const SECURITY_KEY = "caltrack.v2.security";
const MAX_IMAGE_BYTES = 1_500_000;
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const EMPTY_NUTRITION = { calories: "", protein: "", carbs: "", fat: "", fiber: "" };
const CONFIDENCE = {
  off: ["Barcode + Database", "confidence-green"],
  usda: ["USDA", "confidence-green"],
  manual: ["Manual Entry", "confidence-yellow"],
  ocr: ["OCR suggestion", "confidence-orange"],
  ai: ["AI Estimate", "confidence-blue"],
};
const API = {
  openFoodFacts: "/api/open-food-facts",
  usda: "/api/usda",
};

const defaultData = {
  version: 2,
  profile: {
    calorieTarget: 2000,
    proteinTarget: 130,
    carbsTarget: 220,
    fatTarget: 65,
    fiberTarget: 30,
    waterTarget: 2500,
    goalWeight: "",
    sessionTimeout: 15,
  },
  diary: {},
  measurements: [],
  customFoods: [],
  dailyLogs: {},
  progressPhotos: [],
  pantry: [],
  recipes: [],
};

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const round = (value) => Math.round((number(value) + Number.EPSILON) * 10) / 10;
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const shortDay = (date) => new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(new Date(`${date}T12:00:00`));
const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function hashPin(pin, saltBase64) {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, key, 256);
  return { salt: bytesToBase64(salt), hash: bytesToBase64(new Uint8Array(hash)) };
}

function readSecurity() {
  try { return JSON.parse(localStorage.getItem(SECURITY_KEY)); } catch { return null; }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return defaultData;
    const savedProfile = saved.profile || {};
    const diary = Object.fromEntries(
      Object.entries(saved.diary || {}).map(([date, entries]) => [
        date,
        (entries || []).map((entry) => ({
          meal: "Snack",
          ...entry,
          calories: number(entry.calories ?? entry.cal),
        })),
      ]),
    );
    return {
      ...defaultData,
      ...saved,
      profile: {
        ...defaultData.profile,
        ...savedProfile,
        calorieTarget: number(savedProfile.calorieTarget ?? savedProfile.dailyTarget) || defaultData.profile.calorieTarget,
      },
      diary,
      measurements: saved.measurements || saved.weights || [],
      customFoods: saved.customFoods || [],
      dailyLogs: saved.dailyLogs || {},
      progressPhotos: saved.progressPhotos || [],
      pantry: saved.pantry || [],
      recipes: saved.recipes || [],
    };
  } catch {
    return defaultData;
  }
}

function totalsFor(items = []) {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + number(item.calories ?? item.cal),
      protein: totals.protein + number(item.protein),
      carbs: totals.carbs + number(item.carbs),
      fat: totals.fat + number(item.fat),
      fiber: totals.fiber + number(item.fiber),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

function scaleNutrition(per100, grams) {
  const factor = number(grams) / 100;
  return {
    calories: round(number(per100.calories) * factor),
    protein: round(number(per100.protein) * factor),
    carbs: round(number(per100.carbs) * factor),
    fat: round(number(per100.fat) * factor),
    fiber: round(number(per100.fiber) * factor),
  };
}

function parseNutritionLabel(text) {
  const normalized = text.replace(/,/g, ".").replace(/\s+/g, " ").toLowerCase();
  const find = (patterns, max = 1000) => {
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const value = round(match[1]);
        if (value > 0 && value <= max) return value;
      }
    }
    return "";
  };

  return {
    calories: find([
      /(\d+(?:\.\d+)?)\s*kcal/,
      /(?:calories)[^0-9]{0,24}(\d+(?:\.\d+)?)/,
      /(?:energy)[^0-9]{0,24}(\d+(?:\.\d+)?)\s*(?:kcal|cal)/,
    ]),
    protein: find([/protein[^0-9]{0,18}(\d+(?:\.\d+)?)\s*g/], 250),
    carbs: find([/(?:total carbohydrate|carbohydrate|carbs)[^0-9]{0,18}(\d+(?:\.\d+)?)\s*g/], 500),
    fat: find([/(?:total fat|fat)[^0-9]{0,18}(\d+(?:\.\d+)?)\s*g/], 250),
    fiber: find([/(?:dietary fiber|fibre|fiber)[^0-9]{0,18}(\d+(?:\.\d+)?)\s*g/], 250),
    servingGrams:
      find([/(?:serving size|per serving)[^0-9]{0,22}(\d+(?:\.\d+)?)\s*g/], 5000) || 100,
  };
}

function openFoodFactsFood(product) {
  const nutrients = product.nutriments || {};
  return {
    id: product.code || makeId(),
    name: product.product_name || product.generic_name || product.brands || "Unnamed packaged food",
    brand: product.brands || "",
    source: "Open Food Facts",
    confidence: "off",
    sourceId: product.code || "",
    ingredients: product.ingredients_text || "",
    servingGrams: number(product.serving_quantity) || 100,
    per100: {
      calories: number(nutrients["energy-kcal_100g"]),
      protein: number(nutrients.proteins_100g),
      carbs: number(nutrients.carbohydrates_100g),
      fat: number(nutrients.fat_100g),
      fiber: number(nutrients.fiber_100g),
    },
  };
}

function usdaFood(food) {
  const nutrients = food.foodNutrients || [];
  const find = ({ ids = [], names = [], unit }) => {
    const nutrient = nutrients.find((item) => {
      const nutrientId = Number(item.nutrientId);
      const name = String(item.nutrientName || "").toLowerCase();
      const unitMatches = !unit || String(item.unitName || "").toLowerCase() === unit;
      return unitMatches && (ids.includes(nutrientId) || names.some((candidate) => name === candidate));
    });
    return number(nutrient?.value);
  };

  return {
    id: String(food.fdcId),
    name: food.description || "USDA food",
    brand: food.brandOwner || food.brandName || "",
    source: "USDA FoodData Central",
    confidence: "usda",
    sourceId: String(food.fdcId),
    servingGrams: 100,
    per100: {
      calories: find({ ids: [1008], names: ["energy"], unit: "kcal" }),
      protein: find({ ids: [1003], names: ["protein"] }),
      carbs: find({ ids: [1005], names: ["carbohydrate, by difference"] }),
      fat: find({ ids: [1004], names: ["total lipid (fat)"] }),
      fiber: find({ ids: [1079], names: ["fiber, total dietary"] }),
    },
  };
}

function foodKey(food) {
  return `${food.source || ""}:${food.sourceId || food.id || food.name}`.toLowerCase();
}

function mergeFoods(...groups) {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const food of group || []) {
      const key = foodKey(food);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(food);
    }
  }
  return merged;
}

function searchSavedFoods(foods, query) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return (foods || []).filter((food) =>
    [food.name, food.brand, food.source, food.ingredients].filter(Boolean).join(" ").toLowerCase().includes(term),
  );
}

function searchStarterFoods(query) {
  return searchSavedFoods(STARTER_FOODS, query);
}

function parseAiNutrition(text) {
  const normalized = text.toLowerCase();
  const extractRange = (pattern) => {
    const match = normalized.match(pattern);
    if (!match) return "";
    const low = Number(match[1]);
    const high = Number(match[2] || match[1]);
    if (!low || low <= 0) return "";
    return Math.round((low + high) / 2);
  };
  const firstSentence = text.split(/[.\n]/)[0].replace(/estimate only[.:]*\s*/i, "").trim();
  const name = firstSentence.length > 3 && firstSentence.length < 80 ? firstSentence : "AI food photo estimate";
  return {
    name,
    calories: extractRange(/calori(?:es)?[^0-9]{0,30}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    protein: extractRange(/protein[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    carbs: extractRange(/carb(?:ohydrate)?s?[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    fat: extractRange(/(?:total )?fat[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    fiber: extractRange(/fi(?:bre|ber)[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
  };
}

function foodAlreadySaved(foods, food) {
  const sourceKey = food.sourceId || food.id;
  return (foods || []).some((saved) => {
    if (sourceKey && (saved.sourceId === sourceKey || saved.id === sourceKey)) return true;
    return saved.name.toLowerCase() === food.name.toLowerCase() && (saved.brand || "").toLowerCase() === (food.brand || "").toLowerCase();
  });
}

function rememberedFood(food) {
  return {
    id: makeId(),
    name: food.name,
    brand: food.brand || "",
    source: food.source || "Saved food",
    sourceId: food.sourceId || food.id || "",
    confidence: food.confidence || "manual",
    servingGrams: number(food.servingGrams) || 100,
    ingredients: food.ingredients || "",
    per100: food.per100,
  };
}

function mergeById(localRows = [], remoteRows = []) {
  const merged = new Map();
  for (const row of localRows) merged.set(row.id, row);
  for (const row of remoteRows) merged.set(row.id, { ...(merged.get(row.id) || {}), ...row });
  return [...merged.values()];
}

function mergeDiary(localDiary = {}, remoteDiary = {}) {
  const dates = new Set([...Object.keys(localDiary), ...Object.keys(remoteDiary)]);
  const diary = {};
  for (const entryDate of dates) diary[entryDate] = mergeById(localDiary[entryDate] || [], remoteDiary[entryDate] || []);
  return diary;
}

function mergeAccountData(localData, remoteData) {
  return {
    ...localData,
    ...remoteData,
    profile: { ...localData.profile, ...(remoteData.profile || {}) },
    diary: mergeDiary(localData.diary, remoteData.diary),
    dailyLogs: { ...(localData.dailyLogs || {}), ...(remoteData.dailyLogs || {}) },
    measurements: mergeById(localData.measurements || [], remoteData.measurements || []),
    customFoods: mergeById(localData.customFoods || [], remoteData.customFoods || []),
    pantry: mergeById(localData.pantry || [], remoteData.pantry || []),
    recipes: mergeById(localData.recipes || [], remoteData.recipes || []),
    progressPhotos: mergeById(localData.progressPhotos || [], remoteData.progressPhotos || []),
  };
}

function Field({ label, suffix, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input {...props} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function Macro({ label, value, target, tone }) {
  const percent = target ? Math.min(100, (number(value) / number(target)) * 100) : 0;
  return (
    <div className="macro">
      <div className="macro-top">
        <strong>{round(value)}g</strong>
        <span>{label}</span>
      </div>
      <div className="mini-track">
        <i className={tone} style={{ width: `${percent}%` }} />
      </div>
      <small>{target ? `${round(target)}g goal` : "No goal set"}</small>
    </div>
  );
}

function ConfidenceBadge({ value = "manual" }) {
  const [label, className] = CONFIDENCE[value] || CONFIDENCE.manual;
  return <span className={`confidence ${className}`}>{label}</span>;
}

function LockScreen({ mode, onUnlock, onSetup }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) return setError("Use a 4-8 digit PIN.");
    if (mode === "setup" && pin !== confirm) return setError("PIN confirmation does not match.");
    const ok = mode === "setup" ? await onSetup(pin) : await onUnlock(pin);
    if (!ok) setError("Incorrect PIN.");
  };
  return (
    <div className="lock-shell">
      <form className="lock-card" onSubmit={submit}>
        <span className="brand-mark">CalTrack</span>
        <h1>{mode === "setup" ? "Create your PIN" : "Welcome back"}</h1>
        <p>{mode === "setup" ? "This PIN locks CalTrack on this browser. It is not a substitute for device encryption." : "Enter your PIN to unlock your local health log."}</p>
        <Field label="PIN" type="password" inputMode="numeric" autoComplete="off" maxLength="8" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} />
        {mode === "setup" && <Field label="Confirm PIN" type="password" inputMode="numeric" autoComplete="off" maxLength="8" value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ""))} />}
        {error && <div className="form-error">{error}</div>}
        <button className="primary" type="submit">{mode === "setup" ? "Create PIN" : "Unlock"}</button>
      </form>
    </div>
  );
}

function CalorieChart({ diary, target, metric = "calories", label = "Seven day calorie history" }) {
  const days = Array.from({ length: 7 }, (_, index) => dateOffset(index - 6));
  const values = days.map((day) => totalsFor(diary[day])[metric]);
  const ceiling = Math.max(number(target), ...values, 1);

  return (
    <div className="bar-chart" aria-label={label}>
      {days.map((day, index) => {
        const value = values[index];
        return (
          <div className="bar-column" key={day}>
            <div className="bar-value">{value ? Math.round(value) : ""}</div>
            <div className="bar-rail">
              <i className={value > target ? "over" : ""} style={{ height: `${Math.max(value ? 8 : 2, (value / ceiling) * 100)}%` }} />
            </div>
            <span className={day === localDate() ? "today-label" : ""}>{shortDay(day)}</span>
          </div>
        );
      })}
    </div>
  );
}

function WeightTrend({ measurements }) {
  const points = [...measurements]
    .filter((item) => number(item.weight) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);

  if (points.length < 2) {
    return <div className="chart-empty"><strong>Build your trend</strong><span>Log weight on two dates to see movement.</span></div>;
  }

  const weights = points.map((item) => number(item.weight));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(1, max - min);
  const coordinates = points.map((item, index) => ({
    x: 8 + (index / (points.length - 1)) * 84,
    y: 78 - ((number(item.weight) - min) / range) * 60,
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const change = round(weights.at(-1) - weights[0]);

  return (
    <div className="weight-chart">
      <div className="trend-summary">
        <span>Last {points.length} entries</span>
        <strong className={change <= 0 ? "positive" : "negative"}>{change > 0 ? "+" : ""}{change} kg</strong>
      </div>
      <svg viewBox="0 0 100 90" role="img" aria-label={`Weight changed by ${change} kilograms`}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8d68ff" stopOpacity=".28" />
            <stop offset="100%" stopColor="#8d68ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`8,84 ${line} 92,84`} fill="url(#trendFill)" />
        <polyline points={line} fill="none" stroke="#9a7bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point, index) => <circle key={points[index].id} cx={point.x} cy={point.y} r="2.6" fill="#0a090d" stroke="#c4b2ff" strokeWidth="1.5" />)}
      </svg>
      <div className="chart-axis"><span>{points[0].date.slice(5)}</span><span>{points.at(-1).date.slice(5)}</span></div>
    </div>
  );
}

function MeasurementTrend({ measurements, metric = "weight", unit = "kg", empty = "Log two entries to see movement." }) {
  const points = [...measurements]
    .filter((item) => number(item[metric]) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);
  if (points.length < 2) return <div className="chart-empty"><strong>Build your trend</strong><span>{empty}</span></div>;
  const values = points.map((item) => number(item[metric]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const coordinates = points.map((item, index) => ({
    x: 8 + (index / (points.length - 1)) * 84,
    y: 78 - ((number(item[metric]) - min) / range) * 60,
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const change = round(values.at(-1) - values[0]);
  return (
    <div className="weight-chart">
      <div className="trend-summary"><span>Last {points.length} entries</span><strong className={change <= 0 ? "positive" : "negative"}>{change > 0 ? "+" : ""}{change} {unit}</strong></div>
      <svg viewBox="0 0 100 90" role="img" aria-label={`${metric} changed by ${change} ${unit}`}>
        <polyline points={line} fill="none" stroke="#9a7bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point, index) => <circle key={points[index].id} cx={point.x} cy={point.y} r="2.6" fill="#0a090d" stroke="#c4b2ff" strokeWidth="1.5" />)}
      </svg>
      <div className="chart-axis"><span>{points[0].date.slice(5)}</span><span>{points.at(-1).date.slice(5)}</span></div>
    </div>
  );
}

function ActivityTrend({ logs }) {
  const days = Array.from({ length: 7 }, (_, index) => dateOffset(index - 6));
  const activityDiary = Object.fromEntries(days.map((day) => [day, [{ calories: (logs[day]?.activities || []).reduce((sum, item) => sum + number(item.minutes), 0) }]]));
  return <CalorieChart diary={activityDiary} target={60} metric="calories" label="Seven day activity minutes" />;
}

export default function AppV2() {
  const [security, setSecurity] = useState(readSecurity);
  const [locked, setLocked] = useState(() => Boolean(readSecurity()));
  const [data, setData] = useState(loadData);
  const [date, setDate] = useState(localDate);
  const [tab, setTab] = useState("diary");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [results, setResults] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [logForm, setLogForm] = useState({ grams: 100, meal: "Breakfast" });
  const [custom, setCustom] = useState({
    name: "",
    brand: "",
    servingGrams: 100,
    confidence: "manual",
    ...EMPTY_NUTRITION,
  });
  const [packageForm, setPackageForm] = useState({
    name: "",
    meal: "Snack",
    servingGrams: 30,
    packageGrams: 180,
    eatenGrams: 30,
    ...EMPTY_NUTRITION,
  });
  const [pinChange, setPinChange] = useState({ current: "", next: "", confirm: "" });
  const [pantryDraft, setPantryDraft] = useState({ name: "", grams: 100, confidence: "manual", ...EMPTY_NUTRITION });
  const [recipeDraft, setRecipeDraft] = useState({ title: "", type: "breakfast", steps: "", reason: "", items: [] });
  const [editingPantryId, setEditingPantryId] = useState("");
  const [measurement, setMeasurement] = useState({ weight: "", waist: "" });
  const [ocrText, setOcrText] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [aiPhotoResult, setAiPhotoResult] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [aiDailyReview, setAiDailyReview] = useState("");
  const [cloudSession, setCloudSession] = useState(null);
  const [syncStatus, setSyncStatus] = useState(readSyncStatus);
  const [authEmail, setAuthEmail] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [cloudHealth, setCloudHealth] = useState({ status: "unchecked", message: "Not checked yet." });
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("caltrack.v2.onboarding") === "dismissed",
  );
  const importRef = useRef(null);
  const syncTimer = useRef(null);
  const cloudLoadedUser = useRef("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setNotice("Local storage is full. Export a backup and remove large progress photos.");
    }
  }, [data]);

  useEffect(() => {
    if (!supabaseConfig.configured) return undefined;
    let cancelled = false;
    async function loadSession(session) {
      try {
        const activeSession = session || await getCurrentSession();
        if (cancelled) return;
        setCloudSession(activeSession);
        if (activeSession?.user?.id && cloudLoadedUser.current !== activeSession.user.id) {
          cloudLoadedUser.current = activeSession.user.id;
          const meta = enableCloudSync();
          setSyncStatus(meta);
          const remoteData = await pullRemoteData(loadData()).catch(() => null);
          if (remoteData && !cancelled) {
            setData((current) => mergeAccountData(current, remoteData));
            flash("Account data loaded. Local data was preserved.");
          }
        }
      } catch {
        if (!cancelled) {
          cloudLoadedUser.current = "";
          setCloudSession(null);
        }
      }
    }
    loadSession();
    const unsubscribe = subscribeToAuthChanges((session) => {
      if (!session) {
        cloudLoadedUser.current = "";
        setCloudSession(null);
        return;
      }
      loadSession(session);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfig.configured) {
      setCloudHealth({ status: "missing-config", message: "Cloud backup is not available in this copy of CalTrack. Your data is still saved on this device." });
      return undefined;
    }
    if (!online) {
      setCloudHealth({ status: "offline", message: "Browser is offline. Local mode is active." });
      return undefined;
    }
    let cancelled = false;
    async function check() {
      try {
        const result = await checkSupabaseConnection();
        if (!cancelled) {
          setCloudHealth({
            status: result.authenticated ? "authenticated" : "reachable",
            message: result.message || (result.authenticated ? "Supabase Auth is reachable and a session is active." : "Supabase Auth is reachable. Sign in to sync."),
          });
        }
      } catch (error) {
        if (!cancelled) setCloudHealth({ status: "error", message: error.message || "Supabase connection failed." });
      }
    }
    check();
    return () => { cancelled = true; };
  }, [online, cloudSession?.user?.id]);

  useEffect(() => {
    if (!cloudSession?.user?.id || !syncStatus.enabled || !online || syncing) return undefined;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      runCloudSync({ quiet: true }).catch(() => null);
    }, 2500);
    return () => window.clearTimeout(syncTimer.current);
  }, [data, cloudSession?.user?.id, syncStatus.enabled, online]);

  useEffect(() => {
    if (locked || !security) return undefined;
    const timeout = Math.max(1, number(data.profile.sessionTimeout) || 15) * 60 * 1000;
    let timer;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), timeout);
    };
    ["pointerdown", "keydown", "touchstart"].forEach((event) => window.addEventListener(event, reset));
    reset();
    return () => {
      window.clearTimeout(timer);
      ["pointerdown", "keydown", "touchstart"].forEach((event) => window.removeEventListener(event, reset));
    };
  }, [locked, security, data.profile.sessionTimeout]);

  const items = data.diary[date] || [];
  const totals = useMemo(() => totalsFor(items), [items]);
  const remaining = number(data.profile.calorieTarget) - totals.calories;
  const caloriePercent = data.profile.calorieTarget
    ? Math.min(100, (totals.calories / number(data.profile.calorieTarget)) * 100)
    : 0;
  const sortedMeasurements = useMemo(
    () => [...data.measurements].sort((a, b) => b.date.localeCompare(a.date)),
    [data.measurements],
  );
  const latestMeasurement = sortedMeasurements[0];
  const dailyLog = data.dailyLogs[date] || { water: 0, notes: "", activities: [] };
  const recipeTotals = useMemo(() => totalsFor(recipeDraft.items.map((item) => scaleNutrition(item.per100, item.grams))), [recipeDraft.items]);
  const isNewUser = !onboardingDismissed && !Object.values(data.diary).some((entries) => entries.length) && !data.measurements.length;

  const setProfile = (patch) =>
    setData((current) => ({ ...current, profile: { ...current.profile, ...patch } }));

  const updateCustom = (patch) => setCustom((current) => ({ ...current, ...patch }));
  const updatePackage = (patch) => setPackageForm((current) => ({ ...current, ...patch }));

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4500);
  }

  function handleDateChange(nextDate) {
    if (!nextDate) return;
    setDate(nextDate);
    const saved = data.measurements.find((item) => item.date === nextDate);
    setMeasurement(saved ? { weight: saved.weight || "", waist: saved.waist || "" } : { weight: "", waist: "" });
  }

  function friendlyError(error, fallback = "Something went wrong. Please try again.") {
    const message = String(error?.message || "");
    if (message === "Failed to fetch" || error instanceof TypeError) return "Could not connect. Check your internet connection and try again.";
    if (message.includes("USDA_API_KEY")) return "USDA search is not available right now. Try barcode search or manual entry.";
    if (message.includes("GEMINI_API_KEY")) return "AI help is not available right now.";
    if (message.includes("VITE_SUPABASE") || message.includes("Supabase is not configured")) return "Cloud backup is not available in this copy of CalTrack.";
    return message || fallback;
  }

  async function sendCloudLink() {
    if (!supabaseConfig.configured) return flash("Cloud backup is not available in this copy of CalTrack.");
    setSyncing(true);
    try {
      await sendMagicLink(authEmail.trim());
      setCloudHealth({ status: "reachable", message: "Sign-in link sent. Check your email." });
      flash("Check your email for the sign-in link.");
    } catch (error) {
      const message = friendlyError(error, "Could not send the sign-in link.");
      setCloudHealth({ status: "error", message });
      flash(message);
    } finally {
      setSyncing(false);
    }
  }

  async function runCloudSync({ quiet = false } = {}) {
    if (!supabaseConfig.configured) return flash("Cloud backup is not available in this copy of CalTrack.");
    if (!cloudSession?.user?.id) return flash("Sign in before syncing.");
    if (!online) return flash("Offline mode: local changes are saved and will sync when you are online.");
    setSyncing(true);
    if (!quiet) setNotice("Syncing your CalTrack data...");
    try {
      const merged = await syncCalTrack(data, cloudSession);
      setData(merged);
      const nextStatus = readSyncStatus();
      setSyncStatus(nextStatus);
      if (!quiet) flash("Cloud backup complete. Local data was preserved.");
    } catch (error) {
      if (!quiet) flash(friendlyError(error, "Cloud backup failed. Local data is still safe."));
      throw error;
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectCloud() {
    await signOut();
    setCloudSession(null);
    flash("Signed out of cloud backup. Local data remains on this device.");
  }

  function dismissOnboarding() {
    localStorage.setItem("caltrack.v2.onboarding", "dismissed");
    setOnboardingDismissed(true);
  }

  async function setupPin(pin) {
    const next = await hashPin(pin);
    localStorage.setItem(SECURITY_KEY, JSON.stringify(next));
    setSecurity(next);
    setLocked(false);
    return true;
  }

  async function unlock(pin) {
    if (!security) return false;
    const candidate = await hashPin(pin, security.salt);
    const ok = candidate.hash === security.hash;
    if (ok) setLocked(false);
    return ok;
  }

  async function changePin() {
    if (pinChange.next !== pinChange.confirm || !/^\d{4,8}$/.test(pinChange.next)) return flash("New PINs must match and contain 4-8 digits.");
    if (security && !(await unlock(pinChange.current))) return flash("Current PIN is incorrect.");
    const next = await hashPin(pinChange.next);
    localStorage.setItem(SECURITY_KEY, JSON.stringify(next));
    setSecurity(next);
    setLocked(false);
    setPinChange({ current: "", next: "", confirm: "" });
    flash(security ? "PIN changed." : "PIN lock created.");
  }

  function updateDailyLog(patch) {
    setData((current) => ({
      ...current,
      dailyLogs: { ...current.dailyLogs, [date]: { water: 0, notes: "", activities: [], ...(current.dailyLogs[date] || {}), ...patch } },
    }));
  }

  function openLogFood(food) {
    setSelectedFood(food);
    setLogForm({ grams: food.servingGrams || 100, meal: "Breakfast" });
  }

  function saveFoodToPantry(food, grams = food.servingGrams || 100) {
    const pantryItem = {
      id: makeId(),
      name: food.name,
      brand: food.brand || "",
      source: food.source || "Custom food",
      confidence: food.confidence || "manual",
      defaultGrams: round(grams) || 100,
      per100: food.per100,
    };
    setData((current) => ({ ...current, pantry: [pantryItem, ...current.pantry] }));
    flash(`${food.name} saved to pantry.`);
  }

  function saveManualPantry() {
    if (!pantryDraft.name.trim() || number(pantryDraft.grams) <= 0) return flash("Add an ingredient name and grams.");
    const grams = number(pantryDraft.grams);
    const item = {
      id: editingPantryId || makeId(),
      name: pantryDraft.name.trim(),
      brand: "",
      source: "Pantry manual entry",
      confidence: pantryDraft.confidence || "manual",
      defaultGrams: grams,
      per100: {
        calories: round((number(pantryDraft.calories) / grams) * 100),
        protein: round((number(pantryDraft.protein) / grams) * 100),
        carbs: round((number(pantryDraft.carbs) / grams) * 100),
        fat: round((number(pantryDraft.fat) / grams) * 100),
        fiber: round((number(pantryDraft.fiber) / grams) * 100),
      },
    };
    setData((current) => ({ ...current, pantry: editingPantryId ? current.pantry.map((existing) => existing.id === editingPantryId ? item : existing) : [item, ...current.pantry] }));
    setEditingPantryId("");
    setPantryDraft({ name: "", grams: 100, confidence: "manual", ...EMPTY_NUTRITION });
    flash(`${item.name} saved.`);
  }

  function editPantry(item) {
    const serving = scaleNutrition(item.per100, item.defaultGrams);
    setEditingPantryId(item.id);
    setPantryDraft({ name: item.name, grams: item.defaultGrams, confidence: item.confidence, calories: serving.calories, protein: serving.protein, carbs: serving.carbs, fat: serving.fat, fiber: serving.fiber });
  }

  function deletePantry(id) {
    setData((current) => ({ ...current, pantry: current.pantry.filter((item) => item.id !== id) }));
  }

  function addIngredientToRecipe(pantryId) {
    const ingredient = data.pantry.find((item) => item.id === pantryId);
    if (!ingredient) return;
    setRecipeDraft((current) => ({ ...current, items: [...current.items, { ...ingredient, recipeItemId: makeId(), grams: ingredient.defaultGrams || 100 }] }));
  }

  function updateRecipeItem(id, patch) {
    setRecipeDraft((current) => ({ ...current, items: current.items.map((item) => item.recipeItemId === id ? { ...item, ...patch } : item) }));
  }

  function saveRecipe() {
    if (!recipeDraft.title.trim() || !recipeDraft.items.length) return flash("Add a recipe title and at least one pantry ingredient.");
    const recipe = {
      id: makeId(),
      title: recipeDraft.title.trim(),
      type: recipeDraft.type,
      steps: recipeDraft.steps,
      reason: recipeDraft.reason,
      items: recipeDraft.items,
      totals: recipeTotals,
      confidence: recipeDraft.items.every((item) => ["off", "usda"].includes(item.confidence)) ? "usda" : "manual",
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({ ...current, recipes: [recipe, ...current.recipes] }));
    setRecipeDraft({ title: "", type: "breakfast", steps: "", reason: "", items: [] });
    flash(`${recipe.title} saved.`);
  }

  function logRecipe(recipe) {
    const mealMap = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
    const meal = mealMap[recipe.type?.toLowerCase()] || "Dinner";
    saveFoodToDiary({ name: recipe.title, source: "Saved recipe", confidence: recipe.confidence, per100: recipe.totals }, 100, meal);
  }

  function saveFoodToDiary(food, grams, meal) {
    const nutrition = scaleNutrition(food.per100, grams);
    const entry = {
      id: makeId(),
      date,
      meal,
      name: food.name,
      brand: food.brand || "",
      source: food.source || "Custom food",
      sourceId: food.sourceId || "",
      ingredients: food.ingredients || "",
      confidence: food.confidence || "manual",
      grams: round(grams),
      per100: food.per100,
      ...nutrition,
    };
    const shouldRemember = !["Saved recipe", "Package calculator"].includes(food.source || "");
    setData((current) => ({
      ...current,
      diary: { ...current.diary, [date]: [...(current.diary[date] || []), entry] },
      customFoods: shouldRemember && !foodAlreadySaved(current.customFoods, food)
        ? [rememberedFood(food), ...current.customFoods]
        : current.customFoods,
    }));
    if (["Open Food Facts", "USDA FoodData Central"].includes(food.source || "")) {
      cacheFoodResult(food, query).catch(() => null);
    }
    flash(`${food.name} added to ${meal.toLowerCase()}.`);
  }

  function confirmSelectedFood() {
    if (!selectedFood || number(logForm.grams) <= 0) return;
    saveFoodToDiary(selectedFood, logForm.grams, logForm.meal);
    setSelectedFood(null);
  }

  function removeFood(id) {
    setData((current) => ({
      ...current,
      diary: {
        ...current.diary,
        [date]: (current.diary[date] || []).filter((item) => item.id !== id),
      },
    }));
  }

  async function runRequest(label, request) {
    setBusy(true);
    setNotice(label);
    try {
      await request();
      setNotice("");
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  function requireQuery() {
    if (!query.trim()) {
      flash("Enter a food name first.");
      return false;
    }
    return true;
  }

  async function searchOpenFoodFacts() {
    if (!requireQuery()) return;
    setResults([]);
    runRequest("Searching foods...", async () => {
      const searchTerm = query.trim();
      const saved = searchSavedFoods(data.customFoods, searchTerm);
      const cached = await searchFoodCache(searchTerm);
      const starter = searchStarterFoods(searchTerm);
      const localMatches = mergeFoods(saved, cached, starter);
      if (localMatches.length) setResults(localMatches);
      let openFoodFacts = [];
      try {
        const payload = await searchOpenFoodFactsPayload(searchTerm);
        openFoodFacts = (payload.products || [])
          .map(openFoodFactsFood)
          .filter((food) => food.per100.calories > 0);
      } catch (error) {
        if (!localMatches.length) throw error;
      }
      let usda = [];
      try {
        usda = await searchUsdaFoods(searchTerm);
      } catch {
        usda = [];
      }
      const foods = mergeFoods(localMatches, openFoodFacts, usda);
      setResults(foods);
      if (!foods.length) throw new Error("No foods with nutrition data were found.");
    });
  }

  async function searchOpenFoodFactsPayload(searchTerm) {
    const fetchWithTimeout = async (url, options = {}) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4500);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        window.clearTimeout(timeout);
      }
    };
    const localResponse = await fetchWithTimeout(API.openFoodFacts, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchTerm, pageSize: 20 }),
    }).catch(() => null);
    if (localResponse?.ok && localResponse.headers.get("content-type")?.includes("application/json")) {
      return localResponse.json();
    }

    const params = new URLSearchParams({
      search_terms: searchTerm,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "20",
      sort_by: "unique_scans_n",
      fields: "code,product_name,generic_name,brands,serving_quantity,ingredients_text,nutriments",
    });
    const response = await fetchWithTimeout(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
    if (!response.ok) throw new Error("Food search is unavailable right now. Try again in a moment.");
    return response.json();
  }

  async function lookupBarcode() {
    if (!barcode.trim()) return flash("Enter the printed barcode number first.");
    setResults([]);
    runRequest("Looking up barcode...", async () => {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode.trim())}.json`,
      );
      if (!response.ok) throw new Error("Barcode lookup failed.");
      const payload = await response.json();
      if (payload.status !== 1) throw new Error("Barcode not found in Open Food Facts.");
      const food = openFoodFactsFood(payload.product);
      if (!food.per100.calories) throw new Error("Product found, but it has no calorie data.");
      setResults([food]);
    });
  }

  async function searchUsda() {
    if (!requireQuery()) return;
    setResults([]);
    runRequest("Searching USDA FoodData Central...", async () => {
      const foods = await searchUsdaFoods(query.trim());
      setResults(foods);
      if (!foods.length) throw new Error("No USDA foods with calorie data were found.");
    });
  }

  async function searchUsdaFoods(searchTerm) {
    const response = await fetch(API.usda, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchTerm, pageSize: 20 }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "USDA search is not available right now. Try barcode search or manual entry.");
    const payload = await response.json();
    return (payload.foods || []).map(usdaFood).filter((food) => food.per100.calories > 0);
  }

  function saveCustomFood() {
    if (!custom.name.trim() || number(custom.servingGrams) <= 0 || number(custom.calories) <= 0) {
      return flash("Add a name, serving grams, and calories.");
    }
    const servingGrams = number(custom.servingGrams);
    const food = {
      id: makeId(),
      name: custom.name.trim(),
      brand: custom.brand.trim(),
      source: "Custom food",
      servingGrams,
      per100: {
        calories: round((number(custom.calories) / servingGrams) * 100),
        protein: round((number(custom.protein) / servingGrams) * 100),
        carbs: round((number(custom.carbs) / servingGrams) * 100),
        fat: round((number(custom.fat) / servingGrams) * 100),
        fiber: round((number(custom.fiber) / servingGrams) * 100),
      },
      confidence: custom.confidence || "manual",
    };
    setData((current) => ({ ...current, customFoods: [food, ...current.customFoods] }));
    openLogFood(food);
    setCustom({ name: "", brand: "", servingGrams: 100, confidence: "manual", ...EMPTY_NUTRITION });
  }

  function deleteCustomFood(id) {
    setData((current) => ({
      ...current,
      customFoods: current.customFoods.filter((food) => food.id !== id),
    }));
  }

  async function scanLabel(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return flash("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES) return flash("Image is too large. Use an image under 1.5 MB.");
    setBusy(true);
    setOcrProgress(0);
    setNotice("Reading the nutrition label locally...");
    try {
      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") setOcrProgress(Math.round(message.progress * 100));
        },
      });
      const output = await worker.recognize(file);
      await worker.terminate();
      const parsed = parseNutritionLabel(output.data.text);
      setOcrText(output.data.text);
      setCustom((current) => ({
        ...current,
        name: current.name || "Scanned nutrition label",
        servingGrams: parsed.servingGrams,
        calories: parsed.calories,
        protein: parsed.protein,
        carbs: parsed.carbs,
        fat: parsed.fat,
        fiber: parsed.fiber,
        confidence: "ocr",
      }));
      setNotice("OCR finished. Verify every value against the label before saving.");
    } catch (error) {
      console.error(error);
      setNotice("OCR could not read that image. Try a brighter, straight-on close-up.");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeFoodPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return flash("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES) return flash("Image is too large. Use a photo under 1.5 MB.");
    setBusy(true);
    setNotice("Analysing your food photo with AI…");
    try {
      const optimized = await optimizeImage(file);
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "meal-photo",
          image: optimized.dataUrl,
          daily: { totals, calorieTarget: data.profile.calorieTarget },
          pantry: data.pantry,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "AI analysis failed.");
      }
      const { analysis } = await response.json();
      const parsed = parseAiNutrition(analysis);
      setAiPhotoResult(analysis);
      setCustom((current) => ({
        ...current,
        name: parsed.name,
        servingGrams: 100,
        calories: parsed.calories || "",
        protein: parsed.protein || "",
        carbs: parsed.carbs || "",
        fat: parsed.fat || "",
        fiber: parsed.fiber || "",
        confidence: "ai",
      }));
      setNotice("AI estimate ready — verify every value before saving.");
    } catch (error) {
      flash(friendlyError(error, "Photo analysis failed. Try manual entry instead."));
    } finally {
      setBusy(false);
    }
  }

  async function describeMealToAi() {
    if (!mealDescription.trim()) return flash("Type what you ate first.");
    setBusy(true);
    setNotice("AI is estimating your meal…");
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "portion",
          text: mealDescription.trim(),
          daily: { totals, calorieTarget: data.profile.calorieTarget },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "AI request failed.");
      }
      const { analysis } = await response.json();
      const parsed = parseAiNutrition(analysis);
      setAiPhotoResult(analysis);
      setCustom((current) => ({
        ...current,
        name: parsed.name || mealDescription.trim().slice(0, 60),
        servingGrams: 100,
        calories: parsed.calories || "",
        protein: parsed.protein || "",
        carbs: parsed.carbs || "",
        fat: parsed.fat || "",
        fiber: parsed.fiber || "",
        confidence: "ai",
      }));
      setNotice("AI estimate ready — check and adjust the values below before saving.");
    } catch (error) {
      flash(friendlyError(error, "AI estimation failed. Try manual entry instead."));
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  async function getDailyAiReview() {
    setBusy(true);
    setNotice("AI is reviewing your day…");
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "daily-review",
          text: `Review my food diary for today (${date}) and give me honest, personalised advice. Be specific about what I should eat for the rest of the day to hit my targets.`,
          daily: {
            date,
            items,
            totals,
            targets: {
              calories: data.profile.calorieTarget,
              protein: data.profile.proteinTarget,
              carbs: data.profile.carbsTarget,
              fat: data.profile.fatTarget,
              fiber: data.profile.fiberTarget,
              water: data.profile.waterTarget,
            },
            water: dailyLog.water,
            activities: dailyLog.activities,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "AI review failed.");
      }
      const { analysis } = await response.json();
      setAiDailyReview(analysis);
      setNotice("");
    } catch (error) {
      flash(friendlyError(error, "AI review failed. Make sure your Gemini API key is configured."));
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  const packageTotals = useMemo(() => {
    const factor = number(packageForm.eatenGrams) / Math.max(1, number(packageForm.servingGrams));
    return {
      calories: round(number(packageForm.calories) * factor),
      protein: round(number(packageForm.protein) * factor),
      carbs: round(number(packageForm.carbs) * factor),
      fat: round(number(packageForm.fat) * factor),
      fiber: round(number(packageForm.fiber) * factor),
    };
  }, [packageForm]);

  function logPackageAmount() {
    if (!packageForm.name.trim() || number(packageForm.servingGrams) <= 0 || number(packageForm.eatenGrams) <= 0) {
      return flash("Add a package name, serving grams, and eaten grams.");
    }
    const servingGrams = number(packageForm.servingGrams);
    const food = {
      name: packageForm.name.trim(),
      source: "Package calculator",
      per100: {
        calories: round((number(packageForm.calories) / servingGrams) * 100),
        protein: round((number(packageForm.protein) / servingGrams) * 100),
        carbs: round((number(packageForm.carbs) / servingGrams) * 100),
        fat: round((number(packageForm.fat) / servingGrams) * 100),
        fiber: round((number(packageForm.fiber) / servingGrams) * 100),
      },
      confidence: "manual",
    };
    saveFoodToDiary(food, packageForm.eatenGrams, packageForm.meal);
  }

  function saveMeasurement() {
    if (number(measurement.weight) <= 0 && number(measurement.waist) <= 0) {
      return flash("Enter weight, waist, or both.");
    }
    const entry = {
      id: makeId(),
      date,
      weight: number(measurement.weight) > 0 ? round(measurement.weight) : "",
      waist: number(measurement.waist) > 0 ? round(measurement.waist) : "",
    };
    setData((current) => ({
      ...current,
      measurements: [...current.measurements.filter((item) => item.date !== date), entry],
    }));
    setMeasurement({ weight: "", waist: "" });
    flash(`Measurement saved for ${date}.`);
  }

  function deleteMeasurement(id) {
    setData((current) => ({
      ...current,
      measurements: current.measurements.filter((item) => item.id !== id),
    }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `caltrack-backup-${localDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    if (!file) return;
    if (file.size > 8_000_000) return flash("Backup is too large to import.");
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.profile || !parsed.diary) throw new Error();
      setData({ ...defaultData, ...parsed, profile: { ...defaultData.profile, ...parsed.profile } });
      flash("Backup imported.");
    } catch {
      flash("That file is not a valid CalTrack backup.");
    }
  }

  async function addProgressPhoto(file, view) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) return flash("Use an image under 1.5 MB.");
    setBusy(true);
    setNotice("Optimizing progress photo...");
    try {
      const optimized = await optimizeImage(file);
      setData((current) => ({
        ...current,
        progressPhotos: [{
          id: makeId(),
          date,
          view,
          dataUrl: optimized.dataUrl,
          thumbnailDataUrl: optimized.thumbnailDataUrl,
          width: optimized.width,
          height: optimized.height,
        }, ...current.progressPhotos].slice(0, 24),
      }));
      flash(`${view} progress photo saved locally as optimized WebP.`);
    } catch {
      const dataUrl = await fileToDataUrl(file);
      setData((current) => ({ ...current, progressPhotos: [{ id: makeId(), date, view, dataUrl }, ...current.progressPhotos].slice(0, 24) }));
      flash(`${view} progress photo saved locally. Optimization failed, so upload sync will retry optimization later.`);
    } finally {
      setBusy(false);
    }
  }

  const recentDays = Array.from({ length: 7 }, (_, index) => dateOffset(index - 6));
  const recentTotals = recentDays.map((day) => totalsFor(data.diary[day] || []));
  const weeklyAverage = round(recentTotals.reduce((sum, item) => sum + item.calories, 0) / 7);
  const weeklyProteinAverage = round(recentTotals.reduce((sum, item) => sum + item.protein, 0) / 7);
  const monthlyTotals = Array.from({ length: 30 }, (_, index) => totalsFor(data.diary[dateOffset(index - 29)] || []));
  const monthlyAverage = round(monthlyTotals.reduce((sum, item) => sum + item.calories, 0) / 30);
  const coach = [
    totals.protein < number(data.profile.proteinTarget) * 0.75 && { title: "Protein goal not reached", body: `You are ${round(number(data.profile.proteinTarget) - totals.protein)}g short. Greek yogurt, eggs, tofu, fish, or lean meat can help.` },
    totals.fiber < number(data.profile.fiberTarget) * 0.75 && { title: "Fiber goal not reached", body: `You are ${round(number(data.profile.fiberTarget) - totals.fiber)}g short. Try beans, oats, berries, vegetables, or whole grains.` },
    dailyLog.water < number(data.profile.waterTarget) * 0.7 && { title: "Water intake is low", body: `Log another ${Math.max(0, number(data.profile.waterTarget) - number(dailyLog.water))} ml to reach today's target.` },
    totals.calories > number(data.profile.calorieTarget) * 1.15 && { title: "Calories above target", body: "Review portions and high-calorie extras. One day does not define progress." },
    totals.calories > 0 && totals.calories < number(data.profile.calorieTarget) * 0.55 && { title: "Calories are quite low", body: "Make sure your intake is sustainable and nutritionally complete." },
  ].filter(Boolean);
  const weightPoints = [...data.measurements].filter((item) => number(item.weight) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = weightPoints.length > 1 ? number(weightPoints.at(-1).weight) - number(weightPoints[0].weight) : 0;
  const elapsedWeeks = weightPoints.length > 1 ? Math.max(1 / 7, (new Date(weightPoints.at(-1).date) - new Date(weightPoints[0].date)) / 604800000) : 0;
  const weeklyWeightChange = elapsedWeeks ? weightChange / elapsedWeeks : 0;
  const remainingWeight = latestMeasurement?.weight && data.profile.goalWeight ? round(number(latestMeasurement.weight) - number(data.profile.goalWeight)) : null;
  const projectedWeeks = remainingWeight > 0 && weeklyWeightChange < -0.05 ? remainingWeight / Math.abs(weeklyWeightChange) : null;
  const estimatedGoalDate = projectedWeeks ? new Date(Date.now() + projectedWeeks * 604800000).toLocaleDateString() : null;

  if (locked) return <LockScreen mode="unlock" onUnlock={unlock} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="brand-mark">CalTrack</span>
          <h1>{tab === "diary" ? "Your day, in focus." : ["add", "tools"].includes(tab) ? "Log with confidence." : tab === "coach" ? "Cook from what you have." : tab === "progress" ? "Progress over time." : "Make it yours."}</h1>
        </div>
        <input
          className="date-picker"
          aria-label="Diary date"
          type="date"
          value={date}
          onChange={(event) => handleDateChange(event.target.value)}
          onInput={(event) => handleDateChange(event.currentTarget.value)}
        />
      </header>

      <section className="calorie-card">
        <div className="calorie-copy">
          <span className="eyebrow">{date === localDate() ? "Today's energy" : date}</span>
          <strong>{Math.abs(Math.round(remaining))}</strong>
          <small>{remaining >= 0 ? "calories available" : "calories over target"}</small>
          <div className="calorie-equation"><span>{Math.round(totals.calories)} eaten</span><i /><span>{number(data.profile.calorieTarget)} goal</span></div>
        </div>
        <div className="ring" style={{ "--progress": `${caloriePercent * 3.6}deg` }}>
          <div>
            <strong>{Math.round(caloriePercent)}%</strong>
            <span>used</span>
          </div>
        </div>
      </section>

      <section className="macro-grid">
        <Macro label="Protein" value={totals.protein} target={data.profile.proteinTarget} tone="protein" />
        <Macro label="Carbs" value={totals.carbs} target={data.profile.carbsTarget} tone="carbs" />
        <Macro label="Fat" value={totals.fat} target={data.profile.fatTarget} tone="fat" />
        <Macro label="Fiber" value={totals.fiber} target={data.profile.fiberTarget} tone="fiber" />
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}
      <main>
        {tab === "diary" && (
          <section className="panel">
            {isNewUser && (
              <div className="onboarding-card">
                <button className="dismiss-button" aria-label="Dismiss getting started" onClick={dismissOnboarding}>Close</button>
                <span className="eyebrow">Welcome to CalTrack</span>
                <h2>Start with one honest entry.</h2>
                <p>Start locally, then sign in with email when you want cloud backup across your own devices. Set your targets, log your first meal, and your dashboard becomes useful immediately.</p>
                <div className="onboarding-steps">
                  <div><b>01</b><span>Set daily goals</span></div>
                  <div><b>02</b><span>Log a meal</span></div>
                  <div><b>03</b><span>Track progress</span></div>
                </div>
                <div className="onboarding-actions">
                  <button className="secondary" onClick={() => setTab("settings")}>Set goals</button>
                  <button className="primary" onClick={() => setTab("add")}>Log first food</button>
                </div>
              </div>
            )}

            <div className="dashboard-grid">
              <div className="insight-card calorie-history">
                <div className="insight-heading"><div><span className="eyebrow">Last 7 days</span><h3>Calorie rhythm</h3></div><strong>{Math.round(totals.calories)}<small> kcal today</small></strong></div>
                <CalorieChart diary={data.diary} target={data.profile.calorieTarget} />
              </div>
              <div className="insight-card weight-history">
                <div className="insight-heading"><div><span className="eyebrow violet">Measurements</span><h3>Weight trend</h3></div><strong>{latestMeasurement?.weight || "--"}<small>{latestMeasurement?.weight ? " kg" : ""}</small></strong></div>
                <WeightTrend measurements={data.measurements} />
              </div>
            </div>

            <div className="daily-wellness">
              <div className="section-heading"><div><span className="eyebrow violet">Daily tracking</span><h2>Water, activity & notes</h2></div></div>
              <div className="form-grid">
                <Field label="Water consumed" suffix="ml" type="number" min="0" value={dailyLog.water} onChange={(event) => updateDailyLog({ water: number(event.target.value) })} />
                <label className="field"><span>Add activity</span><select onChange={(event) => {
                  if (!event.target.value) return;
                  updateDailyLog({ activities: [...dailyLog.activities, { id: makeId(), type: event.target.value, minutes: 30 }] });
                  event.target.value = "";
                }} defaultValue=""><option value="">Choose activity</option><option>Swimming</option><option>Walking</option><option>Strength training</option><option>Other</option></select></label>
              </div>
              <div className="activity-list">{dailyLog.activities.map((activity) => <div className="activity-row" key={activity.id}><strong>{activity.type}</strong><input aria-label={`${activity.type} minutes`} type="number" value={activity.minutes} onChange={(event) => updateDailyLog({ activities: dailyLog.activities.map((item) => item.id === activity.id ? { ...item, minutes: number(event.target.value) } : item) })} /><span>min</span><button className="text-button danger-text" onClick={() => updateDailyLog({ activities: dailyLog.activities.filter((item) => item.id !== activity.id) })}>Remove</button></div>)}</div>
              <label className="field"><span>Daily notes</span><textarea value={dailyLog.notes} onChange={(event) => updateDailyLog({ notes: event.target.value.slice(0, 2000) })} placeholder="Energy, hunger, training, sleep, or anything worth remembering..." /></label>
            </div>

            {!!coach.length && <div className="coach-card"><span className="eyebrow">Personal coach</span><h2>Based on today's log</h2>{coach.map((item) => <div className="coach-item" key={item.title}><strong>{item.title}</strong><p>{item.body}</p></div>)}</div>}

            <div className="ai-review-section">
              <div className="section-heading">
                <div><span className="eyebrow violet">AI-powered</span><h2>Ask AI to review today</h2></div>
                <button className="secondary compact" disabled={busy} onClick={getDailyAiReview}>
                  {busy ? "Reviewing…" : "Review my day"}
                </button>
              </div>
              {aiDailyReview && (
                <div className="ai-result">
                  <div className="ai-result-header">
                    <strong>AI daily review</strong>
                    <button className="text-button" onClick={() => setAiDailyReview("")}>Dismiss</button>
                  </div>
                  <p style={{ whiteSpace: "pre-wrap" }}>{aiDailyReview}</p>
                </div>
              )}
              {!aiDailyReview && <p className="helper">AI will read your diary for today and suggest what to eat next to hit your targets.</p>}
            </div>

            <div className="section-heading">
              <div>
                <span className="eyebrow crimson">{date === localDate() ? "Today" : date}</span>
                <h2>Food diary</h2>
              </div>
              <button className="primary compact" onClick={() => setTab("add")}>Add food</button>
            </div>
            {MEALS.map((meal) => {
              const mealItems = items.filter((item) => item.meal === meal);
              const mealTotal = totalsFor(mealItems);
              return (
                <div className="meal" key={meal}>
                  <div className="meal-heading">
                    <strong>{meal}</strong>
                    <span>{Math.round(mealTotal.calories)} kcal</span>
                  </div>
                  {!mealItems.length && <button className="empty-meal" onClick={() => setTab("add")}><span>Add {meal.toLowerCase()}</span><b>+</b></button>}
                  {mealItems.map((item) => (
                    <article className="food-row" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.brand || item.source} - {item.grams}g</span>
                        <small>P {round(item.protein)}g / C {round(item.carbs)}g / F {round(item.fat)}g</small>
                        <ConfidenceBadge value={item.confidence} />
                      </div>
                      <b>{Math.round(item.calories)} kcal</b>
                      <button className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => removeFood(item.id)}>Remove</button>
                    </article>
                  ))}
                </div>
              );
            })}
          </section>
        )}

        {tab === "add" && (
          <section className="panel stack">
            <div className="section-heading">
              <div><span className="eyebrow">Add food</span><h2>Search, choose, log</h2></div>
            </div>
            <div className="search-line">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a food or product" />
              <button className="primary" disabled={busy} onClick={searchOpenFoodFacts}>Search foods</button>
            </div>
            <div className="barcode-line">
              <input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Enter barcode digits" />
              <button className="secondary" disabled={busy} onClick={lookupBarcode}>Look up barcode</button>
            </div>
            <p className="helper">Search checks your saved foods first, then common starter foods, then live nutrition sources when needed.</p>

            <hr />
            <div className="section-heading">
              <div><span className="eyebrow crimson">AI-powered</span><h2>Describe your meal</h2></div>
            </div>
            <p className="helper">Type what you ate in plain English — AI will estimate the calories and nutrition for you to review.</p>
            <div className="search-line">
              <input
                value={mealDescription}
                onChange={(event) => setMealDescription(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && !busy && describeMealToAi()}
                placeholder="e.g. nasi lemak with egg and sambal, teh tarik"
              />
              <button className="primary" disabled={busy} onClick={describeMealToAi}>Estimate</button>
            </div>

            <hr />
            <div className="section-heading">
              <div><span className="eyebrow violet">AI-powered</span><h2>Snap your food</h2></div>
            </div>
            <p className="helper">Take a photo of your meal or plate. AI will estimate the calories and nutrition — you can review and adjust before logging.</p>
            <div className="scanner-actions">
              <label className="primary file-button">
                📷 Take food photo
                <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(event) => analyzeFoodPhoto(event.target.files?.[0])} />
              </label>
              <label className="secondary file-button">
                Choose from gallery
                <input type="file" accept="image/*" disabled={busy} onChange={(event) => analyzeFoodPhoto(event.target.files?.[0])} />
              </label>
            </div>
            {aiPhotoResult && (
              <details className="ai-result">
                <summary><strong>AI analysis result</strong> — values pre-filled in Custom entry below</summary>
                <p>{aiPhotoResult}</p>
              </details>
            )}

            {!!results.length && <div className="result-list">
              {results.map((food) => (
                <article className="result-card" key={`${food.source}-${food.id}`}>
                  <div>
                    <span className="source">{food.source}</span>
                    <strong>{food.name}</strong>
                    <small>{food.brand || "No brand"} - per 100g</small>
                    <p>{Math.round(food.per100.calories)} kcal / P {round(food.per100.protein)} / C {round(food.per100.carbs)} / F {round(food.per100.fat)}</p>
                    <ConfidenceBadge value={food.confidence} />
                    {food.ingredients && <p className="ingredients"><strong>Ingredients:</strong> {food.ingredients}</p>}
                  </div>
                  <button className="primary compact" onClick={() => openLogFood(food)}>Review & add</button>
                </article>
              ))}
            </div>}

            <hr />
            <div className="section-heading">
              <div><span className="eyebrow">Your own foods</span><h2>Custom food entry</h2></div>
            </div>
            <p className="helper">Enter nutrition values for one serving. Saving creates a reusable custom food, then opens the portion logger.</p>
            <div className="form-grid">
              <Field label="Food name" value={custom.name} onChange={(event) => updateCustom({ name: event.target.value })} />
              <Field label="Brand (optional)" value={custom.brand} onChange={(event) => updateCustom({ brand: event.target.value })} />
              <Field label="Serving size" suffix="g" type="number" min="0" value={custom.servingGrams} onChange={(event) => updateCustom({ servingGrams: event.target.value })} />
              <Field label="Calories per serving" suffix="kcal" type="number" min="0" value={custom.calories} onChange={(event) => updateCustom({ calories: event.target.value })} />
              <Field label="Protein per serving" suffix="g" type="number" min="0" value={custom.protein} onChange={(event) => updateCustom({ protein: event.target.value })} />
              <Field label="Carbs per serving" suffix="g" type="number" min="0" value={custom.carbs} onChange={(event) => updateCustom({ carbs: event.target.value })} />
              <Field label="Fat per serving" suffix="g" type="number" min="0" value={custom.fat} onChange={(event) => updateCustom({ fat: event.target.value })} />
              <Field label="Fiber per serving" suffix="g" type="number" min="0" value={custom.fiber} onChange={(event) => updateCustom({ fiber: event.target.value })} />
            </div>
            <button className="primary" onClick={saveCustomFood}>Save reusable food</button>

            {!!data.customFoods.length && (
              <div className="saved-foods">
                <h3>Saved custom foods</h3>
                {data.customFoods.map((food) => (
                  <article className="food-row" key={food.id}>
                    <div><strong>{food.name}</strong><span>{food.brand || "Custom food"} - {food.servingGrams}g serving</span></div>
                    <b>{Math.round(scaleNutrition(food.per100, food.servingGrams).calories)} kcal</b>
                    <div className="row-actions">
                      <button className="text-button" onClick={() => openLogFood(food)}>Add</button>
                      <button className="text-button danger-text" onClick={() => deleteCustomFood(food.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "tools" && (
          <section className="panel stack">
            <div className="tool-card ocr-card">
              <div className="section-heading">
                <div><span className="eyebrow violet">Runs in your browser</span><h2>Nutrition label OCR</h2></div>
                <span className="feature-badge">Local</span>
              </div>
              <p className="helper">Take a clear, straight-on nutrition label photo or choose one from your gallery. Tesseract.js reads it locally; verify every extracted value before saving.</p>
              <div className="scanner-actions">
                <label className="primary file-button">
                  Take label photo
                  <input type="file" accept="image/*" capture="environment" onChange={(event) => scanLabel(event.target.files?.[0])} />
                </label>
                <label className="secondary file-button">
                  Choose from gallery
                  <input type="file" accept="image/*" onChange={(event) => scanLabel(event.target.files?.[0])} />
                </label>
              </div>
              <p className="fallback-note">If camera access is unavailable or blocked, use Choose from gallery.</p>
              {busy && (
                <div className="ocr-progress" role="progressbar" aria-label="OCR progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={ocrProgress}>
                  <div className="progress-track"><i style={{ width: `${Math.max(ocrProgress, 3)}%` }} /></div>
                  <span>{ocrProgress}%</span>
                </div>
              )}
              {ocrText && (
                <>
                  <button className="secondary" onClick={() => setTab("add")}>Review extracted nutrition</button>
                  <details open><summary>Extracted OCR text</summary><pre>{ocrText}</pre></details>
                </>
              )}
            </div>

            <div className="tool-card package-card">
            <div className="section-heading">
              <div><span className="eyebrow crimson">Partial package or serving</span><h2>Package calculator</h2></div>
            </div>
            <p className="helper">Enter label values per serving, then the package size and amount you actually ate.</p>
            <div className="form-grid">
              <Field label="Food/package name" value={packageForm.name} onChange={(event) => updatePackage({ name: event.target.value })} />
              <label className="field"><span>Meal</span><select value={packageForm.meal} onChange={(event) => updatePackage({ meal: event.target.value })}>{MEALS.map((meal) => <option key={meal}>{meal}</option>)}</select></label>
              <Field label="Serving size" suffix="g" type="number" min="0" value={packageForm.servingGrams} onChange={(event) => updatePackage({ servingGrams: event.target.value })} />
              <Field label="Package weight" suffix="g" type="number" min="0" value={packageForm.packageGrams} onChange={(event) => updatePackage({ packageGrams: event.target.value })} />
              <Field label="Amount eaten" suffix="g" type="number" min="0" value={packageForm.eatenGrams} onChange={(event) => updatePackage({ eatenGrams: event.target.value })} />
              <Field label="Calories per serving" suffix="kcal" type="number" min="0" value={packageForm.calories} onChange={(event) => updatePackage({ calories: event.target.value })} />
              <Field label="Protein per serving" suffix="g" type="number" min="0" value={packageForm.protein} onChange={(event) => updatePackage({ protein: event.target.value })} />
              <Field label="Carbs per serving" suffix="g" type="number" min="0" value={packageForm.carbs} onChange={(event) => updatePackage({ carbs: event.target.value })} />
              <Field label="Fat per serving" suffix="g" type="number" min="0" value={packageForm.fat} onChange={(event) => updatePackage({ fat: event.target.value })} />
              <Field label="Fiber per serving" suffix="g" type="number" min="0" value={packageForm.fiber} onChange={(event) => updatePackage({ fiber: event.target.value })} />
            </div>
            <div className="portion-actions"><button className="secondary" onClick={() => updatePackage({ eatenGrams: packageForm.packageGrams })}>Whole package</button><button className="secondary" onClick={() => updatePackage({ eatenGrams: round(number(packageForm.packageGrams) / 2) })}>Half package</button><button className="secondary" onClick={() => updatePackage({ eatenGrams: round(number(packageForm.packageGrams) / 4) })}>Quarter</button></div>
            <div className="calculation">
              <div><span>Whole package servings</span><strong>{round(number(packageForm.packageGrams) / Math.max(1, number(packageForm.servingGrams)))}</strong></div>
              <div><span>Eaten calories</span><strong>{packageTotals.calories} kcal</strong></div>
              <div><span>Eaten macros</span><strong>P {packageTotals.protein} / C {packageTotals.carbs} / F {packageTotals.fat}</strong></div>
              <div><span>Eaten fiber</span><strong>{packageTotals.fiber}g</strong></div>
            </div>
            <button className="primary" onClick={logPackageAmount}>Add calculated amount to diary</button>
            </div>

            <div className="limitation">
              <strong>Restaurant plate photos</strong>
              <p>CalTrack does not estimate restaurant plate photos in V1. Use label, barcode, package, or manual entry for now.</p>
            </div>
          </section>
        )}

        {tab === "coach" && (
          <section className="panel stack">
            <div className="section-heading"><div><span className="eyebrow">Nutrition coach</span><h2>Pantry & smart recipes</h2></div></div>
            <div className="coach-card">
              <span className="eyebrow violet">Today</span>
              <h2>Data-based guidance</h2>
              {coach.length ? coach.map((item) => <div className="coach-item" key={item.title}><strong>{item.title}</strong><p>{item.body}</p></div>) : <p className="helper">Today's log is on track based on your current goals.</p>}
              <div className="coach-item"><strong>Pantry ideas</strong><p>{data.pantry.length ? data.pantry.slice(0, 4).map((item) => item.name).join(", ") : "Save pantry ingredients from search, barcode, USDA, or manual entries to get useful suggestions."}</p></div>
            </div>

            <div className="tool-card">
              <div className="section-heading"><div><span className="eyebrow crimson">Home ingredients</span><h2>Pantry</h2></div></div>
              <div className="form-grid">
                <Field label="Ingredient" value={pantryDraft.name} onChange={(event) => setPantryDraft({ ...pantryDraft, name: event.target.value })} />
                <Field label="Serving grams" suffix="g" type="number" min="1" value={pantryDraft.grams} onChange={(event) => setPantryDraft({ ...pantryDraft, grams: event.target.value })} />
                <Field label="Calories" suffix="kcal" type="number" min="0" value={pantryDraft.calories} onChange={(event) => setPantryDraft({ ...pantryDraft, calories: event.target.value })} />
                <Field label="Protein" suffix="g" type="number" min="0" value={pantryDraft.protein} onChange={(event) => setPantryDraft({ ...pantryDraft, protein: event.target.value })} />
                <Field label="Carbs" suffix="g" type="number" min="0" value={pantryDraft.carbs} onChange={(event) => setPantryDraft({ ...pantryDraft, carbs: event.target.value })} />
                <Field label="Fat" suffix="g" type="number" min="0" value={pantryDraft.fat} onChange={(event) => setPantryDraft({ ...pantryDraft, fat: event.target.value })} />
                <Field label="Fiber" suffix="g" type="number" min="0" value={pantryDraft.fiber} onChange={(event) => setPantryDraft({ ...pantryDraft, fiber: event.target.value })} />
              </div>
              <button className="primary" onClick={saveManualPantry}>{editingPantryId ? "Update ingredient" : "Save ingredient"}</button>
              <div className="pantry-list">{data.pantry.map((item) => <article className="food-row" key={item.id}><div><strong>{item.name}</strong><span>{item.source} - {item.defaultGrams}g default</span><ConfidenceBadge value={item.confidence} /></div><b>{scaleNutrition(item.per100, item.defaultGrams).calories} kcal</b><div className="row-actions"><button className="text-button" onClick={() => editPantry(item)}>Edit</button><button className="text-button danger-text" onClick={() => deletePantry(item.id)}>Delete</button></div></article>)}</div>
            </div>

            <div className="tool-card">
              <div className="section-heading"><div><span className="eyebrow violet">Database calculated</span><h2>Recipe builder</h2></div></div>
              <div className="form-grid">
                <Field label="Recipe title" value={recipeDraft.title} onChange={(event) => setRecipeDraft({ ...recipeDraft, title: event.target.value })} />
                <label className="field"><span>Meal type</span><select value={recipeDraft.type} onChange={(event) => setRecipeDraft({ ...recipeDraft, type: event.target.value })}>{["breakfast", "lunch", "dinner", "snack", "smoothie", "salad"].map((type) => <option key={type}>{type}</option>)}</select></label>
                <label className="field"><span>Add pantry ingredient</span><select defaultValue="" onChange={(event) => { addIngredientToRecipe(event.target.value); event.target.value = ""; }}><option value="">Choose ingredient</option>{data.pantry.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              </div>
              <div className="recipe-items">{recipeDraft.items.map((item) => <div className="activity-row" key={item.recipeItemId}><strong>{item.name}</strong><input aria-label={`${item.name} grams`} type="number" value={item.grams} onChange={(event) => updateRecipeItem(item.recipeItemId, { grams: number(event.target.value) })} /><span>g</span><button className="text-button danger-text" onClick={() => setRecipeDraft((current) => ({ ...current, items: current.items.filter((row) => row.recipeItemId !== item.recipeItemId) }))}>Remove</button></div>)}</div>
              <label className="field"><span>Preparation steps</span><textarea value={recipeDraft.steps} onChange={(event) => setRecipeDraft({ ...recipeDraft, steps: event.target.value })} placeholder="Steps to prepare..." /></label>
              <label className="field"><span>Why recommended</span><textarea value={recipeDraft.reason} onChange={(event) => setRecipeDraft({ ...recipeDraft, reason: event.target.value })} placeholder="Why this matches your goal..." /></label>
              <div className="calculation"><div><span>Calories</span><strong>{recipeTotals.calories} kcal</strong></div><div><span>Protein</span><strong>{recipeTotals.protein}g</strong></div><div><span>Carbs / Fat / Fiber</span><strong>{recipeTotals.carbs}g / {recipeTotals.fat}g / {recipeTotals.fiber}g</strong></div><div><span>Confidence</span><strong>{recipeDraft.items.every((item) => ["off", "usda"].includes(item.confidence)) ? "Database ingredients" : "Mixed sources"}</strong></div></div>
              <button className="primary" onClick={saveRecipe}>Save recipe</button>
              <div className="recipe-list">{data.recipes.map((recipe) => <article className="result-card" key={recipe.id}><div><span className="source">{recipe.type}</span><strong>{recipe.title}</strong><p>{recipe.totals.calories} kcal / P {recipe.totals.protein} / C {recipe.totals.carbs} / F {recipe.totals.fat} / Fiber {recipe.totals.fiber}</p><ConfidenceBadge value={recipe.confidence} /><p>{recipe.reason}</p></div><button className="secondary compact" onClick={() => logRecipe(recipe)}>Log recipe</button></article>)}</div>
            </div>

          </section>
        )}

        {tab === "progress" && (
          <section className="panel stack">
            <div className="section-heading"><div><span className="eyebrow">By date</span><h2>Weight & waist</h2></div></div>
            <div className="insight-card">
              <div className="insight-heading"><div><span className="eyebrow violet">Recent entries</span><h3>Weight trend</h3></div><strong>{latestMeasurement?.weight || "--"}<small>{latestMeasurement?.weight ? " kg" : ""}</small></strong></div>
              <WeightTrend measurements={data.measurements} />
            </div>
            <div className="insight-card">
              <div className="insight-heading"><div><span className="eyebrow crimson">Last 7 days</span><h3>Protein trend</h3></div><strong>{round(totals.protein)}<small>g today</small></strong></div>
              <CalorieChart diary={data.diary} target={data.profile.proteinTarget} metric="protein" label="Seven day protein history" />
            </div>
            <div className="stat-grid">
              <div><span>Latest weight</span><strong>{latestMeasurement?.weight ? `${latestMeasurement.weight} kg` : "--"}</strong></div>
              <div><span>Latest waist</span><strong>{latestMeasurement?.waist ? `${latestMeasurement.waist} cm` : "--"}</strong></div>
              <div><span>Goal weight</span><strong>{data.profile.goalWeight ? `${data.profile.goalWeight} kg` : "--"}</strong></div>
            </div>
            <div className="summary-grid">
              <div className="calculation"><div><span>7-day calorie average</span><strong>{weeklyAverage} kcal</strong></div><div><span>7-day protein average</span><strong>{weeklyProteinAverage}g</strong></div><div><span>30-day calorie average</span><strong>{monthlyAverage} kcal</strong></div><div><span>Weight remaining</span><strong>{remainingWeight === null ? "--" : `${remainingWeight} kg`}</strong></div><div><span>Estimated goal date</span><strong>{estimatedGoalDate || "Need a stable downward trend"}</strong></div></div>
            </div>
            <div className="form-grid">
              <Field label={`Weight on ${date}`} suffix="kg" type="number" min="0" step="0.1" value={measurement.weight} onChange={(event) => setMeasurement((current) => ({ ...current, weight: event.target.value }))} />
              <Field label={`Waist on ${date}`} suffix="cm" type="number" min="0" step="0.1" value={measurement.waist} onChange={(event) => setMeasurement((current) => ({ ...current, waist: event.target.value }))} />
            </div>
            <button className="primary" onClick={saveMeasurement}>Save measurement</button>
            <div className="history">
              {sortedMeasurements.map((item) => (
                <article className="history-row" key={item.id}>
                  <strong>{item.date}</strong>
                  <span>{item.weight ? `${item.weight} kg` : "No weight"}</span>
                  <span>{item.waist ? `${item.waist} cm waist` : "No waist"}</span>
                  <button className="text-button danger-text" onClick={() => deleteMeasurement(item.id)}>Delete</button>
                </article>
              ))}
              {!sortedMeasurements.length && <p className="empty">No measurements saved yet.</p>}
            </div>
            <div className="tool-card">
              <div className="section-heading"><div><span className="eyebrow violet">Stored locally</span><h2>Progress photos</h2></div></div>
              <p className="helper">Save front, side, and optional back photos. Images are limited to 1.5 MB each and included in backups.</p>
              <div className="photo-actions">{["Front", "Side", "Back"].map((view) => <label className="secondary file-button" key={view}>{view}<input type="file" accept="image/*" capture="environment" onChange={(event) => addProgressPhoto(event.target.files?.[0], view)} /></label>)}</div>
              <div className="photo-grid">{data.progressPhotos.map((photo) => <figure key={photo.id}><img src={photo.dataUrl} alt={`${photo.view} progress on ${photo.date}`} /><figcaption>{photo.view} - {photo.date}</figcaption></figure>)}</div>
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="panel stack">
            <div className="section-heading"><div><span className="eyebrow">Goals & connections</span><h2>Settings</h2></div></div>
            <div className="form-grid">
              <Field label="Daily calorie goal" suffix="kcal" type="number" min="0" value={data.profile.calorieTarget} onChange={(event) => setProfile({ calorieTarget: number(event.target.value) })} />
              <Field label="Protein goal" suffix="g" type="number" min="0" value={data.profile.proteinTarget} onChange={(event) => setProfile({ proteinTarget: number(event.target.value) })} />
              <Field label="Carbs goal" suffix="g" type="number" min="0" value={data.profile.carbsTarget} onChange={(event) => setProfile({ carbsTarget: number(event.target.value) })} />
              <Field label="Fat goal" suffix="g" type="number" min="0" value={data.profile.fatTarget} onChange={(event) => setProfile({ fatTarget: number(event.target.value) })} />
              <Field label="Fiber goal" suffix="g" type="number" min="0" value={data.profile.fiberTarget} onChange={(event) => setProfile({ fiberTarget: number(event.target.value) })} />
              <Field label="Water goal" suffix="ml" type="number" min="0" value={data.profile.waterTarget} onChange={(event) => setProfile({ waterTarget: number(event.target.value) })} />
              <Field label="Goal weight" suffix="kg" type="number" min="0" step="0.1" value={data.profile.goalWeight} onChange={(event) => setProfile({ goalWeight: event.target.value })} />
              <Field label="Session timeout" suffix="minutes" type="number" min="1" max="240" value={data.profile.sessionTimeout} onChange={(event) => setProfile({ sessionTimeout: Math.min(240, Math.max(1, number(event.target.value))) })} />
            </div>
            <div className="tool-card cloud-card">
              <div className="section-heading">
                <div><span className="eyebrow violet">Optional backup</span><h2>Cloud backup</h2></div>
                <span className="feature-badge">{!supabaseConfig.configured ? "Local only" : cloudHealth.status === "authenticated" ? "Signed in" : cloudHealth.status === "reachable" ? "Ready" : cloudHealth.status === "offline" ? "Offline" : cloudHealth.status === "error" ? "Needs attention" : "Checking"}</span>
              </div>
              <p className="helper">
                Your data is saved on this device first. Cloud backup is optional and never deletes your local data during setup.
              </p>
              {!supabaseConfig.configured && (
                <div className="cloud-health"><strong>Local backup mode</strong><span>Cloud backup is not available in this copy of CalTrack. Export a backup file any time below.</span></div>
              )}
              {supabaseConfig.configured && (
                <div className={`cloud-health ${cloudHealth.status === "error" ? "bad" : "good"}`}>
                  <strong>Cloud sync status</strong>
                  <span>{cloudHealth.message}</span>
                </div>
              )}
              {supabaseConfig.configured && cloudSession?.user ? (
                <>
                  <div className="cloud-status">
                    <div><span>Signed in</span><strong>{cloudSession.user.email || cloudSession.user.id}</strong></div>
                    <div><span>Last sync</span><strong>{syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : "Not synced yet"}</strong></div>
                  </div>
                  <div className="settings-actions">
                    <button className="primary" disabled={syncing || !online} onClick={() => runCloudSync()}>Back up now</button>
                    <button className="secondary" disabled={syncing} onClick={disconnectCloud}>Sign out</button>
                  </div>
                  <p className="helper">Backup uploads current local diary, goals, pantry, recipes, measurements, and optimized progress photos. Local data stays in this browser as fallback.</p>
                </>
              ) : supabaseConfig.configured ? (
                <>
                  <div className="form-grid">
                    <Field label="Email for magic link" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                  </div>
                  <button className="primary" disabled={syncing || !supabaseConfig.configured} onClick={sendCloudLink}>Send sign-in link</button>
                  <p className="helper">After opening the email link, return here and use Back up now. Your PIN remains local and separate from cloud backup.</p>
                </>
              ) : null}
            </div>
            <div className="tool-card">
              <div className="section-heading"><div><span className="eyebrow crimson">Privacy</span><h2>{security ? "Change PIN" : "Optional PIN lock"}</h2></div>{security && <button className="secondary compact" onClick={() => setLocked(true)}>Lock now</button>}</div>
              <div className="form-grid">{security && <Field label="Current PIN" type="password" inputMode="numeric" value={pinChange.current} onChange={(event) => setPinChange({ ...pinChange, current: event.target.value.replace(/\D/g, "") })} />}<Field label="New PIN" type="password" inputMode="numeric" value={pinChange.next} onChange={(event) => setPinChange({ ...pinChange, next: event.target.value.replace(/\D/g, "") })} /><Field label="Confirm new PIN" type="password" inputMode="numeric" value={pinChange.confirm} onChange={(event) => setPinChange({ ...pinChange, confirm: event.target.value.replace(/\D/g, "") })} /></div>
              <button className="primary" onClick={changePin}>{security ? "Change PIN" : "Create PIN lock"}</button>
            </div>
            <div className="settings-actions">
              <button className="secondary" onClick={exportData}>Export backup</button>
              <button className="secondary" onClick={() => importRef.current?.click()}>Import backup</button>
              <input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => importData(event.target.files?.[0])} />
              <button className="danger-button" onClick={() => {
                if (window.confirm("Delete all CalTrack data stored in this browser?")) setData(defaultData);
              }}>Delete all local data</button>
            </div>
            <div className="privacy-note">
              <strong>Local-first and honest by design</strong>
              <p>Your diary, measurements, custom foods, photos, goals, and PIN lock stay saved on this device. The PIN is a practical privacy barrier, not encryption. Cloud backup is optional and separate from the PIN.</p>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {[
          ["diary", "Today"],
          ["add", "Add"],
          ["tools", "Tools"],
          ["coach", "Pantry"],
          ["progress", "Progress"],
          ["settings", "Settings"],
        ].map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {selectedFood && (
        <div className="modal-backdrop" onClick={() => setSelectedFood(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="log-food-title" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">{selectedFood.source}</span>
            <h2 id="log-food-title">{selectedFood.name}</h2>
            <p className="helper">{selectedFood.brand || "No brand"} - nutrition scales from the source's per-100g values.</p>
            <div className="form-grid">
              <Field label="Amount eaten" suffix="g" type="number" min="0" value={logForm.grams} onChange={(event) => setLogForm((current) => ({ ...current, grams: event.target.value }))} />
              <label className="field"><span>Meal</span><select value={logForm.meal} onChange={(event) => setLogForm((current) => ({ ...current, meal: event.target.value }))}>{MEALS.map((meal) => <option key={meal}>{meal}</option>)}</select></label>
            </div>
            <div className="calculation">
              <div><span>Calories</span><strong>{scaleNutrition(selectedFood.per100, logForm.grams).calories} kcal</strong></div>
              <div><span>Macros</span><strong>P {scaleNutrition(selectedFood.per100, logForm.grams).protein} / C {scaleNutrition(selectedFood.per100, logForm.grams).carbs} / F {scaleNutrition(selectedFood.per100, logForm.grams).fat}</strong></div>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setSelectedFood(null)}>Cancel</button>
              <button className="primary" onClick={confirmSelectedFood}>Add to diary</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
