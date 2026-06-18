import { isSupabaseConfigured, supabase } from "./lib/supabase";

export const SUPABASE_SYNC_KEY = "caltrack.v2.supabase.sync";
const BUCKET = "progress-photos";
const PHOTO_MAX_DIMENSION = 1280;
const THUMB_MAX_DIMENSION = 320;

export const supabaseConfig = {
  configured: isSupabaseConfigured,
};

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const round = (value) => Math.round((number(value) + Number.EPSILON) * 10) / 10;

function readSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(SUPABASE_SYNC_KEY)) || {};
  } catch {
    return {};
  }
}

function writeSyncMeta(meta) {
  localStorage.setItem(SUPABASE_SYNC_KEY, JSON.stringify(meta));
}

function assertConfigured() {
  if (!supabase) throw new Error("Cloud backup is not available in this copy of PULSE.");
}

function throwIfError(error, fallback = "Supabase request failed.") {
  if (error) throw new Error(error.message || fallback);
}

function friendlySupabaseError(error) {
  if (error?.message === "Failed to fetch" || error instanceof TypeError) {
    return new Error(
      "Cloud backup could not connect. Your local data is still safe on this device.",
    );
  }
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const code = String(error?.code || "");
  const combined = `${message} ${details} ${code}`.toLowerCase();
  if (combined.includes("could not find the table") || code === "PGRST205") {
    return new Error("Cloud backup is not ready yet. Your local data is still safe on this device.");
  }
  if (combined.includes("permission denied") || combined.includes("grant") || code === "42501") {
    return new Error("Cloud backup is not ready yet. Your local data is still safe on this device.");
  }
  if (combined.includes("bucket") && combined.includes("not found")) {
    return new Error("Cloud photo backup is not ready yet. Your local photos are still safe on this device.");
  }
  return error;
}

export async function checkSupabaseConnection() {
  assertConfigured();
  try {
    const { data, error } = await supabase.auth.getSession();
    throwIfError(error, "Could not reach Supabase Auth.");
    if (!data.session) {
      return {
        ok: true,
        authenticated: false,
        databaseReady: null,
        storageReady: null,
        session: null,
        message: "Supabase Auth is reachable. Sign in to verify database sync access.",
      };
    }

    const userId = data.session.user?.id;
    const profileResult = await supabase.from("profiles").select("id").limit(1);
    if (profileResult.error) throw profileResult.error;

    const storageResult = await supabase.storage.from(BUCKET).list(`${userId}`, { limit: 1 });
    if (storageResult.error) throw storageResult.error;

    return {
      ok: true,
      authenticated: true,
      databaseReady: true,
      storageReady: true,
      session: data.session,
      message: "Supabase Auth, PULSE tables, and private photo storage are reachable for this session.",
    };
  } catch (error) {
    throw friendlySupabaseError(error);
  }
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  throwIfError(error, "Could not read Supabase session.");
  if (!data.session) return null;
  const userResult = await supabase.auth.getUser();
  throwIfError(userResult.error, "Could not read Supabase user.");
  return { ...data.session, user: userResult.data.user };
}

export async function signInWithPassword(email, password) {
  assertConfigured();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, session: data.session, user: data.user };
  } catch (error) {
    const friendly = friendlySupabaseError(error);
    return { ok: false, error: friendly.message || "Could not sign in." };
  }
}

export async function createAccountWithPassword(email, password) {
  assertConfigured();
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      session: data.session,
      user: data.user,
      needsConfirmation: Boolean(data.user && !data.session),
    };
  } catch (error) {
    const friendly = friendlySupabaseError(error);
    return { ok: false, error: friendly.message || "Could not create account." };
  }
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  throwIfError(error, "Could not sign out.");
}

function idsFor(data) {
  return {
    diary_entries: Object.values(data.diary || {}).flat().map((item) => item.id),
    daily_logs: Object.keys(data.dailyLogs || {}),
    measurements: (data.measurements || []).map((item) => item.id),
    custom_foods: (data.customFoods || []).map((item) => item.id),
    pantry_items: (data.pantry || []).map((item) => item.id),
    recipes: (data.recipes || []).map((item) => item.id),
    recipe_items: (data.recipes || []).flatMap((recipe) => (recipe.items || []).map((item) => `${recipe.id}:${item.recipeItemId || item.id}`)),
    progress_photos: (data.progressPhotos || []).map((item) => item.id),
  };
}

