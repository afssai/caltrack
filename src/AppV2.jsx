import React, { useEffect, useMemo, useRef, useState } from "react";
import logo1Src from "./assets/LOGO1.png";
import logo2Src from "./assets/LOGO2.png";
import { Droplets, Coffee, Footprints, Dumbbell, Flame, Plus, List, CalendarDays, ScanLine, User, Activity, Waves, Beef, Wheat, Leaf, Droplet, Trash2, Timer, Zap, Sun, Moon, BatteryLow, Thermometer, Brain, Camera, Package, BookOpen, Scale, Image, HeartPulse, Stethoscope, ChefHat, SlidersHorizontal, Search, ClipboardList } from "lucide-react";
import { createWorker } from "tesseract.js";
import { preprocessLabel } from "./ocrPreprocess.js";
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
const ACTIVITY_PRESETS = [
  { type: "Walking", label: "Walk", minutes: 30 },
  { type: "Swimming", label: "Swim", minutes: 30 },
  { type: "Strength training", label: "Weights", minutes: 45 },
];
const HEALTH_FLAGS = [
  ["normalDay", "Normal", Sun, "#ffd060", "rgba(255,208,60,.18)"],
  ["restDay", "Rest", Moon, "#7fb3ff", "rgba(127,179,255,.18)"],
  ["lowEnergy", "Low energy", BatteryLow, "#ffb347", "rgba(255,179,71,.18)"],
  ["sick", "Sick", Thermometer, "#ff6b6b", "rgba(255,107,107,.18)"],
];
const QUICK_FOOD_IDS = ["starter:banana", "starter:egg", "starter:fried-eggs", "starter:chicken-breast", "starter:white-rice"];
const EMPTY_NUTRITION = { calories: "", protein: "", carbs: "", fat: "", fiber: "" };
const CONFIDENCE = {
  off: ["Barcode + Database", "confidence-green"],
  usda: ["USDA", "confidence-green"],
  manual: ["Manual Entry", "confidence-yellow"],
  ocr: ["OCR suggestion", "confidence-orange"],
  ai: ["AI Estimate", "confidence-blue"],
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2 style={{ marginBottom: "1rem" }}>Something went wrong</h2>
          <p style={{ color: "#888", marginBottom: "1.5rem", fontSize: "0.9rem" }}>{String(this.state.error)}</p>
          <button onClick={() => window.location.reload()} style={{ padding: "0.75rem 1.5rem", background: "#FF4500", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "1rem" }}>
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MiniIcon({ type, size = 22 }) {
  const props = { size, strokeWidth: 1.8, "aria-hidden": true };
  if (type === "walk" || type === "walking")   return <Footprints {...props} />;
  if (type === "swim" || type === "swimming")  return <Waves {...props} />;
  if (type === "weights" || type === "strength") return <Dumbbell {...props} />;
  if (type === "water")   return <Droplets {...props} />;
  if (type === "coffee")  return <Coffee {...props} />;
  if (type === "fire")    return <Flame {...props} />;
  if (type === "protein") return <Beef {...props} />;
  if (type === "carbs")   return <Wheat {...props} />;
  if (type === "fat")     return <Droplet {...props} />;
  if (type === "fiber")   return <Leaf {...props} />;
  return <Activity {...props} />;
}

function LiquidOrb({ LIcon, fill, color, glow, label, value, onClick, animate }) {
  return (
    <button className={`liquid-orb-btn${animate ? " liquid-orb-pulse" : ""}`} onClick={onClick} aria-label={label}>
      <div className="liquid-orb" style={{ "--fill": `${fill}%`, "--liq-color": color, "--liq-glow": glow }}>
        <div className="liquid-body">
          <div className="liquid-wave-top" />
        </div>
        <LIcon size={26} strokeWidth={1.7} className="liquid-orb-icon" />
      </div>
      <span className="orb-label">{label}</span>
      <span className="orb-value">{value}</span>
    </button>
  );
}

function CalorieRing({ consumed, burned, target, percent }) {
  const outerR = 40, innerR = 29, size = 100, cx = 50, cy = 50;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;
  const cFrac = Math.min(1, consumed / Math.max(1, target));
  const bFrac = Math.min(1, burned / Math.max(1, target));
  const isOver = cFrac >= 1;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="calorie-ring-svg" aria-hidden="true">
      {/* Track */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" />
      {/* Consumed arc — outer ring, blue (or red if over) */}
      <circle cx={cx} cy={cy} r={outerR} fill="none"
        stroke={isOver ? "#ff334f" : "#4dc3ff"}
        strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${cFrac * outerC} ${outerC}`}
        transform="rotate(-90 50 50)" />
      {/* Burned arc — inner ring, orange */}
      {burned > 0 && (
        <circle cx={cx} cy={cy} r={innerR} fill="none"
          stroke="#ff6a18"
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${bFrac * innerC} ${innerC}`}
          transform="rotate(-90 50 50)" />
      )}
      {/* Center label */}
      <text x="50" y="46" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="'Space Grotesk',sans-serif">{Math.round(percent)}%</text>
      <text x="50" y="56" textAnchor="middle" fill="rgba(255,255,255,.45)" fontSize="7" letterSpacing="1" fontFamily="'Space Grotesk',sans-serif">USED</text>
      {burned > 0 && <text x="50" y="65" textAnchor="middle" fill="#ff6a18" fontSize="7" fontWeight="700" fontFamily="'Space Grotesk',sans-serif">{burned} burn</text>}
    </svg>
  );
}
const API = {
  openFoodFacts: "/api/open-food-facts",
  usda: "/api/usda",
};

const EXERCISE_MET = { Swimming: 7, Walking: 4, "Strength training": 5, Other: 4 };
function calcBurnedCalories(type, minutes, weightKg) {
  const met = EXERCISE_MET[type] || 4;
  const w = weightKg > 0 ? weightKg : 70;
  return Math.round((met * 3.5 * w * minutes) / 200);
}
function calcBMR(p) {
  const w = number(p.weight), h = number(p.height), a = number(p.age);
  if (!w || !h || !a) return 0;
  return Math.round(p.gender === "female" ? 10 * w + 6.25 * h - 5 * a - 161 : 10 * w + 6.25 * h - 5 * a + 5);
}
function calcTDEE(p) {
  const bmr = calcBMR(p);
  if (!bmr) return 0;
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  return Math.round(bmr * (factors[p.activityLevel] || 1.2));
}