async function softDeleteMissing(table, previousIds = [], currentIds = []) {
  const missing = previousIds.filter((id) => !currentIds.includes(id));
  if (!missing.length) return;
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).in("local_id", missing);
  throwIfError(error, `Could not sync deleted ${table}.`);
}

async function upsert(table, rows, options = { onConflict: "user_id,local_id" }) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, options);
  throwIfError(error, `Could not sync ${table}.`);
}

async function selectActive(table) {
  const { data, error } = await supabase.from(table).select("*").is("deleted_at", null);
  throwIfError(error, `Could not load ${table}.`);
  return data || [];
}

function dataUrlToBlob(dataUrl) {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image conversion failed."))), "image/webp", quality);
  });
}

async function drawOptimized(source, maxDimension, quality) {
  const bitmap = await createImageBitmap(source);
  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await canvasToBlob(canvas, quality);
  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl, width, height };
}

export async function optimizeImage(input) {
  const source = typeof input === "string" ? dataUrlToBlob(input) : input;
  const full = await drawOptimized(source, PHOTO_MAX_DIMENSION, 0.84);
  const thumbnail = await drawOptimized(full.blob, THUMB_MAX_DIMENSION, 0.72);
  return {
    blob: full.blob,
    dataUrl: full.dataUrl,
    width: full.width,
    height: full.height,
    thumbnailBlob: thumbnail.blob,
    thumbnailDataUrl: thumbnail.dataUrl,
  };
}

async function uploadPhoto(userId, photo) {
  if (!photo.dataUrl && photo.storagePath) return photo;
  const optimized = await optimizeImage(photo.dataUrl);
  const basePath = `${userId}/progress/${photo.id}`;
  const storagePath = `${basePath}.webp`;
  const thumbnailPath = `${basePath}-thumb.webp`;
  const fullResult = await supabase.storage.from(BUCKET).upload(storagePath, optimized.blob, {
    contentType: "image/webp",
    upsert: true,
  });
  throwIfError(fullResult.error, "Could not upload progress photo.");
  const thumbResult = await supabase.storage.from(BUCKET).upload(thumbnailPath, optimized.thumbnailBlob, {
    contentType: "image/webp",
    upsert: true,
  });
  throwIfError(thumbResult.error, "Could not upload progress photo thumbnail.");
  return {
    ...photo,
    dataUrl: optimized.dataUrl,
    thumbnailDataUrl: optimized.thumbnailDataUrl,
    storagePath,
    thumbnailPath,
    width: optimized.width,
    height: optimized.height,
  };
}

function per100Columns(per100 = {}) {
  return {
    calories_per_100g: number(per100.calories),
    protein_per_100g: number(per100.protein),
    carbs_per_100g: number(per100.carbs),
    fat_per_100g: number(per100.fat),
    fiber_per_100g: number(per100.fiber),
  };
}

function per100FromRow(row) {
  return {
    calories: number(row.calories_per_100g),
    protein: number(row.protein_per_100g),
    carbs: number(row.carbs_per_100g),
    fat: number(row.fat_per_100g),
    fiber: number(row.fiber_per_100g),
  };
}

function cacheRowToFood(row) {
  return {
    id: row.source_id,
    name: row.name,
    brand: row.brand || "",
    source: row.source || "Food cache",
    sourceId: row.source_id,
    confidence: row.confidence || "manual",
    servingGrams: number(row.serving_grams) || 100,
    ingredients: row.ingredients || "",
    per100: per100FromRow(row),
  };
}

function foodSearchText(food, query = "") {
  return [query, food.name, food.brand, food.source, food.ingredients].filter(Boolean).join(" ").toLowerCase();
}

export function subscribeToAuthChanges(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription?.unsubscribe();
}

export function enableCloudSync() {
  const meta = readSyncMeta();
  const nextMeta = {
    ...meta,
    enabled: true,
    deviceId: meta.deviceId || crypto.randomUUID(),
  };
  writeSyncMeta(nextMeta);
  return nextMeta;
}

export async function searchFoodCache(query) {
  if (!supabase || !query?.trim()) return [];
  const term = query.trim();
  const { data, error } = await supabase
    .from("food_cache")
    .select("*")
    .ilike("search_text", `%${term}%`)
    .limit(20);
  if (error) return [];
  return (data || []).map(cacheRowToFood).filter((food) => food.per100.calories > 0);
}

export async function cacheFoodResult(food, query = "") {
  if (!supabase || !food?.name || !food?.per100) return;
  const session = await getCurrentSession().catch(() => null);
  if (!session?.user?.id) return;
  const source = food.source || "Saved food";
  const sourceId = food.sourceId || food.id || `${source}:${food.name}`.toLowerCase();
  const row = {
    source,
    source_id: String(sourceId),
    name: food.name,
    brand: food.brand || "",
    search_text: foodSearchText(food, query),
    confidence: food.confidence || "manual",
    serving_grams: number(food.servingGrams) || 100,
    ingredients: food.ingredients || "",
    calories_per_100g: number(food.per100.calories),
    protein_per_100g: number(food.per100.protein),
    carbs_per_100g: number(food.per100.carbs),
    fat_per_100g: number(food.per100.fat),
    fiber_per_100g: number(food.per100.fiber),
    created_by: session.user.id,
  };
  const { error } = await supabase.from("food_cache").insert(row);
  if (error && error.code !== "23505") throw error;
}

function localRows(data, userId) {
  return {
    profile: {
      id: userId,
      calorie_target: number(data.profile.calorieTarget),
      protein_target: number(data.profile.proteinTarget),
      carbs_target: number(data.profile.carbsTarget),
      fat_target: number(data.profile.fatTarget),
      fiber_target: number(data.profile.fiberTarget),
      water_target: number(data.profile.waterTarget),
      goal_weight: data.profile.goalWeight === "" ? null : number(data.profile.goalWeight),
      session_timeout: number(data.profile.sessionTimeout) || 15,
      onboarding_dismissed: localStorage.getItem("caltrack.v2.onboarding") === "dismissed",
      name: data.profile.name || "",
      gender: data.profile.gender || "",
      age: data.profile.age === "" ? null : number(data.profile.age) || null,
      height: data.profile.height === "" ? null : number(data.profile.height) || null,
      weight: data.profile.weight === "" ? null : number(data.profile.weight) || null,
      activity_level: data.profile.activityLevel || "",
      highest_weight: data.profile.highestWeight === "" ? null : number(data.profile.highestWeight) || null,
      medical_conditions: data.profile.medicalConditions || "",
      medications: data.profile.medications || "",
      goal_mode: data.profile.goalMode || "lose",
      deficit_rate: number(data.profile.deficitRate) || 500,
    },
    diaryEntries: Object.entries(data.diary || {}).flatMap(([entryDate, entries]) =>
      (entries || []).map((entry) => ({
        user_id: userId,
        local_id: entry.id,
        entry_date: entry.date || entryDate,
        meal: entry.meal || "Snack",
        name: entry.name,
        brand: entry.brand || "",
        source: entry.source || "",
        source_id: entry.sourceId || "",
        ingredients: entry.ingredients || "",
        confidence: entry.confidence || "manual",
        grams: number(entry.grams),
        calories: number(entry.calories),
        protein: number(entry.protein),
        carbs: number(entry.carbs),
        fat: number(entry.fat),
        fiber: number(entry.fiber),
        per100: entry.per100 || {},
      })),
    ),
    dailyLogs: Object.entries(data.dailyLogs || {}).map(([logDate, log]) => ({
      user_id: userId,
      local_id: logDate,
      log_date: logDate,
      water_ml: number(log.water),
      notes: log.notes || "",
      activities: log.activities || [],
      health_flags: log.healthFlags || [],
      meds_taken: log.medsTaken || [],
      coffees: number(log.coffees) || 0,
    })),
    measurements: (data.measurements || []).map((item) => ({
      user_id: userId,
      local_id: item.id,
      measured_date: item.date,
      weight: item.weight === "" ? null : number(item.weight),
      waist: item.waist === "" ? null : number(item.waist),
      neck: item.neck === "" ? null : number(item.neck) || null,
    })),
    customFoods: (data.customFoods || []).map((food) => ({
      user_id: userId,
      local_id: food.id,
      name: food.name,
      brand: food.brand || "",
      source: food.source || "Custom food",
      source_id: food.sourceId || "",
      confidence: food.confidence || "manual",
      serving_grams: number(food.servingGrams) || 100,
      ingredients: food.ingredients || "",
      ...per100Columns(food.per100),
    })),
    pantryItems: (data.pantry || []).map((item) => ({
      user_id: userId,
      local_id: item.id,
      name: item.name,
      brand: item.brand || "",
      source: item.source || "",
      source_id: item.sourceId || "",
      confidence: item.confidence || "manual",
      default_grams: number(item.defaultGrams) || 100,
      ...per100Columns(item.per100),
    })),
    recipes: (data.recipes || []).map((recipe) => ({
      user_id: userId,
      local_id: recipe.id,
      title: recipe.title,
      type: recipe.type || "recipe",
      steps: recipe.steps || "",
      reason: recipe.reason || "",
      confidence: recipe.confidence || "manual",
      calories: number(recipe.totals?.calories),
      protein: number(recipe.totals?.protein),
      carbs: number(recipe.totals?.carbs),
      fat: number(recipe.totals?.fat),
      fiber: number(recipe.totals?.fiber),
    })),
    recipeItems: (data.recipes || []).flatMap((recipe) =>
      (recipe.items || []).map((item) => ({
        recipe_local_id: recipe.id,
        user_id: userId,
        local_id: `${recipe.id}:${item.recipeItemId || item.id}`,
        pantry_local_id: item.id,
        name: item.name,
        grams: number(item.grams),
        confidence: item.confidence || "manual",
        ...per100Columns(item.per100),
      })),
    ),
    progressPhotos: (data.progressPhotos || []).map((photo) => ({
      user_id: userId,
      local_id: photo.id,
      photo_date: photo.date,
      view: photo.view,
      storage_path: photo.storagePath || "",
      thumbnail_path: photo.thumbnailPath || "",
      width: photo.width || null,
      height: photo.height || null,
    })),
  };
}