const defaultData = {
  version: 2,
  profile: {
    name: "",
    gender: "",
    age: "",
    height: "",
    weight: "",
    highestWeight: "",
    activityLevel: "sedentary",
    medicalConditions: "",
    medications: "",
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
  const p = per100 || {};
  const factor = number(grams) / 100;
  return {
    calories: round(number(p.calories) * factor),
    protein: round(number(p.protein) * factor),
    carbs: round(number(p.carbs) * factor),
    fat: round(number(p.fat) * factor),
    fiber: round(number(p.fiber) * factor),
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
      calories: number(nutrients["energy-kcal_100g"]) || Math.round(number(nutrients["energy_100g"]) / 4.184),
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

function cleanFoodName(name = "") {
  return String(name)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function foodDisplayKey(food) {
  return cleanFoodName(food.name).toLowerCase();
}

function simplifyFoods(foods = []) {
  const priority = { "Saved food": 0, "Custom food": 0, "Local database": 1, "Starter food": 1, "USDA FoodData Central": 2, "Open Food Facts": 3 };
  const sorted = [...foods].sort((a, b) => (priority[a.source] ?? 9) - (priority[b.source] ?? 9));
  const byName = new Map();
  const output = [];
  for (const food of sorted) {
    const key = foodDisplayKey(food);
    if (!key) continue;
    const isPackaged = food.source === "Open Food Facts" && food.brand;
    const outputKey = isPackaged ? `${key}:${String(food.brand).toLowerCase()}` : key;
    if (byName.has(outputKey)) continue;
    byName.set(outputKey, true);
    output.push(food);
  }
  return output;
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

function splitList(value = "") {
  return String(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dailyGreeting({ name, remaining, totals, dailyLog, medicationCount }) {
  const firstName = name?.trim()?.split(/\s+/)[0] || "Kaivan";
  if (number(totals.calories) === 0 && !number(dailyLog.water) && !(dailyLog.activities || []).length) {
    return `${firstName}, win the next small choice.`;
  }
  if (remaining < 0) return `${firstName}, steady now. Keep the rest light.`;
  if ((dailyLog.activities || []).length) return `${firstName}, movement is in. Protect protein and water.`;
  if (medicationCount && (dailyLog.medsTaken || []).length < medicationCount) return `${firstName}, quick meds check when you can.`;
  if (number(dailyLog.water) < 500) return `${firstName}, add water before the day gets loud.`;
  return `${firstName}, consistency is doing its quiet work.`;
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
  const iconType = label.toLowerCase();
  return (
    <div className="macro">
      <div className="macro-top">
        <span className={`macro-icon ${tone}`}><MiniIcon type={iconType} /></span>
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

function LockScreen({ mode, onUnlock, onSetup, owner }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) return setError("Use a 4-8 digit PIN.");
    if (mode === "setup" && pin !== confirm) return setError("PIN confirmation does not match.");
    const ok = mode === "setup" ? await onSetup(pin, email.trim()) : await onUnlock(pin);
    if (!ok) setError("Incorrect PIN.");
  };
  return (
    <div className="lock-shell">
      <form className="lock-card" onSubmit={submit}>
        <img src={logo1Src} alt="PULSE" className="brand-logo lock-logo" />
        <h1>{mode === "setup" ? "Create your PIN" : "Welcome back"}</h1>
        {mode === "unlock" && owner && (
          <p style={{ color: "var(--blue2)", fontWeight: 600, fontSize: "12px", margin: "-4px 0 0" }}>
            🔒 {owner}
          </p>
        )}
        <p>{mode === "setup" ? "Set your email and a PIN so only you can open this app — even if someone finds the link." : "Enter your PIN to unlock your personal health log."}</p>
        {mode === "setup" && (
          <Field label="Your email (shown on lock screen)" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
        <Field label="PIN (4-8 digits)" type="password" inputMode="numeric" autoComplete="off" maxLength="8" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} />
        {mode === "setup" && <Field label="Confirm PIN" type="password" inputMode="numeric" autoComplete="off" maxLength="8" value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ""))} />}
        {error && <div className="form-error">{error}</div>}
        <button className="primary" type="submit">{mode === "setup" ? "Lock app with my PIN" : "Unlock"}</button>
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

function WeightJourneyCard({ entries, highestWeight, currentWeight, goalWeight: goalW, onLog, quickInput, setQuickInput, flash: flashMsg, setData }) {
  const today = localDate();
  const firstW = number(highestWeight) || (entries[0] ? number(entries[0].weight) : null);
  const curW   = entries.length ? number(entries[entries.length - 1].weight) : (number(currentWeight) || null);
  const totalDrop = firstW && goalW ? firstW - goalW : null;
  const dropped   = firstW && curW ? round(firstW - curW) : null;
  const toGo      = curW && goalW ? round(curW - goalW) : null;
  const pct       = totalDrop > 0 && dropped !== null ? Math.min(100, Math.max(0, (dropped / totalDrop) * 100)) : null;

  // milestone track
  const PAD = 24, TW = 300;
  const curX = pct !== null ? PAD + (pct / 100) * (TW - 2 * PAD) : null;

  // line chart — safe even with 0 or 1 entries
  const CW = 300, CH = 100, CPX = 14, CPY = 12;
  const pts = entries;
  const ws  = pts.map((e) => number(e.weight));
  const hasChart = pts.length >= 2;
  const rawMin = hasChart ? Math.min(...ws) : 0;
  const rawMax = hasChart ? Math.max(...ws) : 1;
  const yMin = goalW ? Math.min(rawMin, goalW) - 3 : rawMin - 3;
  const yMax = rawMax + 3;
  const yRange = Math.max(1, yMax - yMin);
  const toX = (i) => CPX + (i / Math.max(1, pts.length - 1)) * (CW - 2 * CPX);
  const toY = (w) => CPY + ((yMax - w) / yRange) * (CH - 2 * CPY);
  const linePts  = hasChart ? pts.map((e, i) => `${toX(i)},${toY(number(e.weight))}`).join(" ") : "";
  const areaPts  = hasChart ? `${toX(0)},${CH - 2} ${linePts} ${toX(pts.length - 1)},${CH - 2}` : "";
  const goalY    = goalW && hasChart ? toY(goalW) : null;

  const daysSince = entries.length ? Math.floor((Date.now() - new Date(entries[entries.length - 1].date).getTime()) / 86_400_000) : null;
  const needsWeigh = daysSince === null || daysSince >= 7;

  return (
    <section className="wj-card">
      <div className="wj-header">
        <div><span className="eyebrow violet">Weight journey</span><h3><Scale size={15} style={{verticalAlign:"middle",marginRight:5,color:"var(--accent-good)"}}/>Progress to goal</h3></div>
        <button className="secondary compact" onClick={() => setQuickInput(" ")}>＋ Log</button>
      </div>

      {quickInput !== "" && (
        <div className="ws-quick-form">
          <input type="number" step="0.1" min="20" max="300" className="ws-quick-input"
            placeholder={curW ? String(curW) : "e.g. 114.0"}
            value={quickInput.trim()}
            onChange={(e) => setQuickInput(e.target.value)}
            autoFocus />
          <span className="ws-unit">kg</span>
          <button className="primary ws-save-btn" onClick={() => {
            const w = parseFloat(quickInput);
            if (!w || w < 20 || w > 300) { flashMsg("Enter a valid weight (20–300 kg)."); return; }
            setData((d) => ({
              ...d,
              measurements: [...d.measurements, { id: makeId(), date: today, weight: w, waist: "" }],
              profile: { ...d.profile, weight: w },
            }));
            setQuickInput("");
            flashMsg("Weight logged! BMI & profile updated.");
          }}>Save</button>
          <button className="secondary ws-cancel-btn" onClick={() => setQuickInput("")}>✕</button>
        </div>
      )}

      {needsWeigh && quickInput === "" && (
        <button className="weigh-reminder" onClick={() => setQuickInput(" ")}>
          ⚖️ {daysSince === null ? "Log your first weight — tap here" : `${daysSince} days since last weigh-in — tap to update`}
        </button>
      )}

      <div className="wj-stats">
        {firstW  && <div className="wj-stat"><span>Started</span><strong>{firstW} kg</strong></div>}
        {dropped !== null && dropped > 0 && <div className="wj-stat wj-lost"><span>Lost</span><strong>−{dropped} kg</strong></div>}
        {curW    && <div className="wj-stat wj-cur"><span>Now</span><strong>{curW} kg</strong></div>}
        {toGo !== null && toGo > 0 && <div className="wj-stat"><span>To goal</span><strong>{toGo} kg</strong></div>}
      </div>

      {pct !== null && curX !== null && (
        <div className="wj-track-wrap">
          <svg viewBox={`0 0 ${TW} 58`} className="wj-track-svg">
            <defs>
              <linearGradient id="wjGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4dc37f" stopOpacity=".9"/>
                <stop offset="100%" stopColor="#00c6ff" stopOpacity=".9"/>
              </linearGradient>
            </defs>
            <line x1={PAD} y1="20" x2={TW-PAD} y2="20" stroke="rgba(255,255,255,.1)" strokeWidth="5" strokeLinecap="round"/>
            <line x1={PAD} y1="20" x2={curX}    y2="20" stroke="url(#wjGrad)"          strokeWidth="5" strokeLinecap="round"/>
            <circle cx={PAD}    cy="20" r="6" fill="#4dc37f"/>
            <circle cx={curX}   cy="20" r="9" fill="#0a090d" stroke="#00c6ff" strokeWidth="2.5"/>
            <circle cx={curX}   cy="20" r="4" fill="#00c6ff"/>
            <circle cx={TW-PAD} cy="20" r="6" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.4)" strokeWidth="1.5"/>
            <text x={PAD}    y="38" fontSize="10" fill="#4dc37f" fontWeight="700">{firstW} kg</text>
            <text x={curX}   y="38" fontSize="10" fill="#00c6ff" fontWeight="700" textAnchor="middle">{curW} kg</text>
            <text x={TW-PAD} y="38" fontSize="10" fill="rgba(255,255,255,.4)" fontWeight="700" textAnchor="end">{goalW} kg</text>
            <text x={PAD}    y="50" fontSize="8" fill="rgba(255,255,255,.25)">Start</text>
            <text x={curX}   y="50" fontSize="8" fill="rgba(255,255,255,.25)" textAnchor="middle">You</text>
            <text x={TW-PAD} y="50" fontSize="8" fill="rgba(255,255,255,.25)" textAnchor="end">Goal</text>
          </svg>
          <div className="wj-pct">{Math.round(pct)}% of the way to your goal</div>
        </div>
      )}

      {hasChart && (
        <div className="wj-chart-wrap">
          <svg viewBox={`0 0 ${CW} ${CH}`} className="wj-chart-svg">
            <defs>
              <linearGradient id="wjAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00c6ff" stopOpacity=".2"/>
                <stop offset="100%" stopColor="#00c6ff" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {goalY !== null && (
              <>
                <line x1={CPX} y1={goalY} x2={CW-CPX} y2={goalY} stroke="#4dc37f" strokeWidth="1.2" strokeDasharray="5 4" strokeOpacity=".6"/>
                <text x={CW-CPX-2} y={goalY-3} fontSize="8" fill="#4dc37f" opacity=".8" textAnchor="end">Goal {goalW} kg</text>
              </>
            )}
            <polygon points={areaPts} fill="url(#wjAreaGrad)"/>
            <polyline points={linePts} fill="none" stroke="#00c6ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            {pts.map((e, i) => (
              <circle key={e.id || i} cx={toX(i)} cy={toY(number(e.weight))} r="3" fill="#0a090d" stroke="#00c6ff" strokeWidth="1.8"/>
            ))}
            <text x={toX(0)}             y={toY(ws[0]) - 5}         fontSize="9" fill="rgba(255,255,255,.4)" textAnchor="middle">{ws[0]}</text>
            <text x={toX(pts.length - 1)} y={toY(ws[ws.length-1])-5} fontSize="9" fill="#00c6ff" fontWeight="700" textAnchor="middle">{ws[ws.length-1]}</text>
          </svg>
          <div className="wj-chart-axis">
            <span>{pts[0].date.slice(5)}</span>
            <span>{pts[pts.length-1].date.slice(5)}</span>
          </div>
        </div>
      )}

      {!hasChart && quickInput === "" && (
        <p className="wj-empty">Log 2+ weights to see your trend line.</p>
      )}
    </section>
  );
}

function AppV2Inner() {
  const [security, setSecurity] = useState(readSecurity);
  const [locked, setLocked] = useState(true);
  const [data, setData] = useState(loadData);
  const [date, setDate] = useState(localDate);
  const [tab, setTab] = useState("diary");
  const mainRef = useRef(null);

  // Animated calorie counter
  const [displayCalories, setDisplayCalories] = useState(0);
  const calAnimRef = useRef(null);
  useEffect(() => {
    const eaten = data.diary[date] ? data.diary[date].reduce((s, e) => s + number(e.calories), 0) : 0;
    const burned = (data.dailyLogs[date]?.activities || []).reduce((s, a) => s + calcBurnedCalories(a.type, number(a.minutes), number(data.profile.weight)), 0);
    const target = Math.abs(Math.round(number(data.profile.calorieTarget) - eaten + burned));
    const start = displayCalories;
    const delta = target - start;
    if (Math.abs(delta) < 1) { setDisplayCalories(target); return; }
    const duration = Math.min(600, Math.abs(delta) * 0.8);
    const startTime = performance.now();
    if (calAnimRef.current) cancelAnimationFrame(calAnimRef.current);
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayCalories(Math.round(start + delta * ease));
      if (t < 1) calAnimRef.current = requestAnimationFrame(step);
    };
    calAnimRef.current = requestAnimationFrame(step);
    return () => { if (calAnimRef.current) cancelAnimationFrame(calAnimRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.diary[date], data.profile.calorieTarget, data.dailyLogs[date]?.activities]);

  // GSAP slide-in animation on tab change
  useEffect(() => {
    if (mainRef.current && window.gsap) {
      window.gsap.fromTo(mainRef.current,
        { opacity: 0, y: 16, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: "power3.out" }
      );
    }
  }, [tab]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [results, setResults] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [activityDraft, setActivityDraft] = useState(null);
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
  const [scanPreview, setScanPreview] = useState("");
  const [pendingLogFood, setPendingLogFood] = useState(null);
  const [scanMode, setScanMode] = useState("ai");
  const [cylindrical, setCylindrical] = useState(false);
  const [mealDescription, setMealDescription] = useState("");
  const [aiDailyReview, setAiDailyReview] = useState("");
  const [aiReviewModal, setAiReviewModal] = useState(false);
  const [quickWeightInput, setQuickWeightInput] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const notesSaveTimer = useRef(null);
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
      setCloudHealth({ status: "missing-config", message: "Cloud backup is not available in this copy of PULSE. Your data is still saved on this device." });
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
  const dailyLog = { water: 0, notes: "", activities: [], medsTaken: [], healthFlags: {}, ...(data.dailyLogs[date] || {}) };
  const activityMinutes = (dailyLog.activities || []).reduce((sum, item) => sum + number(item.minutes), 0);
  const activityCalories = (dailyLog.activities || []).reduce((sum, item) => sum + calcBurnedCalories(item.type, number(item.minutes), number(data.profile.weight)), 0);
  const activityMinutesByType = (dailyLog.activities || []).reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + number(item.minutes);
    return acc;
  }, {});
  const remaining = number(data.profile.calorieTarget) - totals.calories;
  const netRemaining = remaining + activityCalories;
  const estimatedDeficit = Math.max(0, netRemaining);

  // Weight progress
  const weightEntries = useMemo(
    () => [...data.measurements].filter((m) => number(m.weight) > 0).sort((a, b) => a.date.localeCompare(b.date)),
    [data.measurements],
  );
  const latestWeight = weightEntries.at(-1);
  const prevWeight = weightEntries.at(-2);
  const stripWeightChange = latestWeight && prevWeight ? round(number(latestWeight.weight) - number(prevWeight.weight)) : null;
  const daysSinceWeigh = latestWeight ? Math.floor((Date.now() - new Date(latestWeight.date).getTime()) / 86_400_000) : null;
  const showWeighReminder = daysSinceWeigh === null || daysSinceWeigh >= 7;

  // Water hint — 35 ml per kg body weight, min 2000
  const bodyWeight = number(latestWeight?.weight || data.profile.weight) || 70;
  const waterHint = Math.round(Math.max(2000, bodyWeight * 35) / 100) * 100;

  // Safe deficit hint — 500 kcal/day ≈ 0.5 kg/week
  const safeDeficitTarget = 500;
  const currentDeficit = netRemaining;
  const deficitStatus = currentDeficit >= safeDeficitTarget
    ? "on track"
    : currentDeficit > 0
    ? "below target"
    : "surplus";
  const caloriePercent = data.profile.calorieTarget
    ? Math.min(100, (totals.calories / number(data.profile.calorieTarget)) * 100)
    : 0;
  const sortedMeasurements = useMemo(
    () => [...data.measurements].sort((a, b) => b.date.localeCompare(a.date)),
    [data.measurements],
  );
  const latestMeasurement = sortedMeasurements[0];
  const medicationList = splitList(data.profile.medications);
  const waterOz = round(number(dailyLog.water) / 29.5735);
  const hydrationTarget = Math.max(1, number(data.profile.waterTarget) + activityMinutes * 12);
  const hydrationPercent = Math.min(100, (number(dailyLog.water) / hydrationTarget) * 100);
  const quickFoods = QUICK_FOOD_IDS.map((id) => STARTER_FOODS.find((food) => food.id === id)).filter(Boolean);
  const localQueryResults = query.trim()
    ? simplifyFoods([
      ...searchSavedFoods(data.customFoods, query),
      ...searchSavedFoods(STARTER_FOODS, query),
    ]).slice(0, 8)
    : [];
  const quickFoodSuggestions = query.trim()
    ? localQueryResults.length
      ? localQueryResults
      : simplifyFoods(searchSavedFoods(results, query)).slice(0, 6)
    : quickFoods;
  const hasLocalResults = localQueryResults.length > 0;
  const coffeeFood = STARTER_FOODS.find((food) => food.id === "starter:black-coffee");
  const coffeeCount = items.filter((item) => /coffee|espresso|cappuccino|latte|flat.?white|americano/i.test(item.name || "")).length;
  const todayMessage = dailyGreeting({ name: data.profile.name, remaining, totals, dailyLog, medicationCount: medicationList.length });
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
    if (message.includes("VITE_SUPABASE") || message.includes("Supabase is not configured")) return "Cloud backup is not available in this copy of PULSE.";
    return message || fallback;
  }

  async function sendCloudLink() {
    if (!supabaseConfig.configured) return flash("Cloud backup is not available in this copy of PULSE.");
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
    if (!supabaseConfig.configured) return flash("Cloud backup is not available in this copy of PULSE.");
    if (!cloudSession?.user?.id) return flash("Sign in before syncing.");
    if (!online) return flash("Offline mode: local changes are saved and will sync when you are online.");
    setSyncing(true);
    if (!quiet) setNotice("Syncing your PULSE data...");
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

  async function setupPin(pin, owner = "") {
    const next = await hashPin(pin);
    const record = { ...next, owner: owner || data.profile.name || "" };
    localStorage.setItem(SECURITY_KEY, JSON.stringify(record));
    setSecurity(record);
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
    const record = { ...next, owner: security?.owner || data.profile.name || "" };
    localStorage.setItem(SECURITY_KEY, JSON.stringify(record));
    setSecurity(record);
    setLocked(false);
    setPinChange({ current: "", next: "", confirm: "" });
    flash(security ? "PIN changed." : "PIN lock created.");
  }

  function updateDailyLog(patch) {
    setData((current) => ({
      ...current,
      dailyLogs: { ...current.dailyLogs, [date]: { water: 0, notes: "", activities: [], medsTaken: [], healthFlags: {}, ...(current.dailyLogs[date] || {}), ...patch } },
    }));
  }

  function addWater(amountMl) {
    updateDailyLog({ water: Math.max(0, number(dailyLog.water) + amountMl) });
    flash(`+${Math.round(amountMl)} ml water.`);
  }

  function logCoffeeDirect() {
    const food = STARTER_FOODS.find((f) => f.id === "starter:espresso") || STARTER_FOODS.find((f) => f.id === "starter:black-coffee");
    if (!food) return;
    saveFoodToDiary(food, food.servingGrams, "Snack");
    // Coffee is a net diuretic — subtract 150ml from hydration
    updateDailyLog({ water: Math.max(0, number(dailyLog.water) - 150) });
  }

  function addActivity(type, minutes = 30) {
    updateDailyLog({
      healthFlags: { ...(dailyLog.healthFlags || {}), normalDay: false, restDay: false },
      activities: [...(dailyLog.activities || []), { id: makeId(), type, minutes }],
    });
    flash(`${type} logged for ${minutes} minutes.`);
  }

  function removeActivity(id) {
    updateDailyLog({ activities: (dailyLog.activities || []).filter((a) => a.id !== id) });
  }

  function openActivity(type, minutes = 30) {
    setActivityDraft({ type, minutes });
  }

  function confirmActivity() {
    if (!activityDraft?.type || number(activityDraft.minutes) <= 0) return flash("Add activity time.");
    addActivity(activityDraft.type, number(activityDraft.minutes));
    setActivityDraft(null);
  }

  function markRestDay() {
    updateDailyLog({ activities: [], healthFlags: { ...(dailyLog.healthFlags || {}), normalDay: false, restDay: true, lowEnergy: false, sick: false } });
    flash("Rest day logged.");
  }

  function setDayMode(mode) {
    const next = { ...(dailyLog.healthFlags || {}), normalDay: false, restDay: false, lowEnergy: false, sick: false };
    next[mode] = true;
    updateDailyLog({ healthFlags: next, activities: mode === "restDay" ? [] : dailyLog.activities });
    flash(mode === "normalDay" ? "Normal day set." : `${mode === "restDay" ? "Rest" : mode === "lowEnergy" ? "Low energy" : "Sick"} day set.`);
  }

  function toggleHealthFlag(key) {
    updateDailyLog({ healthFlags: { ...(dailyLog.healthFlags || {}), [key]: !dailyLog.healthFlags?.[key] } });
  }

  function toggleMedication(name) {
    const current = new Set(dailyLog.medsTaken || []);
    if (current.has(name)) current.delete(name);
    else current.add(name);
    updateDailyLog({ medsTaken: [...current] });
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
    const nextCalories = totals.calories + number(entry.calories);
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
    // Celebrate when hitting calorie goal
    try {
      const goal = number(data.profile.calorieTarget);
      if (goal > 0 && nextCalories >= goal * 0.98 && nextCalories <= goal * 1.05 && window.confetti) {
        window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#FF4500","#FF7A00","#00E5FF","#A78BFA"] });
      }
    } catch {}
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
      const localMatches = simplifyFoods(mergeFoods(saved, cached, starter));
      if (localMatches.length) {
        setResults(localMatches);
        setNotice("");
        return;
      }
      // Open Food Facts is free — no API key needed
      let openFoodFacts = [];
      try {
        const payload = await searchOpenFoodFactsPayload(searchTerm);
        openFoodFacts = (payload.products || []).map(openFoodFactsFood).filter((food) => food.per100.calories > 0);
      } catch (error) {
        if (!localMatches.length) throw error;
      }
      // USDA only called via dedicated button to preserve API quota
      const foods = simplifyFoods(mergeFoods(openFoodFacts));
      setResults(foods);
      if (!foods.length) throw new Error("No foods found. Try the USDA Search button or enter manually.");
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
      const code = barcode.trim();
      const local = [...(data.customFoods || []), ...(data.pantry || [])].find(
        (f) => f.sourceId === code || f.sourceId === `barcode:${code}`,
      );
      if (local) {
        flash("Found in your saved foods!");
        setResults([{ ...local, confidence: local.confidence || "manual" }]);
        return;
      }
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      );
      if (!response.ok) throw new Error("Barcode lookup failed.");
      const payload = await response.json();
      if (payload.status !== 1) {
        setCustom((c) => ({ ...c, sourceId: `barcode:${code}`, name: c.name || "" }));
        throw new Error(`Barcode ${code} not in the database. Fill in the nutrition below and save — next scan will find it instantly.`);
      }
      const food = openFoodFactsFood(payload.product);
      if (!food.per100.calories) throw new Error("Product found, but it has no calorie data. Enter values manually.");
      setResults([food]);
    });
  }

  async function searchUsda() {
    if (!requireQuery()) return;
    setResults([]);
    runRequest("Searching USDA FoodData Central...", async () => {
      const foods = await searchUsdaFoods(query.trim());
      setResults(simplifyFoods(foods));
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

  async function compressImageForOcr(file) {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1800;
    const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  }

  async function scanLabel(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return flash("Choose an image file.");
    setScanPreview(URL.createObjectURL(file));
    setAiPhotoResult("");
    setPendingLogFood(null);
    setBusy(true);
    setOcrProgress(0);
    setNotice("Preprocessing image…");
    try {
      const preprocessed = await preprocessLabel(file, cylindrical);
      setNotice("Running OCR…");
      const worker = await createWorker("eng", 1, {
        logger: (m) => { if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100)); },
      });
      await worker.setParameters({ tessedit_pageseg_mode: "11" });
      const output = await worker.recognize(preprocessed);
      await worker.terminate();
      const parsed = parseNutritionLabel(output.data.text);
      setOcrText(output.data.text);
      const ocrFood = {
        name: "Scanned nutrition label",
        servingGrams: parsed.servingGrams || 100,
        calories: parsed.calories || "",
        protein: parsed.protein || "",
        carbs: parsed.carbs || "",
        fat: parsed.fat || "",
        fiber: parsed.fiber || "",
        confidence: "ocr",
      };
      setCustom((c) => ({ ...c, ...ocrFood }));
      setPendingLogFood(ocrFood);
      setNotice("OCR done — verify every value before saving.");
    } catch {
      setNotice("Could not read label. Try a brighter, straight-on close-up.");
    } finally {
      setBusy(false);
    }
  }


  async function scanBarcodePhoto(file) {
    if (!file) return;
    setScanPreview(URL.createObjectURL(file));
    setBusy(true);
    setNotice("Detecting barcode…");
    try {
      if ("BarcodeDetector" in window) {
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"] });
        const bitmap = await createImageBitmap(file);
        const codes = await detector.detect(bitmap);
        bitmap.close?.();
        if (codes.length) {
          const code = codes[0].rawValue;
          setBarcode(code);
          setNotice(`Barcode ${code} detected — looking up…`);
          await lookupBarcodeValue(code);
          return;
        }
      }
      flash("Could not auto-detect barcode. Enter the number manually below.");
    } catch {
      flash("Barcode scan failed. Enter the number manually.");
    } finally {
      setBusy(false);
    }
  }

  async function lookupBarcodeValue(code) {
    const local = [...(data.customFoods || []), ...(data.pantry || [])].find(
      (f) => f.sourceId === code || f.sourceId === `barcode:${code}`,
    );
    if (local) { flash("Found in your saved foods!"); setResults([{ ...local }]); return; }
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!response.ok) throw new Error("Lookup failed.");
    const payload = await response.json();
    if (payload.status !== 1) {
      setCustom((c) => ({ ...c, sourceId: `barcode:${code}` }));
      flash(`Barcode ${code} not found. Fill nutrition below and save — next scan finds it instantly.`);
      setScanMode("manual");
      return;
    }
    const food = openFoodFactsFood(payload.product);
    if (!food.per100.calories) { flash("Product found but no calorie data. Enter manually."); return; }
    setResults([food]);
  }

  async function analyzeFoodPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return flash("Choose an image file.");
    setScanPreview(URL.createObjectURL(file));
    setBusy(true);
    setNotice("Analysing your food photo with AI…");
    try {
      const optimized = await optimizeImage(file);
      let imageData = optimized.dataUrl;
      if (imageData.length > 3_000_000) {
        const bmp = await createImageBitmap(optimized.blob);
        const ratio = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
        const cvs = document.createElement("canvas");
        cvs.width = Math.round(bmp.width * ratio);
        cvs.height = Math.round(bmp.height * ratio);
        cvs.getContext("2d").drawImage(bmp, 0, 0, cvs.width, cvs.height);
        bmp.close?.();
        imageData = await new Promise((res) => cvs.toBlob((b) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }, "image/jpeg", 0.72));
      }
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "meal-photo",
          image: imageData,
          text: mealDescription.trim() || undefined,
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
      const aiFood = {
        name: parsed.name || mealDescription.trim() || "AI meal estimate",
        servingGrams: 100,
        calories: parsed.calories || "",
        protein: parsed.protein || "",
        carbs: parsed.carbs || "",
        fat: parsed.fat || "",
        fiber: parsed.fiber || "",
        confidence: "ai",
      };
      setCustom((current) => ({ ...current, ...aiFood }));
      setPendingLogFood(aiFood);
      setNotice("AI estimate ready — check values below, then add to your log.");
    } catch (error) {
      flash(friendlyError(error, "Photo analysis failed. Try manual entry instead."));
    } finally {
      setBusy(false);
    }
  }

  function getAiCache() {
    try { return JSON.parse(localStorage.getItem("caltrack.v2.aicache") || "{}"); } catch { return {}; }
  }
  function setAiCache(key, value) {
    try {
      const cache = getAiCache();
      cache[key.toLowerCase().trim()] = { value, ts: Date.now() };
      // Keep only the 100 most recent entries
      const entries = Object.entries(cache).sort((a, b) => b[1].ts - a[1].ts).slice(0, 100);
      localStorage.setItem("caltrack.v2.aicache", JSON.stringify(Object.fromEntries(entries)));
    } catch { /* storage full, skip cache */ }
  }

  async function describeMealToAi() {
    if (!mealDescription.trim()) return flash("Type what you ate first.");
    const cacheKey = mealDescription.toLowerCase().trim();
    // Check cache first — no API call needed if we've seen this before
    const cached = getAiCache()[cacheKey];
    if (cached) {
      const parsed = parseAiNutrition(cached.value);
      setAiPhotoResult(cached.value + "\n(from cache — no API call used)");
      setCustom((current) => ({ ...current, name: parsed.name || mealDescription.trim().slice(0, 60), servingGrams: 100, calories: parsed.calories || "", protein: parsed.protein || "", carbs: parsed.carbs || "", fat: parsed.fat || "", fiber: parsed.fiber || "", confidence: "ai" }));
      flash("Loaded from cache — no AI quota used.");
      return;
    }
    setBusy(true);
    setNotice("AI is estimating your meal…");
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "portion", text: mealDescription.trim(), daily: { totals, calorieTarget: data.profile.calorieTarget } }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "AI request failed.");
      }
      const { analysis } = await response.json();
      setAiCache(cacheKey, analysis);
      const parsed = parseAiNutrition(analysis);
      setAiPhotoResult(analysis);
      setCustom((current) => ({ ...current, name: parsed.name || mealDescription.trim().slice(0, 60), servingGrams: 100, calories: parsed.calories || "", protein: parsed.protein || "", carbs: parsed.carbs || "", fat: parsed.fat || "", fiber: parsed.fiber || "", confidence: "ai" }));
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
      setAiReviewModal(true);
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
    link.download = `pulse-backup-${localDate()}.json`;
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
      flash("That file is not a valid PULSE backup.");
    }
  }

  async function addProgressPhoto(file, view) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return flash("Choose an image file.");
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

  if (locked) return <LockScreen mode={security ? "unlock" : "setup"} onUnlock={unlock} onSetup={setupPin} owner={security?.owner} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <img src={logo2Src} alt="PULSE" className="brand-logo app-logo" />
        {tab === "diary" && <p className="top-message">{todayMessage}</p>}
      </header>

      {tab === "diary" && <section className="calorie-card">
        {/* EKG heartbeat line */}
        <div className="ekg-wrap" aria-hidden="true">
          {/* 1200-unit SVG, 4 QRS beats (2 per 600-unit half) → at 7s animation = ~1 beat every 3.5s */}
          <svg className="ekg-svg" viewBox="0 0 1200 36" xmlns="http://www.w3.org/2000/svg">
            <path className="ekg-path"
              d="M0,18 L110,18 L120,15 L124,21 L128,2 L131,34 L135,7 L142,18 L290,18 L300,15 L304,21 L308,2 L311,34 L315,7 L322,18 L600,18 L710,18 L720,15 L724,21 L728,2 L731,34 L735,7 L742,18 L890,18 L900,15 L904,21 L908,2 L911,34 L915,7 L922,18 L1200,18"/>
          </svg>
        </div>
        <div className="calorie-copy">
          <span className="eyebrow">Today's energy</span>
          <strong className={netRemaining < 0 ? "cal-over" : ""}>{displayCalories}</strong>
          <small>{netRemaining >= 0 ? "kcal left today" : "over target"}</small>
          <div className="calorie-equation"><span>{Math.round(totals.calories)} food</span><i /><span>{number(data.profile.calorieTarget)} plan</span>{activityCalories > 0 && <><i /><span>{activityCalories} burn</span></>}</div>
        </div>
        <CalorieRing
          consumed={Math.round(totals.calories)}
          burned={activityCalories}
          target={number(data.profile.calorieTarget)}
          percent={caloriePercent}
        />
      </section>}

      {tab === "diary" && (
        <WeightJourneyCard
          entries={weightEntries}
          highestWeight={data.profile.highestWeight}
          currentWeight={data.profile.weight}
          goalWeight={number(data.profile.goalWeight) || null}
          quickInput={quickWeightInput}
          setQuickInput={setQuickWeightInput}
          flash={flash}
          setData={setData}
        />
      )}

      {tab === "diary" && (
        <section className="top-vitals">
          <LiquidOrb
            LIcon={Droplets}
            fill={hydrationPercent}
            color="rgba(77,195,255,.7)"
            glow="rgba(77,195,255,.25)"
            label="Water"
            value={`${Math.round(dailyLog.water || 0)} ml`}
            onClick={() => addWater(250)}
          />
          <LiquidOrb
            LIcon={Coffee}
            fill={Math.min(100, coffeeCount * 25)}
            color="rgba(255,140,0,.7)"
            glow="rgba(255,140,0,.25)"
            label="Coffee"
            value={coffeeCount > 0 ? `${coffeeCount} today` : "Tap"}
            onClick={logCoffeeDirect}
            animate={coffeeCount >= 3}
          />
          {ACTIVITY_PRESETS.map((item) => {
            const minutes = activityMinutesByType[item.type] || 0;
            const iconType = item.label === "Swim" ? "swim" : item.label === "Weights" ? "weights" : "walk";
            const active = minutes > 0;
            return (
              <button className={`activity-orb-btn${active ? " activity-active" : ""}`} key={item.type} onClick={() => openActivity(item.type, item.minutes)} aria-label={`Log ${item.label}`}>
                <div className="activity-orb">
                  <MiniIcon type={iconType} size={24} />
                </div>
                <span className="orb-label">{item.label}</span>
                <span className="orb-value">{minutes ? `${minutes}m` : "—"}</span>
              </button>
            );
          })}
        </section>
      )}

      {tab === "diary" && <section className="macro-grid">
        <Macro label="Protein" value={totals.protein} target={data.profile.proteinTarget} tone="protein" />
        <Macro label="Carbs" value={totals.carbs} target={data.profile.carbsTarget} tone="carbs" />
        <Macro label="Fat" value={totals.fat} target={data.profile.fatTarget} tone="fat" />
        <Macro label="Fiber" value={totals.fiber} target={data.profile.fiberTarget} tone="fiber" />
      </section>}

      {tab === "diary" && (
        <div className="hints-strip">
          <div className="hint-pill hint-water">
            💧 Water goal: <strong>{waterHint} ml</strong>
            {dailyLog.water >= waterHint
              ? " ✓ Done!"
              : ` — ${Math.max(0, waterHint - Math.round(dailyLog.water || 0))} ml left`}
          </div>
          <div className={`hint-pill hint-deficit ${deficitStatus === "on track" ? "hint-good" : deficitStatus === "surplus" ? "hint-warn" : ""}`}>
            {deficitStatus === "on track" && "🎯 "}
            {deficitStatus === "surplus" && "⚠️ "}
            {deficitStatus === "below target" && "📉 "}
            Deficit: <strong>{Math.round(currentDeficit)} kcal</strong>
            {deficitStatus === "on track" && " — on pace for ~0.5 kg/wk"}
            {deficitStatus === "surplus" && " — over calories today"}
            {deficitStatus === "below target" && ` — aim for ${safeDeficitTarget} kcal`}
          </div>
          {netRemaining > 0 && (
            <div className="hint-pill">
              🍽️ <strong>{Math.round(netRemaining)} kcal</strong> left to eat today{activityCalories > 0 ? ` (incl. ${activityCalories} burned)` : ""}
            </div>
          )}
          {totals.protein < number(data.profile.proteinTarget) * 0.5 && (
            <div className="hint-pill hint-warn">
              💪 Protein low — need {Math.round(number(data.profile.proteinTarget) - totals.protein)}g more
            </div>
          )}
        </div>
      )}

      {notice && <div className="notice" role="status">{notice}</div>}
      <main ref={mainRef}>
        {tab === "diary" && (
          <section className="panel">
            {isNewUser && (
              <div className="onboarding-card">
                <button className="dismiss-button" aria-label="Dismiss getting started" onClick={dismissOnboarding}>Close</button>
                <span className="eyebrow">Welcome to PULSE</span>
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

            <div className="dashboard-grid dashboard-grid-primary">
              <div className="insight-card calorie-history">
                <div className="insight-heading"><div><span className="eyebrow">Last 7 days</span><h3>Calorie rhythm</h3></div><strong>{Math.round(totals.calories)}<small> kcal today</small></strong></div>
                <CalorieChart diary={data.diary} target={data.profile.calorieTarget} />
              </div>
            </div>

            <div className="quick-hub">
              <div className="quick-card quick-food-card">
                <div className="quick-card-head">
                  <div><span className="eyebrow">Quick food</span><h2>Add what you ate</h2></div>
                  <button className="secondary compact" onClick={() => setTab("add")}>More</button>
                </div>
                <div className="quick-search">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter" && !busy && !hasLocalResults) searchOpenFoodFacts(); }}
                    placeholder="banana, hard boiled egg, chicken..."
                  />
                  {!hasLocalResults && <button className="primary" disabled={busy || !query.trim()} onClick={searchOpenFoodFacts}>Find</button>}
                </div>
                <div className="quick-foods">
                  {quickFoodSuggestions.map((food) => (
                    <button className="quick-chip" key={food.id} onClick={() => openLogFood(food)}>
                      <strong>{cleanFoodName(food.name)}</strong>
                      <span>{Math.round(scaleNutrition(food.per100, food.servingGrams).calories)} kcal</span>
                    </button>
                  ))}
                  {query.trim() && !hasLocalResults && !results.length && !busy && (
                    <button className="quick-chip" style={{ opacity: 0.5 }} onClick={searchOpenFoodFacts}>
                      <strong>Search online</strong>
                      <span>Not in local database</span>
                    </button>
                  )}
                </div>
                {!!results.length && !hasLocalResults && (
                  <div className="quick-results">
                    {results.slice(0, 4).map((food) => (
                      <article className="quick-result-row" key={`${food.source}-${food.id}`}>
                        <button onClick={() => openLogFood(food)}>
                          <strong>{cleanFoodName(food.name)}</strong>
                          <span>{food.brand || food.source} · {Math.round(scaleNutrition(food.per100, food.servingGrams).calories)} kcal typical</span>
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="quick-card health-card">
                <div className="quick-card-head">
                  <div><span className="eyebrow">Health check</span><h2><HeartPulse size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-danger)"}} />Meds & how you feel</h2></div>
                  <button className="secondary compact" onClick={() => setTab("settings")}>Edit meds</button>
                </div>
                {medicationList.length ? (
                  <div className="check-row">
                    {medicationList.map((med) => (
                      <button className={dailyLog.medsTaken?.includes(med) ? "check-pill active" : "check-pill"} key={med} onClick={() => toggleMedication(med)}>
                        {dailyLog.medsTaken?.includes(med) ? "Done" : "Take"} {med}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="helper">Add medications in Profile once, then they become a daily checklist here.</p>
                )}
                <div className="day-mode-row">
                  {HEALTH_FLAGS.map(([key, label, FlagIcon, color, bg]) => {
                    const active = dailyLog.healthFlags?.[key];
                    return (
                      <button
                        key={key}
                        className={`day-mode-pill${active ? " active" : ""}`}
                        onClick={() => setDayMode(key)}
                        style={active ? { "--pill-color": color, "--pill-bg": bg } : {}}
                      >
                        <FlagIcon size={20} strokeWidth={1.7} style={{ color: active ? color : undefined }} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
                <textarea value={dailyLog.notes} onChange={(event) => {
                  updateDailyLog({ notes: event.target.value.slice(0, 2000) });
                  setNotesSaved(false);
                  clearTimeout(notesSaveTimer.current);
                  notesSaveTimer.current = setTimeout(() => setNotesSaved(true), 800);
                }} placeholder="Anything worth remembering today? hunger, sleep, pain, mood..." />
                <div className="notes-save-row">
                  <span className="notes-char">{(dailyLog.notes || "").length}/2000</span>
                  {notesSaved ? <span className="notes-saved">✓ Saved</span> : <span className="notes-autosave">Auto-saves as you type</span>}
                </div>
              </div>
            </div>

            <div className="today-log-card">
              <div>
                <span className="eyebrow crimson">Today logged</span>
                <h2>{items.length ? `${items.length} food ${items.length === 1 ? "entry" : "entries"}` : "Nothing logged yet"}</h2>
                <p>{Math.round(totals.calories)} kcal food · {waterOz || 0} oz water · {activityMinutes || 0} min activity</p>
              </div>
              <button className="secondary compact" onClick={() => setTab("log")}>Open log</button>
            </div>

            {!!coach.length && <details className="coach-card coach-pop">
              <summary><span className="eyebrow">Coach</span><strong>{coach[0].title}</strong><small>Tap for review</small></summary>
              {coach.map((item) => <div className="coach-item" key={item.title}><strong>{item.title}</strong><p>{item.body}</p></div>)}
            </details>}

            <div className="ai-review-section">
              <button className="ai-review-fab" disabled={busy} onClick={getDailyAiReview}>
                {busy ? "⏳ Reviewing…" : "🤖 Review today's intake with AI"}
              </button>
            </div>

          </section>
        )}

        {tab === "log" && (
          <section className="panel stack log-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow crimson">{date === localDate() ? "Today" : date}</span>
                <h2><BookOpen size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-warm)"}} />Daily log</h2>
              </div>
              <button className="primary compact" onClick={() => setTab("add")}>Add food</button>
            </div>
            <div className="log-summary-grid">
              <div><span><Flame size={11} /> Food</span><strong>{Math.round(totals.calories)}</strong></div>
              <div><span><Droplets size={11} /> Water</span><strong>{Math.round(dailyLog.water || 0)} ml</strong></div>
              <div><span><Timer size={11} /> Activity</span><strong>{activityMinutes || 0} min</strong></div>
              <div><span><Zap size={11} /> Burned</span><strong>{activityCalories} kcal</strong></div>
            </div>
            <div className="log-day-card">
              <strong>{dailyLog.healthFlags?.restDay ? "Rest day" : dailyLog.healthFlags?.lowEnergy ? "Low energy day" : dailyLog.healthFlags?.sick ? "Sick day" : "Normal day"}</strong>
              <span>{dailyLog.notes || "No notes yet."}</span>
            </div>
            {medicationList.length > 0 && (
              <div className="log-day-card">
                <strong>Meds</strong>
                <span>{dailyLog.medsTaken?.length ? dailyLog.medsTaken.join(", ") : "Nothing checked off yet."}</span>
              </div>
            )}
            {(dailyLog.activities || []).length > 0 && (
              <div className="meal">
                <div className="meal-heading">
                  <strong><Flame size={13} style={{verticalAlign:"middle",marginRight:4}} />Activities</strong>
                  <span>{activityCalories} kcal burned</span>
                </div>
                {(dailyLog.activities || []).map((act) => {
                  const iconType = /swim/i.test(act.type) ? "swim" : /weight|strength/i.test(act.type) ? "weights" : "walk";
                  return (
                    <article className="food-row activity-row-log" key={act.id}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <MiniIcon type={iconType} size={16} />
                        <div>
                          <strong>{act.type}</strong>
                          <span><Timer size={11} style={{verticalAlign:"middle",marginRight:2}} />{act.minutes} min · ~{calcBurnedCalories(act.type, act.minutes, number(data.profile.weight))} kcal</span>
                        </div>
                      </div>
                      <button className="icon-btn-sm" aria-label={`Remove ${act.type}`} onClick={() => removeActivity(act.id)}><Trash2 size={14} /></button>
                    </article>
                  );
                })}
              </div>
            )}
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
                        <span>{item.grams}g · {item.brand || item.source}</span>
                        <small>P {round(item.protein)} · C {round(item.carbs)} · F {round(item.fat)}</small>
                      </div>
                      <b>{Math.round(item.calories)}</b>
                      <button className="icon-btn-sm" aria-label={`Remove ${item.name}`} onClick={() => removeFood(item.id)}><Trash2 size={14} /></button>
                    </article>
                  ))}
                </div>
              );
            })}
          </section>
        )}

        {tab === "add" && (
          <section className="panel stack add-panel">
            <div className="section-heading">
              <div><span className="eyebrow">Quick add</span><h2><Search size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-good)"}} />What did you eat?</h2></div>
              <button className="secondary compact" onClick={() => setTab("tools")}>Scan / AI</button>
            </div>
            <div className="search-line">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !busy && searchOpenFoodFacts()} placeholder="banana, fried eggs, chicken..." />
              <button className="primary" disabled={busy} onClick={searchOpenFoodFacts}>Find</button>
            </div>
            <div className="barcode-line">
              <input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Enter barcode digits" />
              <button className="secondary" disabled={busy} onClick={lookupBarcode}>Look up barcode</button>
            </div>
            <p className="helper">Simple foods show once. Tap Add, choose amount, done.</p>
            <div className="quick-foods">
              {quickFoodSuggestions.map((food) => (
                <button className="quick-chip" key={food.id} onClick={() => openLogFood(food)}>
                  <strong>{cleanFoodName(food.name)}</strong>
                  <span>{Math.round(scaleNutrition(food.per100, food.servingGrams).calories)} kcal</span>
                </button>
              ))}
            </div>

            <hr />
            <div className="section-heading">
              <div><span className="eyebrow crimson">AI-powered</span><h2><Brain size={18} style={{verticalAlign:"middle",marginRight:6,color:"#a99cff"}} />Describe your meal</h2></div>
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
              <div><span className="eyebrow violet">AI-powered</span><h2><Camera size={18} style={{verticalAlign:"middle",marginRight:6,color:"#4dc3ff"}} />Snap your food</h2></div>
            </div>
            <p className="helper">Take a photo of your meal or plate. AI will estimate the calories and nutrition — you can review and adjust before logging.</p>
            <div className="search-line" style={{marginBottom:8}}>
              <input
                value={mealDescription}
                onChange={(event) => setMealDescription(event.target.value)}
                placeholder="Optional: describe the meal to help AI (e.g. rice and grilled chicken)"
              />
            </div>
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
            {scanPreview && (
              <div className="scan-preview-wrap">
                <img src={scanPreview} alt="Your photo" className="scan-preview-img" />
                <button className="ghost-btn scan-preview-clear" onClick={() => { setScanPreview(""); setAiPhotoResult(""); setPendingLogFood(null); }}>✕ Clear</button>
              </div>
            )}
            {aiPhotoResult && (
              <details className="ai-result" open>
                <summary><strong>AI analysis result</strong></summary>
                <p>{aiPhotoResult}</p>
              </details>
            )}
            {pendingLogFood && (
              <div className="add-to-log-prompt">
                <p><strong>Add "{pendingLogFood.name || "this food"}" to today's log?</strong></p>
                <p className="helper">{pendingLogFood.calories} kcal · P {pendingLogFood.protein || 0}g · C {pendingLogFood.carbs || 0}g · F {pendingLogFood.fat || 0}g</p>
                <div className="prompt-actions">
                  <select value={logForm.meal} onChange={(e) => setLogForm((f) => ({ ...f, meal: e.target.value }))}>
                    {MEALS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <button className="primary" onClick={() => {
                    const food = { id: makeId(), name: pendingLogFood.name || "Scanned food", date: today, meal: logForm.meal, grams: pendingLogFood.servingGrams || 100, confidence: pendingLogFood.confidence || "ai", per100: { calories: pendingLogFood.calories, protein: pendingLogFood.protein || 0, carbs: pendingLogFood.carbs || 0, fat: pendingLogFood.fat || 0, fiber: pendingLogFood.fiber || 0 }, calories: pendingLogFood.calories, protein: pendingLogFood.protein || 0, carbs: pendingLogFood.carbs || 0, fat: pendingLogFood.fat || 0, fiber: pendingLogFood.fiber || 0 };
                    setData((d) => ({ ...d, diary: { ...d.diary, [today]: [...(d.diary[today] || []), food] } }));
                    setPendingLogFood(null);
                    flash(`Added to ${logForm.meal}!`);
                  }}>Yes, add to {logForm.meal}</button>
                  <button className="secondary" onClick={() => setPendingLogFood(null)}>Not now</button>
                </div>
              </div>
            )}

            {!!results.length && <div className="result-list">
              {results.map((food) => (
                <article className="result-card" key={`${food.source}-${food.id}`}>
                  <div>
                    <span className="source">{food.brand || (food.source === "Local database" ? "Common food" : food.source)}</span>
                    <strong>{cleanFoodName(food.name)}</strong>
                    <small>{Math.round(scaleNutrition(food.per100, food.servingGrams).calories)} kcal typical serving</small>
                    <p>P {round(scaleNutrition(food.per100, food.servingGrams).protein)} / C {round(scaleNutrition(food.per100, food.servingGrams).carbs)} / F {round(scaleNutrition(food.per100, food.servingGrams).fat)}</p>
                    <ConfidenceBadge value={food.confidence} />
                    {food.ingredients && <p className="ingredients"><strong>Ingredients:</strong> {food.ingredients}</p>}
                  </div>
                  <button className="primary compact" onClick={() => openLogFood(food)}>Add</button>
                </article>
              ))}
            </div>}

            <details className="manual-entry-drawer">
              <summary>
                <span>Can't find it?</span>
                <strong>Manual food</strong>
              </summary>
              <p className="helper">Use this only when search cannot find the food. Add one serving, then save it for next time.</p>
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
              <button className="primary" onClick={saveCustomFood}>Save food</button>
            </details>

            {!!data.customFoods.length && (
              <details className="manual-entry-drawer saved-foods-drawer">
                <summary>
                  <span>Reusable</span>
                  <strong>Saved foods</strong>
                </summary>
                <div className="saved-foods">
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
              </details>
            )}
          </section>
        )}

        {tab === "tools" && (
          <section className="panel stack tools-panel">

            {/* ── Scan hub ── */}
            <div className="scan-hub">
              <div className="scan-mode-tabs">
                {[
                  { id: "ai",      icon: "🤖", label: "AI Photo",  sub: "Meal estimate" },
                  { id: "ocr",     icon: "📄", label: "OCR Label", sub: "Packaged food" },
                  { id: "barcode", icon: "🔢", label: "Barcode",   sub: "Scan & find"  },
                  { id: "manual",  icon: "✏️", label: "Manual",    sub: "Type it in"   },
                ].map((m) => (
                  <button key={m.id} className={`scan-mode-btn${scanMode === m.id ? " active" : ""}`} onClick={() => { setScanMode(m.id); setScanPreview(""); setAiPhotoResult(""); setPendingLogFood(null); setResults([]); }}>
                    <span className="scan-mode-icon">{m.icon}</span>
                    <span className="scan-mode-label">{m.label}</span>
                    <span className="scan-mode-sub">{m.sub}</span>
                  </button>
                ))}
              </div>

              {/* AI Photo mode */}
              {scanMode === "ai" && (
                <div className="scan-panel">
                  <p className="helper">Take or upload a photo of your meal — AI estimates calories and all macros.</p>
                  <input className="scan-hint-input" value={mealDescription} onChange={(e) => setMealDescription(e.target.value)} placeholder="Optional hint: nasi lemak, teh tarik…" />
                  <div className="scanner-actions">
                    <label className="primary file-button">📷 Camera<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => analyzeFoodPhoto(e.target.files?.[0])} /></label>
                    <label className="secondary file-button">🖼 Gallery<input type="file" accept="image/*" disabled={busy} onChange={(e) => analyzeFoodPhoto(e.target.files?.[0])} /></label>
                  </div>
                  {busy && <p className="notice-inline">{notice}</p>}
                  {scanPreview && <div className="scan-preview-wrap"><img src={scanPreview} alt="" className="scan-preview-img" /><button className="scan-preview-clear" onClick={() => { setScanPreview(""); setAiPhotoResult(""); setPendingLogFood(null); }}>✕</button></div>}
                  {aiPhotoResult && <details className="ai-result" open><summary><strong>AI result</strong></summary><p>{aiPhotoResult}</p></details>}
                </div>
              )}

              {/* OCR Label mode */}
              {scanMode === "ocr" && (
                <div className="scan-panel">
                  <p className="helper">Point camera at any nutrition label — reads locally, no internet needed.</p>
                  <label className="cylindrical-toggle">
                    <input type="checkbox" checked={cylindrical} onChange={(e) => setCylindrical(e.target.checked)} />
                    <span>Cylindrical label (can / bottle)</span>
                  </label>
                  <div className="scanner-actions">
                    <label className="primary file-button">📷 Take label photo<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => scanLabel(e.target.files?.[0])} /></label>
                    <label className="secondary file-button">🖼 Gallery<input type="file" accept="image/*" disabled={busy} onChange={(e) => scanLabel(e.target.files?.[0])} /></label>
                  </div>
                  {busy && <><p className="notice-inline">{notice}</p>{ocrProgress > 0 && <div className="ocr-progress"><div className="progress-track"><i style={{width:`${Math.max(ocrProgress,3)}%`}} /></div><span>{ocrProgress}%</span></div>}</>}
                  {scanPreview && <div className="scan-preview-wrap"><img src={scanPreview} alt="" className="scan-preview-img" /><button className="scan-preview-clear" onClick={() => { setScanPreview(""); setAiPhotoResult(""); setPendingLogFood(null); setOcrText(""); }}>✕</button></div>}
                  {!busy && pendingLogFood && (
                    <div className="ocr-result-card">
                      <p className="ocr-result-title">Parsed values — edit anything wrong:</p>
                      <div className="form-grid" style={{marginTop:8}}>
                        <Field label="Calories" suffix="kcal" type="number" value={custom.calories} onChange={(e) => { updateCustom({ calories: e.target.value }); setPendingLogFood((f) => f ? { ...f, calories: e.target.value } : f); }} />
                        <Field label="Protein" suffix="g" type="number" value={custom.protein} onChange={(e) => { updateCustom({ protein: e.target.value }); setPendingLogFood((f) => f ? { ...f, protein: e.target.value } : f); }} />
                        <Field label="Carbs" suffix="g" type="number" value={custom.carbs} onChange={(e) => { updateCustom({ carbs: e.target.value }); setPendingLogFood((f) => f ? { ...f, carbs: e.target.value } : f); }} />
                        <Field label="Fat" suffix="g" type="number" value={custom.fat} onChange={(e) => { updateCustom({ fat: e.target.value }); setPendingLogFood((f) => f ? { ...f, fat: e.target.value } : f); }} />
                      </div>
                    </div>
                  )}
                  {!busy && ocrText && (
                    <details className="ocr-raw-details">
                      <summary>Raw OCR text (tap to expand)</summary>
                      <pre className="ocr-raw-text">{ocrText}</pre>
                    </details>
                  )}
                  {!busy && !pendingLogFood && notice && <p className="notice-inline">{notice}</p>}
                </div>
              )}

              {/* Barcode mode */}
              {scanMode === "barcode" && (
                <div className="scan-panel">
                  <p className="helper">Take a photo of the barcode — we'll read the number for you. Or type it in directly.</p>
                  <label className="primary file-button barcode-photo-btn">
                    📷 Take barcode photo
                    <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => scanBarcodePhoto(e.target.files?.[0])} />
                  </label>
                  {busy && <p className="notice-inline">{notice}</p>}
                  <p className="scan-divider">— barcode number —</p>
                  <div className="barcode-line">
                    <input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupBarcode()} placeholder="e.g. 9556007120028" />
                    <button className="primary" disabled={busy || !barcode} onClick={lookupBarcode}>Find</button>
                  </div>
                  {!!results.length && <div className="result-list">{results.slice(0,6).map((food) => (<article className="result-card" key={`${food.source}-${food.id}`}><div><span className="source">{food.brand||food.source}</span><strong>{cleanFoodName(food.name)}</strong><small>{Math.round(scaleNutrition(food.per100,food.servingGrams).calories)} kcal</small></div><button className="primary compact" onClick={() => openLogFood(food)}>Add</button></article>))}</div>}
                </div>
              )}

              {/* Manual mode */}
              {scanMode === "manual" && (
                <div className="scan-panel">
                  <p className="helper">Can't find the food anywhere? Enter the values from the label and save for next time.</p>
                  <div className="form-grid">
                    <Field label="Food name" value={custom.name} onChange={(e) => updateCustom({ name: e.target.value })} />
                    <Field label="Brand (optional)" value={custom.brand} onChange={(e) => updateCustom({ brand: e.target.value })} />
                    <Field label="Serving size" suffix="g" type="number" min="0" value={custom.servingGrams} onChange={(e) => updateCustom({ servingGrams: e.target.value })} />
                    <Field label="Calories" suffix="kcal" type="number" min="0" value={custom.calories} onChange={(e) => updateCustom({ calories: e.target.value })} />
                    <Field label="Protein" suffix="g" type="number" min="0" value={custom.protein} onChange={(e) => updateCustom({ protein: e.target.value })} />
                    <Field label="Carbs" suffix="g" type="number" min="0" value={custom.carbs} onChange={(e) => updateCustom({ carbs: e.target.value })} />
                    <Field label="Fat" suffix="g" type="number" min="0" value={custom.fat} onChange={(e) => updateCustom({ fat: e.target.value })} />
                    <Field label="Fiber" suffix="g" type="number" min="0" value={custom.fiber} onChange={(e) => updateCustom({ fiber: e.target.value })} />
                  </div>
                  <div className="scanner-actions">
                    <button className="primary" onClick={saveCustomFood}>Save food</button>
                    <button className="secondary" onClick={() => { if (!custom.name||!custom.calories) return flash("Enter at least name and calories."); const food={id:makeId(),name:custom.name,date:today,meal:logForm.meal,grams:number(custom.servingGrams)||100,confidence:"manual",per100:{calories:number(custom.calories),protein:number(custom.protein),carbs:number(custom.carbs),fat:number(custom.fat),fiber:number(custom.fiber)},calories:number(custom.calories),protein:number(custom.protein),carbs:number(custom.carbs),fat:number(custom.fat),fiber:number(custom.fiber)};setData((d)=>({...d,diary:{...d.diary,[today]:[...(d.diary[today]||[]),food]}}));flash(`Added to ${logForm.meal}!`); }}>Add to {logForm.meal}</button>
                  </div>
                </div>
              )}

              {/* shared add-to-log prompt shown in AI + OCR modes */}
              {(scanMode === "ai" || scanMode === "ocr") && pendingLogFood && pendingLogFood.calories && (
                <div className="add-to-log-prompt">
                  <p><strong>Add "{pendingLogFood.name || "this food"}" to today's log?</strong></p>
                  <p className="helper">{pendingLogFood.calories} kcal · P {pendingLogFood.protein||0}g · C {pendingLogFood.carbs||0}g · F {pendingLogFood.fat||0}g</p>
                  <div className="prompt-actions">
                    <select value={logForm.meal} onChange={(e) => setLogForm((f) => ({...f,meal:e.target.value}))}>{MEALS.map((m)=><option key={m}>{m}</option>)}</select>
                    <button className="primary" onClick={() => { const food={id:makeId(),name:pendingLogFood.name||"Scanned food",date:today,meal:logForm.meal,grams:pendingLogFood.servingGrams||100,confidence:pendingLogFood.confidence||"ai",per100:{calories:pendingLogFood.calories,protein:pendingLogFood.protein||0,carbs:pendingLogFood.carbs||0,fat:pendingLogFood.fat||0,fiber:pendingLogFood.fiber||0},calories:pendingLogFood.calories,protein:pendingLogFood.protein||0,carbs:pendingLogFood.carbs||0,fat:pendingLogFood.fat||0,fiber:pendingLogFood.fiber||0};setData((d)=>({...d,diary:{...d.diary,[today]:[...(d.diary[today]||[]),food]}}));setPendingLogFood(null);flash(`Added to ${logForm.meal}!`); }}>✓ Add to {logForm.meal}</button>
                    <button className="secondary" onClick={() => setPendingLogFood(null)}>Not now</button>
                  </div>
                </div>
              )}
            </div>

            <details className="tool-card package-card tool-drawer">
            <summary>
              <div><span className="eyebrow crimson">Label calc</span><strong><Package size={15} style={{verticalAlign:"middle",marginRight:5,color:"var(--accent-warm)"}} />Packaged food amount</strong></div>
            </summary>
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
            </details>

          </section>
        )}

        {tab === "coach" && (
          <section className="panel stack">
            <div className="section-heading"><div><span className="eyebrow">Nutrition coach</span><h2><ChefHat size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-good)"}} />Pantry & smart recipes</h2></div></div>
            <div className="coach-card">
              <span className="eyebrow violet">Today</span>
              <h2>Data-based guidance</h2>
              {coach.length ? coach.map((item) => <div className="coach-item" key={item.title}><strong>{item.title}</strong><p>{item.body}</p></div>) : <p className="helper">Today's log is on track based on your current goals.</p>}
              <div className="coach-item"><strong>Pantry ideas</strong><p>{data.pantry.length ? data.pantry.slice(0, 4).map((item) => item.name).join(", ") : "Save pantry ingredients from search, barcode, USDA, or manual entries to get useful suggestions."}</p></div>
            </div>

            <div className="tool-card pantry-card">
              <div className="section-heading"><div><span className="eyebrow crimson">What's in your kitchen</span><h2><ClipboardList size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-warm)"}} />Pantry</h2></div></div>
              <p className="helper">Just type what you have — nutrition is optional. You can fill it in later.</p>
              <div className="form-grid">
                <Field label="Ingredient name" value={pantryDraft.name} onChange={(event) => setPantryDraft({ ...pantryDraft, name: event.target.value })} />
                <Field label="Default serving" suffix="g" type="number" min="1" value={pantryDraft.grams} onChange={(event) => setPantryDraft({ ...pantryDraft, grams: event.target.value })} />
              </div>
              <details className="manual-entry-drawer pantry-nutrition-drawer">
                <summary>
                  <span>Optional</span>
                  <strong>Add nutrition</strong>
                </summary>
                <div className="form-grid">
                <Field label="Calories (optional)" suffix="kcal" type="number" min="0" value={pantryDraft.calories} onChange={(event) => setPantryDraft({ ...pantryDraft, calories: event.target.value })} />
                <Field label="Protein (optional)" suffix="g" type="number" min="0" value={pantryDraft.protein} onChange={(event) => setPantryDraft({ ...pantryDraft, protein: event.target.value })} />
                <Field label="Carbs (optional)" suffix="g" type="number" min="0" value={pantryDraft.carbs} onChange={(event) => setPantryDraft({ ...pantryDraft, carbs: event.target.value })} />
                <Field label="Fat (optional)" suffix="g" type="number" min="0" value={pantryDraft.fat} onChange={(event) => setPantryDraft({ ...pantryDraft, fat: event.target.value })} />
                </div>
              </details>
              <button className="primary" onClick={saveManualPantry}>{editingPantryId ? "Update ingredient" : "Add to pantry"}</button>
              <div className="pantry-list">{data.pantry.map((item) => <article className="food-row" key={item.id}><div><strong>{item.name}</strong><span>{item.source} - {item.defaultGrams}g default</span><ConfidenceBadge value={item.confidence} /></div><b>{scaleNutrition(item.per100, item.defaultGrams).calories} kcal</b><div className="row-actions"><button className="text-button" onClick={() => editPantry(item)}>Edit</button><button className="text-button danger-text" onClick={() => deletePantry(item.id)}>Delete</button></div></article>)}</div>
            </div>

            <details className="tool-card recipe-builder-card">
              <summary>
                <span>Optional</span>
                <strong>Recipe builder</strong>
              </summary>
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
            </details>

          </section>
        )}

        {tab === "progress" && (
          <section className="panel stack">
            <div className="section-heading"><div><span className="eyebrow">By date</span><h2><Scale size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-good)"}} />Weight & waist</h2></div></div>
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
              <div className="section-heading"><div><span className="eyebrow violet">Stored locally</span><h2><Camera size={18} style={{verticalAlign:"middle",marginRight:6,color:"#a99cff"}} />Progress photos</h2></div></div>
              <p className="helper">Save front, side, and optional back photos. Images are limited to 1.5 MB each and included in backups.</p>
              <div className="photo-actions">{["Front", "Side", "Back"].map((view) => <label className="secondary file-button" key={view}>{view}<input type="file" accept="image/*" capture="environment" onChange={(event) => addProgressPhoto(event.target.files?.[0], view)} /></label>)}</div>
              <div className="photo-grid">{data.progressPhotos.map((photo) => <figure key={photo.id}><img src={photo.dataUrl} alt={`${photo.view} progress on ${photo.date}`} /><figcaption>{photo.view} - {photo.date}</figcaption></figure>)}</div>
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="panel stack">
            <div className="section-heading"><div><span className="eyebrow">Your profile</span><h2><User size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-good)"}} />Settings</h2></div></div>
            <div className="today-log-card profile-shortcut-card">
              <div>
                <span className="eyebrow violet">Home food ideas</span>
                <h2>Pantry & recipes</h2>
                <p>Keep a simple list of what you have at home, then use it when you want meal ideas.</p>
              </div>
              <button className="secondary compact" onClick={() => setTab("coach")}>Open</button>
            </div>

            <div className="tool-card profile-card">
              <div className="section-heading"><div><span className="eyebrow crimson">Step 1 — About you</span><h2><User size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-warm)"}} />Personal profile</h2></div></div>
              <p className="helper">Your stats calculate calorie and macro targets using the Mifflin-St Jeor formula — the same one dietitians use. Leave blank if you prefer to set targets manually.</p>
              <div className="form-grid">
                <Field label="Your name" value={data.profile.name || ""} onChange={(event) => setProfile({ name: event.target.value })} />
                <label className="field"><span>Biological sex</span><select value={data.profile.gender || ""} onChange={(event) => setProfile({ gender: event.target.value })}><option value="">Select…</option><option value="male">Male</option><option value="female">Female</option></select></label>
                <Field label="Age" suffix="yrs" type="number" min="10" max="120" value={data.profile.age || ""} onChange={(event) => setProfile({ age: number(event.target.value) })} />
                <Field label="Height" suffix="cm" type="number" min="100" max="250" value={data.profile.height || ""} onChange={(event) => setProfile({ height: number(event.target.value) })} />
                <Field label="Current weight" suffix="kg" type="number" min="30" step="0.1" value={data.profile.weight || ""} onChange={(event) => setProfile({ weight: event.target.value })} />
                <Field label="Highest ever weight" suffix="kg" type="number" min="30" step="0.1" value={data.profile.highestWeight || ""} onChange={(event) => setProfile({ highestWeight: event.target.value })} />
                <Field label="Goal weight" suffix="kg" type="number" min="30" step="0.1" value={data.profile.goalWeight || ""} onChange={(event) => setProfile({ goalWeight: event.target.value })} />
                <label className="field"><span>Activity level</span><select value={data.profile.activityLevel || "sedentary"} onChange={(event) => setProfile({ activityLevel: event.target.value })}><option value="sedentary">Sedentary (desk job, little exercise)</option><option value="light">Light active (1-3 workouts/week)</option><option value="moderate">Moderately active (3-5 workouts/week)</option><option value="active">Very active (6-7 workouts/week)</option><option value="very_active">Extra active (physical job + training)</option></select></label>
                <label className="field" style={{gridColumn:"1/-1"}}><span>Medical conditions / health notes</span><textarea value={data.profile.medicalConditions || ""} onChange={(event) => setProfile({ medicalConditions: event.target.value })} placeholder="e.g. Type 2 diabetes, hypertension, high cholesterol, PCOS, thyroid condition..." /></label>
                <label className="field" style={{gridColumn:"1/-1"}}><span>Medications / supplements checklist</span><textarea value={data.profile.medications || ""} onChange={(event) => setProfile({ medications: event.target.value })} placeholder="One per line, e.g. Metformin, Vitamin D, Fish oil..." /></label>
              </div>
              {calcBMR(data.profile) > 0 && (
                <div className="calculation bmr-result">
                  <div><span>Your BMR (at rest)</span><strong>{calcBMR(data.profile)} kcal</strong></div>
                  <div><span>Maintenance calories (TDEE)</span><strong>{calcTDEE(data.profile)} kcal</strong></div>
                  <div><span>For weight loss (−500 kcal)</span><strong>{Math.max(1200, calcTDEE(data.profile) - 500)} kcal</strong></div>
                </div>
              )}
              <button className="primary" onClick={() => {
                const tdee = calcTDEE(data.profile);
                if (!tdee) { flash("Fill in sex, age, height, and weight to auto-calculate."); return; }
                const w = number(data.profile.weight);
                const cal = data.profile.goalWeight && number(data.profile.goalWeight) < w ? Math.max(1200, tdee - 500) : tdee;
                const proteinG = Math.round(w * 1.8);
                const fatG = Math.round(cal * 0.28 / 9);
                const carbsG = Math.max(50, Math.round((cal - proteinG * 4 - fatG * 9) / 4));
                setProfile({ calorieTarget: cal, proteinTarget: proteinG, carbsTarget: carbsG, fatTarget: fatG, fiberTarget: 30 });
                flash("Targets calculated from your profile and goal weight.");
              }}>Calculate my targets automatically</button>
            </div>

            <div className="tool-card">
              <div className="section-heading"><div><span className="eyebrow violet">Step 2 — Daily goals</span><h2><SlidersHorizontal size={18} style={{verticalAlign:"middle",marginRight:6,color:"#a99cff"}} />Nutrition targets</h2></div></div>
              <p className="helper">Auto-calculated above, or set manually here.</p>
              <div className="form-grid">
                <Field label="Daily calorie goal" suffix="kcal" type="number" min="0" value={data.profile.calorieTarget} onChange={(event) => setProfile({ calorieTarget: number(event.target.value) })} />
                <Field label="Protein goal" suffix="g" type="number" min="0" value={data.profile.proteinTarget} onChange={(event) => setProfile({ proteinTarget: number(event.target.value) })} />
                <Field label="Carbs goal" suffix="g" type="number" min="0" value={data.profile.carbsTarget} onChange={(event) => setProfile({ carbsTarget: number(event.target.value) })} />
                <Field label="Fat goal" suffix="g" type="number" min="0" value={data.profile.fatTarget} onChange={(event) => setProfile({ fatTarget: number(event.target.value) })} />
                <Field label="Fiber goal" suffix="g" type="number" min="0" value={data.profile.fiberTarget} onChange={(event) => setProfile({ fiberTarget: number(event.target.value) })} />
                <Field label="Water goal" suffix="ml" type="number" min="0" value={data.profile.waterTarget} onChange={(event) => setProfile({ waterTarget: number(event.target.value) })} />
                <Field label="Session timeout" suffix="minutes" type="number" min="1" max="240" value={data.profile.sessionTimeout} onChange={(event) => setProfile({ sessionTimeout: Math.min(240, Math.max(1, number(event.target.value))) })} />
              </div>
            </div>
            <div className="tool-card cloud-card">
              <div className="section-heading">
                <div><span className="eyebrow violet">Optional backup</span><h2><Activity size={18} style={{verticalAlign:"middle",marginRight:6,color:"#a99cff"}} />Cloud backup</h2></div>
                <span className="feature-badge">{!supabaseConfig.configured ? "Local only" : cloudHealth.status === "authenticated" ? "Signed in" : cloudHealth.status === "reachable" ? "Ready" : cloudHealth.status === "offline" ? "Offline" : cloudHealth.status === "error" ? "Needs attention" : "Checking"}</span>
              </div>
              <p className="helper">
                Your data is saved on this device first. Cloud backup is optional and never deletes your local data during setup.
              </p>
              {!supabaseConfig.configured && (
                <div className="cloud-health"><strong>Local backup mode</strong><span>Cloud backup is not available in this copy of PULSE. Export a backup file any time below.</span></div>
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
              <div className="section-heading"><div><span className="eyebrow crimson">Privacy</span><h2><Stethoscope size={18} style={{verticalAlign:"middle",marginRight:6,color:"var(--accent-danger)"}} />{security ? "Change PIN" : "Optional PIN lock"}</h2></div>{security && <button className="secondary compact" onClick={() => setLocked(true)}>Lock now</button>}</div>
              <div className="form-grid">{security && <Field label="Current PIN" type="password" inputMode="numeric" value={pinChange.current} onChange={(event) => setPinChange({ ...pinChange, current: event.target.value.replace(/\D/g, "") })} />}<Field label="New PIN" type="password" inputMode="numeric" value={pinChange.next} onChange={(event) => setPinChange({ ...pinChange, next: event.target.value.replace(/\D/g, "") })} /><Field label="Confirm new PIN" type="password" inputMode="numeric" value={pinChange.confirm} onChange={(event) => setPinChange({ ...pinChange, confirm: event.target.value.replace(/\D/g, "") })} /></div>
              <button className="primary" onClick={changePin}>{security ? "Change PIN" : "Create PIN lock"}</button>
            </div>
            <div className="settings-actions">
              <button className="secondary" onClick={exportData}>Export backup</button>
              <button className="secondary" onClick={() => importRef.current?.click()}>Import backup</button>
              <input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => importData(event.target.files?.[0])} />
              <button className="danger-button" onClick={() => {
                if (window.confirm("Delete all PULSE data stored in this browser?")) setData(defaultData);
              }}>Delete all local data</button>
            </div>
            <div className="helper" style={{fontSize:"11px",padding:"0 4px"}}>Your data lives on this device. Cloud backup is optional. The PIN is a screen lock only.</div>
          </section>
        )}
      </main>

      {/* AI Daily Review modal */}
      {aiReviewModal && (
        <div className="modal-backdrop" onClick={() => setAiReviewModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="eyebrow violet">AI-powered</span>
              <h2>Today's review</h2>
              <button className="modal-close" onClick={() => setAiReviewModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{aiDailyReview}</p>
            </div>
            <div className="modal-footer">
              <button className="secondary" onClick={() => { setAiReviewModal(false); getDailyAiReview(); }}>Refresh</button>
              <button className="primary" onClick={() => setAiReviewModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Primary navigation">
        {[
          ["diary", "Today", <CalendarDays size={22} strokeWidth={1.8} />],
          ["add", "Add", <Plus size={24} strokeWidth={2} />],
          ["tools", "Scan", <ScanLine size={20} strokeWidth={1.8} />],
          ["log", "Log", <List size={20} strokeWidth={1.8} />],
          ["progress", "Progress", <Activity size={20} strokeWidth={1.8} />],
          ["settings", "Profile", <User size={20} strokeWidth={1.8} />],
        ].map(([key, label, icon]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {selectedFood && (
        <div className="modal-backdrop" onClick={() => setSelectedFood(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="log-food-title" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">Add to today</span>
            <h2 id="log-food-title">{cleanFoodName(selectedFood.name)}</h2>
            <p className="helper">{selectedFood.brand || (selectedFood.source === "Local database" ? "Common food" : selectedFood.source)} · adjust the amount if needed.</p>
            <div className="portion-actions">
              <button className="secondary" onClick={() => setLogForm((current) => ({ ...current, grams: round((selectedFood.servingGrams || 100) / 2) }))}>Half</button>
              <button className="secondary" onClick={() => setLogForm((current) => ({ ...current, grams: selectedFood.servingGrams || 100 }))}>Typical</button>
              <button className="secondary" onClick={() => setLogForm((current) => ({ ...current, grams: round((selectedFood.servingGrams || 100) * 2) }))}>Double</button>
            </div>
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
              <button className="primary" onClick={confirmSelectedFood}>Add to today</button>
            </div>
          </section>
        </div>
      )}

      {activityDraft && (
        <div className="modal-backdrop" onClick={() => setActivityDraft(null)}>
          <section className="modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-title" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">{activityDraft.type}</span>
            <h2 id="activity-title">How long?</h2>
            <div className="duration-dial">
              {[10, 15, 20, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  className={`dial-option${number(activityDraft.minutes) === min ? " dial-active" : ""}`}
                  onClick={() => setActivityDraft((c) => ({ ...c, minutes: min }))}
                >{min}<small>min</small></button>
              ))}
            </div>
            <div className="duration-custom">
              <label className="duration-custom-label">Or enter minutes:</label>
              <input
                type="number"
                min="1"
                max="300"
                className="duration-custom-input"
                value={activityDraft.minutes}
                onChange={(e) => setActivityDraft((c) => ({ ...c, minutes: Math.max(1, Math.min(300, parseInt(e.target.value) || 1)) }))}
              />
              <span className="duration-custom-unit">min</span>
            </div>
            <div className="dial-burn">
              <Flame size={16} style={{ color: "var(--accent-warm)", verticalAlign: "middle", marginRight: 4 }} />
              <span>~{calcBurnedCalories(activityDraft.type, number(activityDraft.minutes), number(data.profile.weight))} kcal burned → adds to your calorie budget</span>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setActivityDraft(null)}>Cancel</button>
              <button className="primary" onClick={confirmActivity}>Log it</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function AppV2() {
  return <ErrorBoundary><AppV2Inner /></ErrorBoundary>;
}