export async function pushLocalData(data, session) {
  assertConfigured();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sign in before syncing.");

  const progressPhotos = [];
  for (const photo of data.progressPhotos || []) progressPhotos.push(await uploadPhoto(userId, photo));
  const nextData = { ...data, progressPhotos };

  const previous = readSyncMeta().ids || {};
  const current = idsFor(nextData);
  for (const [table, ids] of Object.entries(current)) await softDeleteMissing(table, previous[table] || [], ids);

  const rows = localRows(nextData, userId);
  try {
    await upsert("profiles", [rows.profile], { onConflict: "id" });
  } catch {
    const coreProfile = { ...rows.profile };
    for (const key of ["name", "gender", "age", "height", "weight", "activity_level", "highest_weight", "medical_conditions", "medications"]) {
      delete coreProfile[key];
    }
    await upsert("profiles", [coreProfile], { onConflict: "id" });
  }
  await upsert("diary_entries", rows.diaryEntries);
  try {
    await upsert("daily_logs", rows.dailyLogs);
  } catch {
    const coreLogs = rows.dailyLogs.map((row) => {
      const rest = { ...row };
      delete rest.health_flags;
      delete rest.meds_taken;
      return rest;
    });
    await upsert("daily_logs", coreLogs);
  }
  await upsert("measurements", rows.measurements);
  await upsert("custom_foods", rows.customFoods);
  await upsert("pantry_items", rows.pantryItems);
  await upsert("recipes", rows.recipes);
  await upsert("recipe_items", rows.recipeItems);
  await upsert("progress_photos", rows.progressPhotos);
  await upsert("sync_state", [{ user_id: userId, device_id: readSyncMeta().deviceId || crypto.randomUUID(), last_push_at: new Date().toISOString() }], { onConflict: "user_id" });
  return nextData;
}

function remoteToLocal(rows, currentData) {
  const profileRow = rows.profile?.[0];
  const profile = profileRow
    ? {
        ...currentData.profile,
        calorieTarget: number(profileRow.calorie_target) || currentData.profile.calorieTarget,
        proteinTarget: number(profileRow.protein_target) || currentData.profile.proteinTarget,
        carbsTarget: number(profileRow.carbs_target) || currentData.profile.carbsTarget,
        fatTarget: number(profileRow.fat_target) || currentData.profile.fatTarget,
        fiberTarget: number(profileRow.fiber_target) || currentData.profile.fiberTarget,
        waterTarget: number(profileRow.water_target) || currentData.profile.waterTarget,
        goalWeight: profileRow.goal_weight ?? currentData.profile.goalWeight,
        sessionTimeout: number(profileRow.session_timeout) || currentData.profile.sessionTimeout,
        name: profileRow.name || currentData.profile.name || "",
        gender: profileRow.gender || currentData.profile.gender || "",
        age: profileRow.age ?? currentData.profile.age ?? "",
        height: profileRow.height ?? currentData.profile.height ?? "",
        weight: profileRow.weight ?? currentData.profile.weight ?? "",
        activityLevel: profileRow.activity_level || currentData.profile.activityLevel || "",
        highestWeight: profileRow.highest_weight ?? currentData.profile.highestWeight ?? "",
        medicalConditions: profileRow.medical_conditions || currentData.profile.medicalConditions || "",
        medications: profileRow.medications || currentData.profile.medications || "",
        goalMode: profileRow.goal_mode || currentData.profile.goalMode || "lose",
        deficitRate: number(profileRow.deficit_rate) || currentData.profile.deficitRate || 500,
      }
    : currentData.profile;

  const diary = {};
  for (const row of rows.diaryEntries || []) {
    const entry = {
      id: row.local_id,
      date: row.entry_date,
      meal: row.meal,
      name: row.name,
      brand: row.brand || "",
      source: row.source || "",
      sourceId: row.source_id || "",
      ingredients: row.ingredients || "",
      confidence: row.confidence || "manual",
      grams: round(row.grams),
      calories: round(row.calories),
      protein: round(row.protein),
      carbs: round(row.carbs),
      fat: round(row.fat),
      fiber: round(row.fiber),
      per100: row.per100 || {},
    };
    diary[entry.date] = [...(diary[entry.date] || []), entry];
  }
  const dailyLogs = Object.fromEntries((rows.dailyLogs || []).map((row) => [row.log_date, { water: number(row.water_ml), notes: row.notes || "", activities: row.activities || [], healthFlags: row.health_flags || [], medsTaken: row.meds_taken || [], coffees: number(row.coffees) || 0 }]));
  const measurements = (rows.measurements || []).map((row) => ({ id: row.local_id, date: row.measured_date, weight: row.weight ?? "", waist: row.waist ?? "", neck: row.neck ?? "" }));
  const customFoods = (rows.customFoods || []).map((row) => ({
    id: row.local_id,
    name: row.name,
    brand: row.brand || "",
    source: row.source || "Custom food",
    sourceId: row.source_id || "",
    confidence: row.confidence || "manual",
    servingGrams: number(row.serving_grams) || 100,
    ingredients: row.ingredients || "",
    per100: per100FromRow(row),
  }));
  const pantry = (rows.pantryItems || []).map((row) => ({
    id: row.local_id,
    name: row.name,
    brand: row.brand || "",
    source: row.source || "",
    sourceId: row.source_id || "",
    confidence: row.confidence || "manual",
    defaultGrams: number(row.default_grams) || 100,
    per100: per100FromRow(row),
  }));
  const recipes = (rows.recipes || []).map((row) => {
    const items = (rows.recipeItems || [])
      .filter((item) => item.recipe_local_id === row.local_id)
      .map((item) => ({
        id: item.pantry_local_id || item.local_id,
        recipeItemId: item.local_id.split(":").at(-1),
        name: item.name,
        grams: number(item.grams),
        confidence: item.confidence || "manual",
        per100: per100FromRow(item),
      }));
    return {
      id: row.local_id,
      title: row.title,
      type: row.type || "recipe",
      steps: row.steps || "",
      reason: row.reason || "",
      confidence: row.confidence || "manual",
      totals: { calories: round(row.calories), protein: round(row.protein), carbs: round(row.carbs), fat: round(row.fat), fiber: round(row.fiber) },
      items,
      createdAt: row.created_at,
    };
  });
  const localPhotoMap = new Map((currentData.progressPhotos || []).map((photo) => [photo.id, photo]));
  const progressPhotos = (rows.progressPhotos || []).map((row) => ({
    ...(localPhotoMap.get(row.local_id) || {}),
    id: row.local_id,
    date: row.photo_date,
    view: row.view,
    storagePath: row.storage_path || "",
    thumbnailPath: row.thumbnail_path || "",
    width: row.width,
    height: row.height,
  }));

  return { ...currentData, profile, diary, dailyLogs, measurements, customFoods, pantry, recipes, progressPhotos };
}

function mergeById(localRows, remoteRows) {
  const merged = new Map();
  for (const row of localRows || []) merged.set(row.id, row);
  for (const row of remoteRows || []) merged.set(row.id, { ...(merged.get(row.id) || {}), ...row });
  return [...merged.values()];
}

function mergeDailyLog(localLog = {}, remoteLog = {}) {
  const localActivities = Array.isArray(localLog.activities) ? localLog.activities : [];
  const remoteActivities = Array.isArray(remoteLog.activities) ? remoteLog.activities : [];
  const localMeds = Array.isArray(localLog.medsTaken) ? localLog.medsTaken : [];
  const remoteMeds = Array.isArray(remoteLog.medsTaken) ? remoteLog.medsTaken : [];
  const localFlags = localLog.healthFlags && !Array.isArray(localLog.healthFlags) ? localLog.healthFlags : {};
  const remoteFlags = remoteLog.healthFlags && !Array.isArray(remoteLog.healthFlags) ? remoteLog.healthFlags : {};
  return {
    ...remoteLog,
    ...localLog,
    water: Math.max(number(localLog.water), number(remoteLog.water)),
    coffees: Math.max(number(localLog.coffees), number(remoteLog.coffees)),
    notes: localLog.notes || remoteLog.notes || "",
    activities: mergeById(localActivities, remoteActivities),
    medsTaken: [...new Set([...remoteMeds, ...localMeds])],
    healthFlags: { ...remoteFlags, ...localFlags },
  };
}

function mergeDailyLogs(localLogs = {}, remoteLogs = {}) {
  const dates = new Set([...Object.keys(localLogs), ...Object.keys(remoteLogs)]);
  const logs = {};
  for (const logDate of dates) logs[logDate] = mergeDailyLog(localLogs[logDate] || {}, remoteLogs[logDate] || {});
  return logs;
}

function mergeData(localData, remoteData) {
  const diaryDates = new Set([...Object.keys(localData.diary || {}), ...Object.keys(remoteData.diary || {})]);
  const diary = {};
  for (const date of diaryDates) diary[date] = mergeById(localData.diary?.[date] || [], remoteData.diary?.[date] || []);
  return {
    ...localData,
    profile: { ...localData.profile, ...remoteData.profile },
    diary,
    dailyLogs: mergeDailyLogs(localData.dailyLogs, remoteData.dailyLogs),
    measurements: mergeById(localData.measurements || [], remoteData.measurements || []),
    customFoods: mergeById(localData.customFoods || [], remoteData.customFoods || []),
    pantry: mergeById(localData.pantry || [], remoteData.pantry || []),
    recipes: mergeById(localData.recipes || [], remoteData.recipes || []),
    progressPhotos: mergeById(localData.progressPhotos || [], remoteData.progressPhotos || []),
  };
}

export async function pullRemoteData(currentData) {
  assertConfigured();
  const [profile, diaryEntries, dailyLogs, measurements, customFoods, pantryItems, recipes, recipeItems, progressPhotos] = await Promise.all([
    selectActive("profiles"),
    selectActive("diary_entries"),
    selectActive("daily_logs"),
    selectActive("measurements"),
    selectActive("custom_foods"),
    selectActive("pantry_items"),
    selectActive("recipes"),
    selectActive("recipe_items"),
    selectActive("progress_photos"),
  ]);
  return remoteToLocal({ profile, diaryEntries, dailyLogs, measurements, customFoods, pantryItems, recipes, recipeItems, progressPhotos }, currentData);
}

export async function syncCalTrack(data, session) {
  try {
    const pushed = await pushLocalData(data, session);
    const pulled = await pullRemoteData(pushed);
    const merged = mergeData(pushed, pulled);
    const meta = readSyncMeta();
    const nextMeta = {
      ...meta,
      enabled: true,
      deviceId: meta.deviceId || crypto.randomUUID(),
      ids: idsFor(merged),
      lastSyncedAt: new Date().toISOString(),
    };
    writeSyncMeta(nextMeta);
    await upsert("sync_state", [{ user_id: session.user.id, device_id: nextMeta.deviceId, last_pull_at: new Date().toISOString() }], { onConflict: "user_id" }).catch(() => null);
    return merged;
  } catch (error) {
    throw friendlySupabaseError(error);
  }
}

export function readSyncStatus() {
  return readSyncMeta();
}
