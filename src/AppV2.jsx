import React, { useEffect, useMemo, useRef, useState } from "react";
import logo1Src from "./assets/LOGO1.png";
import logo2Src from "./assets/LOGO2.png";
import {
  Droplets, Plus, CalendarDays, User, Activity, Scale,
  Brain, Camera, Search, SlidersHorizontal, Stethoscope,
  ChevronRight, Flame,
} from "lucide-react";
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

const STORAGE_KEY  = "caltrack.v2";
const SECURITY_KEY = "caltrack.v2.security";
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const EMPTY_NUTRITION = { calories: "", protein: "", carbs: "", fat: "", fiber: "" };
const CONFIDENCE = {
  off:    ["Barcode + Database", "confidence-green"],
  usda:   ["USDA",               "confidence-green"],
  manual: ["Manual Entry",       "confidence-yellow"],
  ocr:    ["OCR suggestion",     "confidence-orange"],
  ai:     ["AI Estimate",        "confidence-blue"],
};
const MEAL_ICONS = { Breakfast: "🌅", Lunch: "☀️", Dinner: "🌙", Snack: "🍎" };
const API = { openFoodFacts: "/api/open-food-facts", usda: "/api/usda" };

/* ───────────────────────── ErrorBoundary ───────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2 style={{ marginBottom: "1rem" }}>Something went wrong</h2>
        <p style={{ color: "#888", marginBottom: "1.5rem", fontSize: "0.9rem" }}>{String(this.state.error)}</p>
        <button onClick={() => window.location.reload()} style={{ padding: "0.75rem 1.5rem", background: "#FF4500", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}

/* ───────────────────────── CalorieRing ───────────────────────── */
function CalorieRing({ consumed, burned = 0, target, percent, size = 100 }) {
  const outerR = 40, innerR = 29, cx = 50, cy = 50;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;
  const cFrac  = Math.min(1, consumed / Math.max(1, target));
  const bFrac  = Math.min(1, burned  / Math.max(1, target));
  const isOver = cFrac >= 1;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="calorie-ring-svg" aria-hidden="true">
      {/* tracks */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" />
      {/* consumed — outer, orange→red */}
      <circle cx={cx} cy={cy} r={outerR} fill="none"
        stroke={isOver ? "#ff5050" : "#ff4500"}
        strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${cFrac * outerC} ${outerC}`}
        transform="rotate(-90 50 50)" />
      {/* burned — inner, green */}
      {burned > 0 && (
        <circle cx={cx} cy={cy} r={innerR} fill="none"
          stroke="#00d278"
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${bFrac * innerC} ${innerC}`}
          transform="rotate(-90 50 50)" />
      )}
      <text x="50" y="45" textAnchor="middle" fill="white" fontSize="15" fontWeight="800" fontFamily="'Inter',sans-serif">{Math.round(percent)}%</text>
      <text x="50" y="55" textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="6.5" letterSpacing="1" fontFamily="'Inter',sans-serif">EATEN</text>
    </svg>
  );
}

/* ───────────────────────── CalorieChart ───────────────────────── */
function CalorieChart({ diary, target }) {
  const days   = Array.from({ length: 7 }, (_, i) => dateOffset(i - 6));
  const values = days.map((d) => totalsFor(diary[d]).calories);
  const ceil   = Math.max(number(target), ...values, 1);
  return (
    <div className="bar-chart" aria-label="Seven day calorie history">
      {days.map((day, i) => {
        const val = values[i];
        return (
          <div className="bar-column" key={day}>
            <div className="bar-value">{val ? Math.round(val) : ""}</div>
            <div className="bar-rail">
              <i className={val > target ? "over" : ""} style={{ height: `${Math.max(val ? 8 : 2, (val / ceil) * 100)}%` }} />
            </div>
            <span className={day === localDate() ? "today-label" : ""}>{shortDay(day)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── WeightJourneyCard ───────────────────────── */
function WeightJourneyCard({ entries, highestWeight, currentWeight, goalWeight: goalW, setData, flash }) {
  const [quickInput, setQuickInput] = useState("");
  const today = localDate();
  const firstW  = number(highestWeight) || (entries[0] ? number(entries[0].weight) : null);
  const curW    = entries.length ? number(entries[entries.length - 1].weight) : (number(currentWeight) || null);
  const totalDrop = firstW && goalW ? firstW - goalW : null;
  const dropped   = firstW && curW ? round(firstW - curW) : null;
  const toGo      = curW && goalW ? round(curW - goalW) : null;
  const pct       = totalDrop > 0 && dropped !== null ? Math.min(100, Math.max(0, (dropped / totalDrop) * 100)) : null;
  const PAD = 24, TW = 300;
  const curX = pct !== null ? PAD + (pct / 100) * (TW - 2 * PAD) : null;
  const CW = 300, CH = 110, CPX = 14, CPY = 14;
  const pts = entries;
  const ws  = pts.map((e) => number(e.weight));
  const hasChart = pts.length >= 2;
  const yMax = firstW ? firstW + 2 : (hasChart ? Math.max(...ws) + 3 : 130);
  const yMin = goalW  ? goalW  - 2 : (hasChart ? Math.min(...ws) - 3 : 85);
  const yRange = Math.max(1, yMax - yMin);
  const toX = (i) => CPX + (i / Math.max(1, pts.length - 1)) * (CW - 2 * CPX);
  const toY = (w) => CPY + ((yMax - w) / yRange) * (CH - 2 * CPY);
  const linePts = hasChart ? pts.map((e, i) => `${toX(i)},${toY(number(e.weight))}`).join(" ") : "";
  const areaPts = hasChart ? `${toX(0)},${CH - 2} ${linePts} ${toX(pts.length - 1)},${CH - 2}` : "";
  const goalY   = goalW ? toY(goalW) : null;
  const startY  = firstW ? toY(firstW) : null;
  const daysSince = entries.length ? Math.floor((Date.now() - new Date(entries[entries.length - 1].date).getTime()) / 86_400_000) : null;
  const needsWeigh = daysSince === null || daysSince >= 7;

  return (
    <section className="wj-card">
      <div className="wj-header">
        <div>
          <span className="eyebrow">Weight journey</span>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>Progress to goal</h3>
        </div>
        <button className="secondary compact" onClick={() => setQuickInput(" ")}>+ Log</button>
      </div>

      {quickInput !== "" && (
        <div className="ws-quick-form">
          <input type="number" step="0.1" min="20" max="300" className="ws-quick-input"
            placeholder={curW ? String(curW) : "114.0"}
            value={quickInput.trim()}
            onChange={(e) => setQuickInput(e.target.value)}
            autoFocus />
          <span className="ws-unit">kg</span>
          <input type="date" className="ws-date-input" id="wj-log-date" defaultValue={today} max={today} />
          <button className="primary ws-save-btn" onClick={() => {
            const w = parseFloat(quickInput);
            if (!w || w < 20 || w > 300) { flash("Enter a valid weight (20–300 kg)."); return; }
            const dateEl = document.getElementById("wj-log-date");
            const logDate = (dateEl && dateEl.value) ? dateEl.value : today;
            setData((d) => ({
              ...d,
              measurements: [...d.measurements, { id: makeId(), date: logDate, weight: w, waist: "" }],
              profile: logDate === today ? { ...d.profile, weight: w } : d.profile,
            }));
            setQuickInput("");
            flash(logDate === today ? "Weight logged!" : `Weight logged for ${logDate}.`);
          }}>Save</button>
          <button className="secondary ws-cancel-btn" onClick={() => setQuickInput("")}>✕</button>
        </div>
      )}

      {needsWeigh && quickInput === "" && (
        <button className="weigh-reminder" onClick={() => setQuickInput(" ")}>
          ⚖️ {daysSince === null ? "Log your first weight" : `${daysSince} days since last weigh-in`}
        </button>
      )}

      <div className="wj-stats">
        {firstW  && <div className="wj-stat"><span>Started</span><strong>{firstW} kg</strong></div>}
        {dropped !== null && dropped > 0 && <div className="wj-stat wj-lost"><span>Lost</span><strong>−{dropped} kg</strong></div>}
        {curW    && <div className="wj-stat wj-cur"><span>Now</span><strong>{curW} kg</strong></div>}
        {goalW   && <div className="wj-stat wj-goal"><span>Goal</span><strong>{goalW} kg</strong></div>}
        {toGo !== null && toGo > 0 && <div className="wj-stat"><span>To go</span><strong>{toGo} kg</strong></div>}
      </div>

      {pct !== null && curX !== null && (
        <div className="wj-track-wrap">
          <svg viewBox={`0 0 ${TW} 62`} className="wj-track-svg">
            <defs>
              <linearGradient id="wjGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4dc37f" stopOpacity=".9"/>
                <stop offset="100%" stopColor="#00c6ff" stopOpacity=".9"/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <line x1={PAD} y1="22" x2={TW-PAD} y2="22" stroke="rgba(255,255,255,.1)" strokeWidth="5" strokeLinecap="round"/>
            <line x1={PAD} y1="22" x2={curX}    y2="22" stroke="url(#wjGrad)"         strokeWidth="5" strokeLinecap="round"/>
            {[25, 50, 75].map((ms) => {
              const mx = PAD + (ms / 100) * (TW - 2 * PAD);
              const reached = pct >= ms;
              return (
                <g key={ms}>
                  <circle cx={mx} cy="22" r="4" fill={reached ? "#ffd700" : "rgba(255,255,255,.08)"} stroke={reached ? "#ffd700" : "rgba(255,255,255,.2)"} strokeWidth="1.5" filter={reached ? "url(#glow)" : undefined}/>
                  <text x={mx} y="36" fontSize="7" fill={reached ? "#ffd700" : "rgba(255,255,255,.2)"} textAnchor="middle">{ms}%</text>
                </g>
              );
            })}
            <circle cx={PAD} cy="22" r="6" fill="#4dc37f" filter="url(#glow)"/>
            <circle cx={curX} cy="22" r="9" fill="#0a090d" stroke="#00c6ff" strokeWidth="2.5" filter="url(#glow)"/>
            <circle cx={curX} cy="22" r="4" fill="#00c6ff"/>
            <circle cx={TW-PAD} cy="22" r="7" fill={pct >= 100 ? "#ffd700" : "rgba(255,215,0,.08)"} stroke="#ffd700" strokeWidth="2" filter="url(#glow)"/>
            <text x={TW-PAD} y="22" fontSize="9" fill="#ffd700" textAnchor="middle" dominantBaseline="central">🏆</text>
            <text x={PAD}    y="42" fontSize="10" fill="#4dc37f" fontWeight="700">{firstW} kg</text>
            <text x={curX}   y="42" fontSize="10" fill="#00c6ff" fontWeight="700" textAnchor="middle">{curW} kg</text>
            <text x={TW-PAD} y="42" fontSize="10" fill="#ffd700" fontWeight="700" textAnchor="end">{goalW} kg</text>
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
            {startY !== null && (
              <>
                <line x1={CPX} y1={startY} x2={CW-CPX} y2={startY} stroke="#ff7043" strokeWidth="1.2" strokeDasharray="5 4" strokeOpacity=".6"/>
                <text x={CPX+2} y={startY+9} fontSize="8" fill="#ff7043" opacity=".8">Start {firstW} kg</text>
              </>
            )}
            {goalY !== null && (
              <>
                <line x1={CPX} y1={goalY} x2={CW-CPX} y2={goalY} stroke="#4dc37f" strokeWidth="1.2" strokeDasharray="5 4" strokeOpacity=".6"/>
                <text x={CW-CPX-2} y={goalY-3} fontSize="8" fill="#4dc37f" opacity=".8" textAnchor="end">Goal {goalW} kg</text>
              </>
            )}
            <polygon points={areaPts} fill="url(#wjAreaGrad)"/>
            <polyline points={linePts} fill="none" stroke="#00c6ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            {pts.map((e, i) => {
              const cx2 = toX(i); const cy2 = toY(number(e.weight));
              const isLast = i === pts.length - 1; const isFirst = i === 0;
              return (
                <g key={e.id || i}>
                  {isLast ? (
                    <>
                      <circle cx={cx2} cy={cy2} r="6" fill="#0a090d" stroke="#00c6ff" strokeWidth="2.2" filter="url(#glow)"/>
                      <circle cx={cx2} cy={cy2} r="3" fill="#00c6ff"/>
                    </>
                  ) : (
                    <circle cx={cx2} cy={cy2} r="3" fill="#0a090d" stroke={isFirst ? "#4dc37f" : "rgba(0,198,255,.5)"} strokeWidth="1.5"/>
                  )}
                  <text x={cx2} y={cy2 - 6} fontSize="8" fill={isLast ? "#00c6ff" : "rgba(255,255,255,.45)"} fontWeight={isLast ? "700" : "400"} textAnchor="middle">{number(e.weight)}</text>
                  <text x={cx2} y={cy2 + 14} fontSize="7" fill="rgba(255,255,255,.3)" textAnchor="middle">{e.date ? e.date.slice(5).replace("-", "/") : ""}</text>
                </g>
              );
            })}
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

/* ───────────────────────── ActivityCard ───────────────────────── */
const ACTIVITY_PRESETS = [
  { name: "Walk",    icon: "🚶", met: 3.5 },
  { name: "Run",     icon: "🏃", met: 8.0 },
  { name: "Swim",    icon: "🏊", met: 6.0 },
  { name: "Cycle",   icon: "🚴", met: 6.5 },
  { name: "Weights", icon: "🏋️", met: 4.0 },
  { name: "HIIT",    icon: "⚡", met: 10.0 },
  { name: "Yoga",    icon: "🧘", met: 2.5 },
  { name: "Other",   icon: "➕", met: null },
];

function ActivityCard({ dailyLog, patchDailyLog, weightKg }) {
  const [selected, setSelected]   = useState(null);
  const [duration, setDuration]   = useState(30);
  const [customName, setCustomName] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const activities = dailyLog.activities || [];
  const totalBurned = activities.reduce((s, a) => s + number(a.kcal), 0);

  const weight = number(weightKg) || 70;
  const previewKcal = selected && selected.met
    ? Math.round(selected.met * weight * (duration / 60))
    : null;

  function logActivity() {
    let name, kcal;
    if (selected?.met) {
      name = `${selected.name} ${duration} min`;
      kcal = Math.round(selected.met * weight * (duration / 60));
    } else if (customName.trim() && number(customKcal) > 0) {
      name = customName.trim();
      kcal = number(customKcal);
    } else return;
    patchDailyLog({ activities: [...activities, { id: makeId(), name, kcal }] });
    setSelected(null); setCustomName(""); setCustomKcal("");
  }

  function removeActivity(id) {
    patchDailyLog({ activities: activities.filter((a) => a.id !== id) });
  }

  return (
    <div className="activity-card">
      <div className="activity-card-top">
        <div className="activity-card-left">
          <Activity size={18} color="#00d278" />
          <span className="activity-card-title">Activity</span>
        </div>
        {totalBurned > 0 && <span className="activity-card-burned">🟢 −{Math.round(totalBurned)} kcal burned</span>}
      </div>

      {activities.length > 0 && (
        <div className="activity-list">
          {activities.map((a) => (
            <div key={a.id} className="activity-row">
              <span className="activity-row-name">{a.name}</span>
              <span className="activity-row-cal">−{Math.round(a.kcal)} kcal</span>
              <button className="activity-row-del" onClick={() => removeActivity(a.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Preset pills */}
      <div className="activity-presets">
        {ACTIVITY_PRESETS.map((p) => (
          <button key={p.name}
            className={`activity-preset-btn${selected?.name === p.name ? " active" : ""}`}
            onClick={() => setSelected(selected?.name === p.name ? null : p)}>
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      {/* Duration slider or custom form */}
      {selected && (
        <div className="activity-picker">
          {selected.met ? (
            <>
              <div className="duration-slider-wrap">
                <div className="duration-slider-labels">
                  <span>{selected.icon} {selected.name}</span>
                  <strong className="duration-value">{duration} min</strong>
                </div>
                <input
                  type="range" min="5" max="120" step="5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="duration-slider"
                  style={{ "--pct": `${((duration - 5) / 115) * 100}%` }}
                />
                <div className="duration-slider-ticks">
                  <span>5</span><span>30</span><span>60</span><span>90</span><span>120</span>
                </div>
              </div>
              {previewKcal !== null && (
                <p className="activity-kcal-preview">≈ <strong style={{color:"#00d278"}}>{previewKcal} kcal</strong> burned · based on {weight} kg body weight</p>
              )}
              <button className="primary" style={{ width: "100%", marginTop: 10 }} onClick={logActivity}>
                Log {selected.name} {duration} min → −{previewKcal} kcal
              </button>
            </>
          ) : (
            <div className="activity-add-form">
              <input placeholder="Activity name" value={customName} onChange={(e) => setCustomName(e.target.value)} autoFocus />
              <input type="number" placeholder="kcal" min="0" max="5000" value={customKcal} onChange={(e) => setCustomKcal(e.target.value)} style={{ width: 80 }} onKeyDown={(e) => e.key === "Enter" && logActivity()} />
              <button className="activity-add-btn" onClick={logActivity}>Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── LockScreen ───────────────────────── */
function LockScreen({ mode, onUnlock, onSetup, owner }) {
  const [email, setEmail]   = useState("");
  const [pin, setPin]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError]   = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy]     = useState(false);
  const [sent, setSent]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (mode === "unlock") {
      if (!/^\d{4,8}$/.test(pin)) return setError("Enter your 4–8 digit PIN.");
      setBusy(true);
      const ok = await onUnlock(pin);
      setBusy(false);
      if (!ok) setError("Wrong PIN. Try again.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!/^\d{4,8}$/.test(pin)) return setError("Local PIN must be 4–8 digits.");
    if (pin !== confirm) return setError("PINs don't match.");
    setBusy(true);
    setStatus("Sending magic link…");
    const linkResult = await sendMagicLink(email.trim());
    if (!linkResult.ok) { setBusy(false); setStatus(""); return setError(linkResult.error || "Could not send magic link."); }
    setSent(true);
    const ok = await onSetup({ pin, email: email.trim(), onStatus: (msg) => setStatus(msg) });
    setBusy(false);
    setStatus("");
    if (!ok) setError("Setup failed. Please try again.");
  };

  return (
    <div className="lock-shell">
      <form className="lock-card" onSubmit={submit}>
        <img src={logo1Src} alt="PULSE" className="brand-logo lock-logo" />
        {mode === "unlock" ? (
          <>
            <h1>Welcome back</h1>
            {owner && <p className="lock-owner">{owner}</p>}
            <p className="lock-subtext">Enter your PIN to unlock.</p>
            <Field label="PIN" type="password" inputMode="numeric" autoComplete="current-password" maxLength="8" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} disabled={busy} />
            {error && <div className="form-error" role="alert">{error}</div>}
            {busy && <div className="pin-hashing-status" role="status"><span className="pin-spinner" /><span>Verifying…</span></div>}
            <button className="primary" type="submit" disabled={busy}>Unlock</button>
            <p className="lock-switch-hint">New device? <a href="#" onClick={(e) => { e.preventDefault(); localStorage.removeItem("caltrack.v2.security"); window.location.reload(); }}>Set up on this device</a></p>
          </>
        ) : sent ? (
          <>
            <h1>Check your email</h1>
            <p className="lock-subtext">A magic link was sent to <strong>{email}</strong>. Click it to verify, then come back to this tab — you'll be signed in automatically.</p>
            <p className="lock-subtext" style={{marginTop:8, opacity:.6}}>Your PIN is saved on this device. You only need the magic link once per new device.</p>
          </>
        ) : (
          <>
            <h1>PULSE</h1>
            <p className="lock-subtext">Enter your email and choose a PIN. We'll send a magic link to verify your email — no password needed.</p>
            <Field label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            <Field label="Local unlock PIN (4–8 digits)" type="password" inputMode="numeric" autoComplete="new-password" maxLength="8" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} disabled={busy} />
            <Field label="Confirm PIN" type="password" inputMode="numeric" autoComplete="new-password" maxLength="8" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} disabled={busy} />
            {error && <div className="form-error" role="alert">{error}</div>}
            {busy && <div className="pin-hashing-status" role="status"><span className="pin-spinner" /><span>{status || "Please wait…"}</span></div>}
            <button className="primary" type="submit" disabled={busy}>
              {busy ? (status || "Please wait…") : "Continue"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/* ───────────────────────── Field ───────────────────────── */
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

/* ───────────────────────── Utility functions ───────────────────────── */
const number    = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round     = (v) => Math.round((number(v) + Number.EPSILON) * 10) / 10;
const makeId    = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateOffset = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const shortDay  = (date) => new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(new Date(`${date}T12:00:00`));
const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (v) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));

async function hashPin(pin, saltBase64) {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const key  = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, key, 256);
  return { salt: bytesToBase64(salt), hash: bytesToBase64(new Uint8Array(hash)) };
}

function readSecurity() { try { return JSON.parse(localStorage.getItem(SECURITY_KEY)); } catch { return null; } }

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return defaultData;
    const diary = Object.fromEntries(
      Object.entries(saved.diary || {}).map(([date, entries]) => [
        date,
        (entries || []).map((e) => ({ meal: "Snack", ...e, calories: number(e.calories ?? e.cal) })),
      ]),
    );
    return {
      ...defaultData, ...saved,
      profile: { ...defaultData.profile, ...(saved.profile || {}), calorieTarget: number((saved.profile || {}).calorieTarget ?? (saved.profile || {}).dailyTarget) || defaultData.profile.calorieTarget },
      diary,
      measurements:  saved.measurements  || saved.weights || [],
      customFoods:   saved.customFoods   || [],
      dailyLogs:     saved.dailyLogs     || {},
      progressPhotos: saved.progressPhotos || [],
      pantry:        saved.pantry        || [],
      recipes:       saved.recipes       || [],
    };
  } catch { return defaultData; }
}

const defaultData = {
  version: 2,
  profile: {
    name: "", gender: "", age: "", height: "", weight: "",
    waist: "", neck: "", hip: "", highestWeight: "",
    activityLevel: "light", goalMode: "lose", deficitRate: 500,
    medicalConditions: "", medications: "",
    calorieTarget: 2000, proteinTarget: 130, carbsTarget: 220, fatTarget: 65,
    fiberTarget: 30, waterTarget: 2500, goalWeight: "",
    sessionTimeout: 15,
  },
  diary: {}, measurements: [], customFoods: [],
  dailyLogs: {}, progressPhotos: [], pantry: [], recipes: [],
};

function totalsFor(items = []) {
  return items.reduce(
    (t, item) => ({
      calories: t.calories + number(item.calories ?? item.cal),
      protein:  t.protein  + number(item.protein),
      carbs:    t.carbs    + number(item.carbs),
      fat:      t.fat      + number(item.fat),
      fiber:    t.fiber    + number(item.fiber),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

function scaleNutrition(per100, grams) {
  const p = per100 || {}; const factor = number(grams) / 100;
  return {
    calories: round(number(p.calories) * factor),
    protein:  round(number(p.protein)  * factor),
    carbs:    round(number(p.carbs)    * factor),
    fat:      round(number(p.fat)      * factor),
    fiber:    round(number(p.fiber)    * factor),
  };
}

function calcBMRMifflin(p) {
  const w = number(p.weight), h = number(p.height), a = number(p.age);
  if (!w || !h || !a) return 0;
  return Math.round(p.gender === "female" ? 10*w + 6.25*h - 5*a - 161 : 10*w + 6.25*h - 5*a + 5);
}
function calcBMR(p) { return calcBMRMifflin(p); }
function calcTDEE(p) {
  const bmr = calcBMR(p); if (!bmr) return 0;
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  return Math.round(bmr * (factors[p.activityLevel] || 1.375));
}
function calcDailyTarget(p) {
  const bmr = calcBMRMifflin(p);
  const tdee = calcTDEE(p);
  if (!bmr) return number(p.calorieTarget) || 2000;
  if (p.goalMode === "maintain") return tdee || bmr;
  // Base the eat target on BMR (resting burn), not TDEE.
  // Any exercise burned on top is extra fat loss — not counted in the target.
  const deficit = number(p.deficitRate) || 500;
  const safeFloor = Math.max(1200, Math.round(bmr * 0.6));
  return Math.max(safeFloor, bmr - deficit);
}

function calcNavyBodyFat(p) {
  const h = number(p.height), w = number(p.waist), n = number(p.neck), hip = number(p.hip);
  if (!h || !w || !n || w <= n) return null;
  if (p.gender === "male") {
    return Math.max(0, 86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76);
  }
  if (p.gender === "female") {
    if (!hip || w + hip <= n) return null;
    return Math.max(0, 163.205 * Math.log10(w + hip - n) - 97.684 * Math.log10(h) - 78.387);
  }
  return null;
}

function calcBodyComposition(p) {
  const bf = calcNavyBodyFat(p);
  const weight = number(p.weight);
  if (bf === null || !weight) return null;
  const fatMass  = round(weight * bf / 100);
  const leanMass = round(weight - fatMass);
  return { bf: round(bf), fatMass, leanMass };
}

function openFoodFactsFood(product) {
  const nutrients = product.nutriments || {};
  return {
    id: product.code || makeId(),
    name: product.product_name || product.generic_name || product.brands || "Unnamed packaged food",
    brand: product.brands || "",
    source: "Open Food Facts", confidence: "off",
    sourceId: product.code || "",
    servingGrams: number(product.serving_quantity) || 100,
    per100: {
      calories: number(nutrients["energy-kcal_100g"]) || Math.round(number(nutrients["energy_100g"]) / 4.184),
      protein:  number(nutrients.proteins_100g),
      carbs:    number(nutrients.carbohydrates_100g),
      fat:      number(nutrients.fat_100g),
      fiber:    number(nutrients.fiber_100g),
    },
  };
}

function usdaFood(food) {
  const nutrients = food.foodNutrients || [];
  const find = ({ ids = [], names = [], unit }) => {
    const n = nutrients.find((item) => {
      const nId = Number(item.nutrientId);
      const nm  = String(item.nutrientName || "").toLowerCase();
      const unitOk = !unit || String(item.unitName || "").toLowerCase() === unit;
      return unitOk && (ids.includes(nId) || names.some((c) => nm === c));
    });
    return number(n?.value);
  };
  return {
    id: String(food.fdcId), name: food.description || "USDA food",
    brand: food.brandOwner || food.brandName || "",
    source: "USDA FoodData Central", confidence: "usda",
    sourceId: String(food.fdcId), servingGrams: 100,
    per100: {
      calories: find({ ids: [1008], names: ["energy"],                        unit: "kcal" }),
      protein:  find({ ids: [1003], names: ["protein"] }),
      carbs:    find({ ids: [1005], names: ["carbohydrate, by difference"] }),
      fat:      find({ ids: [1004], names: ["total lipid (fat)"] }),
      fiber:    find({ ids: [1079], names: ["fiber, total dietary"] }),
    },
  };
}

function foodKey(food) { return `${food.source || ""}:${food.sourceId || food.id || food.name}`.toLowerCase(); }

function mergeFoods(...groups) {
  const seen = new Set(); const merged = [];
  for (const group of groups) for (const food of group || []) {
    const key = foodKey(food); if (seen.has(key)) continue; seen.add(key); merged.push(food);
  }
  return merged;
}

function cleanFoodName(name = "") {
  return String(name).replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function foodDisplayKey(food) { return cleanFoodName(food.name).toLowerCase(); }

function simplifyFoods(foods = []) {
  const priority = { "Saved food": 0, "Custom food": 0, "Local database": 1, "Starter food": 1, "USDA FoodData Central": 2, "Open Food Facts": 3 };
  const sorted = [...foods].sort((a, b) => (priority[a.source] ?? 9) - (priority[b.source] ?? 9));
  const byName = new Map(); const output = [];
  for (const food of sorted) {
    const key = foodDisplayKey(food); if (!key) continue;
    const outputKey = (food.source === "Open Food Facts" && food.brand) ? `${key}:${String(food.brand).toLowerCase()}` : key;
    if (byName.has(outputKey)) continue; byName.set(outputKey, true); output.push(food);
  }
  return output;
}

function searchSavedFoods(foods, query) {
  const term = query.trim().toLowerCase(); if (!term) return [];
  return (foods || []).filter((f) => [f.name, f.brand, f.source, f.ingredients].filter(Boolean).join(" ").toLowerCase().includes(term));
}

function foodAlreadySaved(foods, food) {
  const key = food.sourceId || food.id;
  return (foods || []).some((s) => {
    if (key && (s.sourceId === key || s.id === key)) return true;
    return s.name.toLowerCase() === food.name.toLowerCase() && (s.brand || "").toLowerCase() === (food.brand || "").toLowerCase();
  });
}

function rememberedFood(food) {
  return { id: makeId(), name: food.name, brand: food.brand || "", source: food.source || "Saved food", sourceId: food.sourceId || food.id || "", confidence: food.confidence || "manual", servingGrams: number(food.servingGrams) || 100, ingredients: food.ingredients || "", per100: food.per100 };
}

function parseAiNutrition(text) {
  const n = text.toLowerCase();
  const x = (pattern) => {
    const m = n.match(pattern); if (!m) return "";
    const low = Number(m[1]); const high = Number(m[2] || m[1]);
    if (!low || low <= 0) return "";
    return Math.round((low + high) / 2);
  };
  const first = text.split(/[.\n]/)[0].replace(/estimate only[.:]*\s*/i, "").trim();
  return {
    name:    first.length > 3 && first.length < 80 ? first : "AI food estimate",
    calories: x(/calori(?:es)?[^0-9]{0,30}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    protein:  x(/protein[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    carbs:    x(/carb(?:ohydrate)?s?[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    fat:      x(/(?:total )?fat[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
    fiber:    x(/fi(?:bre|ber)[^0-9]{0,20}(\d+)(?:\s*[-–to]+\s*(\d+))?/),
  };
}

function mergeById(localRows = [], remoteRows = []) {
  const merged = new Map();
  for (const row of localRows)  merged.set(row.id, row);
  for (const row of remoteRows) merged.set(row.id, { ...(merged.get(row.id) || {}), ...row });
  return [...merged.values()];
}

function mergeDiary(local = {}, remote = {}) {
  const dates = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const diary = {};
  for (const d of dates) diary[d] = mergeById(local[d] || [], remote[d] || []);
  return diary;
}

function mergeDailyLog(local = {}, remote = {}) {
  return {
    ...remote, ...local,
    water:   Math.max(number(local.water), number(remote.water)),
    coffees: Math.max(number(local.coffees), number(remote.coffees)),
    notes:   local.notes || remote.notes || "",
    activities: mergeById(Array.isArray(local.activities) ? local.activities : [], Array.isArray(remote.activities) ? remote.activities : []),
    medsTaken:  [...new Set([...(Array.isArray(remote.medsTaken) ? remote.medsTaken : []), ...(Array.isArray(local.medsTaken) ? local.medsTaken : [])])],
    healthFlags: { ...((remote.healthFlags && !Array.isArray(remote.healthFlags) ? remote.healthFlags : {})), ...((local.healthFlags && !Array.isArray(local.healthFlags) ? local.healthFlags : {})) },
  };
}

function mergeDailyLogs(local = {}, remote = {}) {
  const dates = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const logs = {};
  for (const d of dates) logs[d] = mergeDailyLog(local[d] || {}, remote[d] || {});
  return logs;
}

function mergeAccountData(localData, remoteData) {
  return {
    ...localData, ...remoteData,
    profile:       { ...localData.profile, ...(remoteData.profile || {}) },
    diary:         mergeDiary(localData.diary, remoteData.diary),
    dailyLogs:     mergeDailyLogs(localData.dailyLogs, remoteData.dailyLogs),
    measurements:  mergeById(localData.measurements || [], remoteData.measurements || []),
    customFoods:   mergeById(localData.customFoods  || [], remoteData.customFoods  || []),
    pantry:        mergeById(localData.pantry        || [], remoteData.pantry        || []),
    recipes:       mergeById(localData.recipes       || [], remoteData.recipes       || []),
    progressPhotos: mergeById(localData.progressPhotos || [], remoteData.progressPhotos || []),
  };
}

/* ═══════════════════════════════════════════
   MAIN APP COMPONENT
═══════════════════════════════════════════ */
function AppV2Inner() {
  const [security,   setSecurity]   = useState(readSecurity);
  const [locked,     setLocked]     = useState(true);
  const [data,       setData]       = useState(loadData);
  const [date,       setDate]       = useState(localDate);
  const [tab,        setTab]        = useState("diary");

  // food-related state
  const [query,        setQuery]        = useState("");
  const [results,      setResults]      = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [logForm,      setLogForm]      = useState({ grams: 100, meal: "Breakfast" });
  const [custom,       setCustom]       = useState({ name: "", brand: "", servingGrams: 100, confidence: "manual", ...EMPTY_NUTRITION });
  const [showManual,   setShowManual]   = useState(false);

  // AI
  const [mealDescription, setMealDescription] = useState("");
  const [describeOpen,    setDescribeOpen]    = useState(false);
  const [pendingLogFood,  setPendingLogFood]  = useState(null);
  const [scanPreview,     setScanPreview]     = useState("");
  const [aiPhotoResult,   setAiPhotoResult]   = useState("");

  // progress / measurements
  const [measurement,     setMeasurement]     = useState({ weight: "", waist: "", neck: "", hip: "" });

  // settings / PIN
  const [pinChange,       setPinChange]       = useState({ current: "", next: "", confirm: "" });
  const [profileSaved,    setProfileSaved]    = useState(false);
  const profileSaveTimer = useRef(null);

  // UI
  const [notice,         setNotice]         = useState("");
  const [busy,           setBusy]           = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [online,         setOnline]         = useState(() => navigator.onLine);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("caltrack.v2.onboarding") === "dismissed",
  );

  // cloud sync
  const [cloudSession, setCloudSession] = useState(null);
  const [syncStatus,   setSyncStatus]   = useState(readSyncStatus);
  const [syncing,      setSyncing]      = useState(false);
  const [cloudHealth,  setCloudHealth]  = useState({ status: "unchecked", message: "Not checked yet." });

  // animated calorie counter
  const [displayCalories, setDisplayCalories] = useState(0);
  const calAnimRef = useRef(null);

  const mainRef = useRef(null);
  const importRef = useRef(null);
  const syncTimer = useRef(null);
  const cloudLoadedUser = useRef("");
  const applyingCloudData = useRef(false);
  const skipNextAutoSync = useRef(false);
  const lastLocalChangeAt = useRef(0);
  const syncInFlight = useRef(false);
  const pendingSync = useRef(false);
  const autoSyncTimer = useRef(null);

  /* ─── Derived state ─── */
  const items       = data.diary[date] || [];
  const totals      = useMemo(() => totalsFor(items), [items]);
  const dailyLog    = { water: 0, notes: "", activities: [], medsTaken: [], healthFlags: {}, ...(data.dailyLogs[date] || {}) };
  const dailyTarget = calcDailyTarget(data.profile);
  const remaining   = dailyTarget - totals.calories;
  const caloriePercent = dailyTarget ? Math.min(100, (totals.calories / dailyTarget) * 100) : 0;

  const weightEntries = useMemo(
    () => [...data.measurements].filter((m) => number(m.weight) > 0).sort((a, b) => a.date.localeCompare(b.date)),
    [data.measurements],
  );
  const sortedMeasurements = useMemo(
    () => [...data.measurements].sort((a, b) => b.date.localeCompare(a.date)),
    [data.measurements],
  );

  const streak = useMemo(() => {
    let count = 0; let d = localDate();
    while (data.diary[d]?.length) {
      count++;
      const prev = new Date(d); prev.setDate(prev.getDate() - 1);
      d = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,"0")}-${String(prev.getDate()).padStart(2,"0")}`;
    }
    return count;
  }, [data.diary]);

  const quickFoods = useMemo(() => {
    const ids = ["starter:banana", "starter:egg", "starter:fried-eggs", "starter:chicken-breast", "starter:white-rice"];
    return ids.map((id) => STARTER_FOODS.find((f) => f.id === id)).filter(Boolean);
  }, []);

  const localQueryResults = query.trim()
    ? simplifyFoods([...searchSavedFoods(data.customFoods, query), ...searchSavedFoods(STARTER_FOODS, query)]).slice(0, 8)
    : [];

  const displayResults = query.trim()
    ? (localQueryResults.length ? localQueryResults : simplifyFoods(searchSavedFoods(results, query)).slice(0, 12))
    : quickFoods;

  /* ─── Animated calorie counter ─── */
  useEffect(() => {
    const eaten = totals.calories;
    const target = Math.abs(Math.round(dailyTarget - eaten));
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
  }, [totals.calories, dailyTarget]);

  /* ─── Persist to localStorage ─── */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (applyingCloudData.current) { applyingCloudData.current = false; skipNextAutoSync.current = true; }
      else lastLocalChangeAt.current = Date.now();
    } catch { setNotice("Local storage is full. Export a backup."); }
  }, [data]);

  /* ─── Cloud sync helpers ─── */
  async function pushAndPullLatest(session = cloudSession) {
    if (!session?.user?.id || locked || !supabaseConfig.configured || !online) return null;
    if (syncInFlight.current) { pendingSync.current = true; return null; }
    syncInFlight.current = true;
    try {
      const merged = await syncCalTrack(loadData(), session);
      applyingCloudData.current = true;
      setData((cur) => mergeAccountData(cur, merged));
      setSyncStatus(readSyncStatus());
      return merged;
    } finally {
      syncInFlight.current = false;
      if (pendingSync.current) { pendingSync.current = false; window.setTimeout(() => pushAndPullLatest(session).catch(() => {}), 250); }
    }
  }

  function applyRemoteData(remoteData) {
    if (!remoteData) return;
    applyingCloudData.current = true;
    setData((cur) => mergeAccountData(cur, remoteData));
  }

  useEffect(() => {
    if (!cloudSession?.user?.id || locked || !supabaseConfig.configured) return;
    if (skipNextAutoSync.current) { skipNextAutoSync.current = false; return; }
    if (autoSyncTimer.current) clearTimeout(autoSyncTimer.current);
    autoSyncTimer.current = setTimeout(() => pushAndPullLatest(cloudSession).catch(() => {}), 1500);
    return () => clearTimeout(autoSyncTimer.current);
  }, [data, cloudSession, locked]);

  useEffect(() => {
    if (!cloudSession?.user?.id || locked || !supabaseConfig.configured) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || syncInFlight.current) return;
      if (Date.now() - lastLocalChangeAt.current < 2200) return;
      pullRemoteData(loadData()).then(applyRemoteData).catch(() => {});
    }, 1500);
    return () => window.clearInterval(interval);
  }, [cloudSession, locked]);

  useEffect(() => {
    if (!supabaseConfig.configured) return;
    function onVisible() {
      if (document.visibilityState === "visible" && cloudSession?.user?.id && !locked) {
        if (Date.now() - lastLocalChangeAt.current < 2200) pushAndPullLatest(cloudSession).catch(() => {});
        else pullRemoteData(loadData()).then(applyRemoteData).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [cloudSession, locked]);

  useEffect(() => {
    if (!supabaseConfig.configured) return undefined;
    let cancelled = false;
    async function loadSession(session) {
      try {
        const active = session || await getCurrentSession();
        if (cancelled) return;
        setCloudSession(active);
        if (active?.user?.id && cloudLoadedUser.current !== active.user.id) {
          cloudLoadedUser.current = active.user.id;
          const meta = enableCloudSync(); setSyncStatus(meta);
          const remoteData = await pullRemoteData(loadData()).catch(() => null);
          if (remoteData && !cancelled) { applyRemoteData(remoteData); flash("Account data loaded."); }
        }
      } catch {
        if (!cancelled) { cloudLoadedUser.current = ""; setCloudSession(null); }
      }
    }
    loadSession();
    const unsubscribe = subscribeToAuthChanges((session) => {
      if (!session) { cloudLoadedUser.current = ""; setCloudSession(null); return; }
      loadSession(session);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!supabaseConfig.configured) { setCloudHealth({ status: "missing-config", message: "Cloud backup not available in this build." }); return undefined; }
    if (!online) { setCloudHealth({ status: "offline", message: "Offline — local data is still saved." }); return undefined; }
    let cancelled = false;
    async function check() {
      try {
        const result = await checkSupabaseConnection();
        if (!cancelled) setCloudHealth({ status: result.authenticated ? "authenticated" : "reachable", message: result.message || (result.authenticated ? "Signed in — sync is active." : "Supabase reachable. Sign in to sync.") });
      } catch (err) {
        if (!cancelled) setCloudHealth({ status: "error", message: err.message || "Connection failed." });
      }
    }
    check();
    return () => { cancelled = true; };
  }, [online, cloudSession?.user?.id]);

  useEffect(() => {
    if (!cloudSession?.user?.id || !syncStatus.enabled || !online || syncing) return undefined;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => { runCloudSync({ quiet: true }).catch(() => null); }, 2500);
    return () => window.clearTimeout(syncTimer.current);
  }, [data, cloudSession?.user?.id, syncStatus.enabled, online]);

  useEffect(() => {
    if (locked || !security) return undefined;
    const timeout = Math.max(1, number(data.profile.sessionTimeout) || 15) * 60 * 1000;
    let timer;
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setLocked(true), timeout); };
    ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, reset));
    reset();
    return () => { window.clearTimeout(timer); ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.removeEventListener(ev, reset)); };
  }, [locked, security, data.profile.sessionTimeout]);

  /* ─── Helpers ─── */
  function flash(message) { setNotice(message); window.setTimeout(() => setNotice(""), 4500); }

  function setProfile(patch) { setData((d) => ({ ...d, profile: { ...d.profile, ...patch } })); }

  function updateCustom(patch) { setCustom((c) => ({ ...c, ...patch })); }

  function friendlyError(err, fallback = "Something went wrong. Please try again.") {
    const msg = String(err?.message || "");
    if (msg === "Failed to fetch" || err instanceof TypeError) return "Could not connect. Check your internet.";
    if (msg.includes("GEMINI_API_KEY")) return "AI help is not available right now.";
    if (msg.includes("USDA_API_KEY"))   return "USDA search is not available right now. Try manual entry.";
    return msg || fallback;
  }

  async function runCloudSync({ quiet = false } = {}) {
    if (!supabaseConfig.configured) return flash("Cloud backup not available.");
    if (!cloudSession?.user?.id)    return flash("Sign in before syncing.");
    if (!online)                    return flash("Offline — changes saved locally.");
    setSyncing(true);
    if (!quiet) setNotice("Syncing…");
    try {
      const merged = await syncCalTrack(data, cloudSession);
      applyRemoteData(merged);
      setSyncStatus(readSyncStatus());
      if (!quiet) flash("Cloud backup complete.");
    } catch (err) {
      if (!quiet) flash(friendlyError(err, "Cloud backup failed."));
      throw err;
    } finally { setSyncing(false); }
  }

  async function disconnectCloud() {
    await signOut();
    setCloudSession(null);
    flash("Signed out. Local data remains on this device.");
  }

  function dismissOnboarding() { localStorage.setItem("caltrack.v2.onboarding", "dismissed"); setOnboardingDismissed(true); }

  async function setupPin({ pin, email = "", onStatus = () => {} }) {
    onStatus("Saving PIN…");
    const next = await hashPin(pin);
    const record = { ...next, owner: email };
    localStorage.setItem(SECURITY_KEY, JSON.stringify(record));
    setSecurity(record);
    // Cloud session may arrive later via magic link click — handled by subscribeToAuthChanges
    const existingSession = await getCurrentSession().catch(() => null);
    if (existingSession) {
      onStatus("Syncing your data…");
      try {
        setCloudSession(existingSession); cloudLoadedUser.current = existingSession.user.id; enableCloudSync();
        const merged = await syncCalTrack(loadData(), existingSession); applyRemoteData(merged);
      } catch { /* non-fatal */ }
    }
    setLocked(false); return true;
  }

  async function unlock(pin) {
    if (!security) return false;
    const candidate = await hashPin(pin, security.salt);
    if (candidate.hash !== security.hash) return false;
    setLocked(false);
    const email = security.owner;
    if (supabaseConfig.configured && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      try {
        let session = cloudSession || await getCurrentSession().catch(() => null);
        if (session && !cloudSession) { setCloudSession(session); cloudLoadedUser.current = session.user.id; enableCloudSync(); }
        if (session) { const merged = await syncCalTrack(loadData(), session); applyRemoteData(merged); }
      } catch { /* non-fatal */ }
    }
    return true;
  }

  async function changePin() {
    if (pinChange.next !== pinChange.confirm || !/^\d{4,8}$/.test(pinChange.next)) return flash("New PINs must match and be 4–8 digits.");
    if (security && !(await unlock(pinChange.current))) return flash("Current PIN is incorrect.");
    const next = await hashPin(pinChange.next);
    const record = { ...next, owner: security?.owner || data.profile.name || "" };
    localStorage.setItem(SECURITY_KEY, JSON.stringify(record));
    setSecurity(record); setLocked(false);
    setPinChange({ current: "", next: "", confirm: "" });
    flash(security ? "PIN changed." : "PIN lock created.");
  }

  function updateDailyLog(patch) {
    setData((d) => ({ ...d, dailyLogs: { ...d.dailyLogs, [date]: { water: 0, notes: "", activities: [], medsTaken: [], healthFlags: {}, ...(d.dailyLogs[date] || {}), ...patch } } }));
  }

  function addWater(ml) { updateDailyLog({ water: Math.max(0, number(dailyLog.water) + ml) }); flash(`+${Math.round(ml)} ml water.`); }
  function patchDailyLog(patch) { updateDailyLog(patch); }

  function openLogFood(food) {
    setSelectedFood(food);
    setLogForm({ grams: food.servingGrams || 100, meal: logForm.meal });
  }

  function saveFoodToDiary(food, grams, meal) {
    const nutrition = scaleNutrition(food.per100, grams);
    const entry = {
      id: makeId(), date, meal,
      name: food.name, brand: food.brand || "", source: food.source || "Custom food",
      sourceId: food.sourceId || "", ingredients: food.ingredients || "",
      confidence: food.confidence || "manual",
      grams: round(grams), per100: food.per100, ...nutrition,
    };
    const shouldRemember = !["Saved recipe", "Package calculator"].includes(food.source || "");
    setData((d) => ({
      ...d,
      diary: { ...d.diary, [date]: [...(d.diary[date] || []), entry] },
      customFoods: shouldRemember && !foodAlreadySaved(d.customFoods, food)
        ? [rememberedFood(food), ...d.customFoods]
        : d.customFoods,
    }));
    if (["Open Food Facts", "USDA FoodData Central"].includes(food.source || "")) {
      cacheFoodResult(food, query).catch(() => null);
    }
    flash(`${food.name} added to ${meal.toLowerCase()}.`);
    try {
      const goal = calcDailyTarget(data.profile);
      const nextCal = totals.calories + number(entry.calories);
      if (goal > 0 && nextCal >= goal * 0.98 && nextCal <= goal * 1.05 && window.confetti) {
        window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#FF4500","#FF7A00","#00E5FF","#A99CFF"] });
      }
    } catch {}
  }

  function confirmSelectedFood() {
    if (!selectedFood || number(logForm.grams) <= 0) return;
    saveFoodToDiary(selectedFood, logForm.grams, logForm.meal);
    setSelectedFood(null);
  }

  function removeFood(id) {
    setData((d) => ({ ...d, diary: { ...d.diary, [date]: (d.diary[date] || []).filter((e) => e.id !== id) } }));
  }

  function saveCustomFood() {
    if (!custom.name.trim() || number(custom.servingGrams) <= 0 || number(custom.calories) <= 0) {
      return flash("Add a name, serving grams, and calories.");
    }
    const sg = number(custom.servingGrams);
    const food = {
      id: makeId(), name: custom.name.trim(), brand: custom.brand.trim(),
      source: "Custom food", servingGrams: sg,
      per100: {
        calories: round((number(custom.calories) / sg) * 100),
        protein:  round((number(custom.protein)  / sg) * 100),
        carbs:    round((number(custom.carbs)     / sg) * 100),
        fat:      round((number(custom.fat)       / sg) * 100),
        fiber:    round((number(custom.fiber)     / sg) * 100),
      },
      confidence: "manual",
    };
    setData((d) => ({ ...d, customFoods: [food, ...d.customFoods] }));
    openLogFood(food);
    setCustom({ name: "", brand: "", servingGrams: 100, confidence: "manual", ...EMPTY_NUTRITION });
    setShowManual(false);
  }

  async function searchOpenFoodFacts() {
    if (!query.trim()) return flash("Enter a food name first.");
    setResults([]);
    setBusy(true); setNotice("Searching…");
    try {
      const q = query.trim();
      const saved  = searchSavedFoods(data.customFoods, q);
      const cached = await searchFoodCache(q);
      const starter = searchSavedFoods(STARTER_FOODS, q);
      const local = simplifyFoods(mergeFoods(saved, cached, starter));
      if (local.length) { setResults(local); setNotice(""); return; }
      let off = [];
      try {
        const payload = await searchOpenFoodFactsPayload(q);
        off = (payload.products || []).map(openFoodFactsFood).filter((f) => f.per100.calories > 0);
      } catch (err) { if (!local.length) throw err; }
      const foods = simplifyFoods(mergeFoods(off));
      setResults(foods);
      if (!foods.length) throw new Error("No foods found. Try USDA search or enter manually.");
    } catch (err) { flash(friendlyError(err, "Search failed.")); }
    finally { setBusy(false); setNotice(""); }
  }

  async function searchOpenFoodFactsPayload(q) {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 4500);
    try {
      const local = await fetch(API.openFoodFacts, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, pageSize: 20 }), signal: ctrl.signal }).catch(() => null);
      if (local?.ok && local.headers.get("content-type")?.includes("application/json")) return local.json();
    } finally { window.clearTimeout(t); }
    const params = new URLSearchParams({ search_terms: q, search_simple: "1", action: "process", json: "1", page_size: "20", sort_by: "unique_scans_n", fields: "code,product_name,generic_name,brands,serving_quantity,ingredients_text,nutriments" });
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
    if (!res.ok) throw new Error("Food search unavailable right now.");
    return res.json();
  }

  async function searchUsda() {
    if (!query.trim()) return flash("Enter a food name first.");
    setResults([]);
    setBusy(true); setNotice("Searching USDA…");
    try {
      const res = await fetch(API.usda, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.trim(), pageSize: 20 }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "USDA search failed.");
      const payload = await res.json();
      const foods = simplifyFoods((payload.foods || []).map(usdaFood).filter((f) => f.per100.calories > 0));
      setResults(foods);
      if (!foods.length) flash("No USDA foods found.");
    } catch (err) { flash(friendlyError(err, "USDA search failed.")); }
    finally { setBusy(false); setNotice(""); }
  }

  async function analyzeFoodPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return flash("Choose an image file.");
    setScanPreview(URL.createObjectURL(file));
    setBusy(true); setNotice("Analysing photo with AI…");
    setPendingLogFood(null); setAiPhotoResult("");
    try {
      const optimized = await optimizeImage(file);
      let imageData = optimized.dataUrl;
      if (imageData.length > 3_000_000) {
        const bmp = await createImageBitmap(optimized.blob);
        const ratio = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
        const cvs = document.createElement("canvas");
        cvs.width  = Math.round(bmp.width  * ratio);
        cvs.height = Math.round(bmp.height * ratio);
        cvs.getContext("2d").drawImage(bmp, 0, 0, cvs.width, cvs.height);
        bmp.close?.();
        imageData = await new Promise((res) => cvs.toBlob((b) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }, "image/jpeg", 0.72));
      }
      const response = await fetch("/api/gemini", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "meal-photo", image: imageData, text: mealDescription.trim() || undefined, daily: { totals, calorieTarget: dailyTarget } }),
      });
      if (!response.ok) { const p = await response.json().catch(() => ({})); throw new Error(p.error || "AI analysis failed."); }
      const { analysis } = await response.json();
      const parsed = parseAiNutrition(analysis);
      setAiPhotoResult(analysis);
      setPendingLogFood({ name: parsed.name || mealDescription.trim() || "AI meal estimate", servingGrams: 100, calories: parsed.calories || "", protein: parsed.protein || "", carbs: parsed.carbs || "", fat: parsed.fat || "", fiber: parsed.fiber || "", confidence: "ai" });
      setNotice("");
    } catch (err) { flash(friendlyError(err, "Photo analysis failed. Try manual entry.")); }
    finally { setBusy(false); }
  }

  function getAiCache() { try { return JSON.parse(localStorage.getItem("caltrack.v2.aicache") || "{}"); } catch { return {}; } }
  function setAiCache(key, value) {
    try {
      const cache = getAiCache();
      cache[key.toLowerCase().trim()] = { value, ts: Date.now() };
      const entries = Object.entries(cache).sort((a, b) => b[1].ts - a[1].ts).slice(0, 100);
      localStorage.setItem("caltrack.v2.aicache", JSON.stringify(Object.fromEntries(entries)));
    } catch {}
  }

  async function describeMealToAi() {
    if (!mealDescription.trim()) return flash("Describe what you ate first.");
    const cacheKey = mealDescription.toLowerCase().trim();
    const cached = getAiCache()[cacheKey];
    if (cached) {
      const parsed = parseAiNutrition(cached.value);
      setPendingLogFood({ name: parsed.name || mealDescription.trim().slice(0, 60), servingGrams: 100, calories: parsed.calories || "", protein: parsed.protein || "", carbs: parsed.carbs || "", fat: parsed.fat || "", fiber: parsed.fiber || "", confidence: "ai" });
      flash("Loaded from cache."); return;
    }
    setBusy(true); setNotice("AI estimating your meal…");
    try {
      const response = await fetch("/api/gemini", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "portion", text: mealDescription.trim(), daily: { totals, calorieTarget: dailyTarget } }),
      });
      if (!response.ok) { const p = await response.json().catch(() => ({})); throw new Error(p.error || "AI failed."); }
      const { analysis } = await response.json();
      setAiCache(cacheKey, analysis);
      const parsed = parseAiNutrition(analysis);
      setPendingLogFood({ name: parsed.name || mealDescription.trim().slice(0, 60), servingGrams: 100, calories: parsed.calories || "", protein: parsed.protein || "", carbs: parsed.carbs || "", fat: parsed.fat || "", fiber: parsed.fiber || "", confidence: "ai" });
      setNotice("");
    } catch (err) { flash(friendlyError(err, "AI estimation failed.")); setNotice(""); }
    finally { setBusy(false); }
  }

  function saveMeasurement() {
    const hasData = ["weight","waist","neck","hip"].some((k) => number(measurement[k]) > 0);
    if (!hasData) return flash("Enter at least one measurement.");
    const entry = {
      id: makeId(), date,
      weight: number(measurement.weight) > 0 ? round(measurement.weight) : "",
      waist:  number(measurement.waist)  > 0 ? round(measurement.waist)  : "",
      neck:   number(measurement.neck)   > 0 ? round(measurement.neck)   : "",
      hip:    number(measurement.hip)    > 0 ? round(measurement.hip)    : "",
    };
    setData((d) => {
      const p = {};
      if (number(measurement.weight) > 0) p.weight = entry.weight;
      if (number(measurement.waist)  > 0) p.waist  = entry.waist;
      if (number(measurement.neck)   > 0) p.neck   = entry.neck;
      if (number(measurement.hip)    > 0) p.hip    = entry.hip;
      return { ...d, measurements: [...d.measurements.filter((m) => m.date !== date), entry], profile: Object.keys(p).length ? { ...d.profile, ...p } : d.profile };
    });
    setMeasurement({ weight: "", waist: "", neck: "", hip: "" });
    flash(`Measurement saved for ${date}.`);
  }

  function deleteMeasurement(id) {
    setData((d) => ({ ...d, measurements: d.measurements.filter((m) => m.id !== id) }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `pulse-backup-${localDate()}.json`; link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    if (!file) return;
    if (file.size > 8_000_000) return flash("Backup is too large.");
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.profile || !parsed.diary) throw new Error();
      setData({ ...defaultData, ...parsed, profile: { ...defaultData.profile, ...parsed.profile } });
      flash("Backup imported.");
    } catch { flash("That file is not a valid PULSE backup."); }
  }

  function autoCalcTargets() {
    const tdee = calcTDEE(data.profile);
    if (!tdee) return flash("Fill in sex, age, height, and weight first.");
    const target = calcDailyTarget(data.profile);
    const w = number(data.profile.weight);
    const proteinG = Math.round(w * 1.8);
    const fatG     = Math.round(target * 0.28 / 9);
    const carbsG   = Math.max(50, Math.round((target - proteinG * 4 - fatG * 9) / 4));
    setProfile({ calorieTarget: target, proteinTarget: proteinG, carbsTarget: carbsG, fatTarget: fatG, fiberTarget: 30 });
    flash("Targets calculated from your profile.");
  }

  /* ─── Lock check ─── */
  if (locked) return <LockScreen mode={security ? "unlock" : "setup"} onUnlock={unlock} onSetup={setupPin} owner={security?.owner} />;

  /* ─── Main render ─── */
  const isNewUser = !onboardingDismissed && !Object.values(data.diary).some((e) => e.length) && !data.measurements.length;

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <img src={logo2Src} alt="PULSE" className="brand-logo app-logo" />
        <span style={{ fontSize: 12, color: "var(--text3)" }}>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
      </header>

      {/* Onboarding */}
      {tab === "diary" && isNewUser && (
        <div className="onboarding-banner">
          <div className="onboarding-header">
            <span className="eyebrow">Getting started</span>
            <button className="dismiss-button" onClick={dismissOnboarding}>✕ Dismiss</button>
          </div>
          <h2>Log your first meal to get started.</h2>
          <div className="onboarding-steps">
            <div><b>1</b><span>Set goals in the Me tab</span></div>
            <div><b>2</b><span>Log a meal</span></div>
            <div><b>3</b><span>Track your progress</span></div>
          </div>
          <div className="onboarding-actions">
            <button className="secondary" onClick={() => setTab("settings")}>Set goals</button>
            <button className="primary"   onClick={() => setTab("add")}>Log first meal</button>
          </div>
        </div>
      )}

      <main ref={mainRef}>

        {/* ═══ TODAY ═══ */}
        {tab === "diary" && (() => {
          const burnedToday   = (dailyLog.activities || []).reduce((s, a) => s + number(a.kcal), 0);
          const netConsumed   = Math.max(0, totals.calories - burnedToday);
          const netRemaining  = dailyTarget - netConsumed;
          const bmr           = calcBMRMifflin(data.profile) || 0;
          const tdee          = calcTDEE(data.profile) || 0;
          const deficitKcal   = bmr > 0 ? bmr - dailyTarget : 0;
          const deficitPct    = bmr > 0 ? Math.round((deficitKcal / bmr) * 100) : 0;
          const weightEntries2= [...data.measurements].filter((m) => number(m.weight) > 0).sort((a,b) => a.date.localeCompare(b.date));
          const startW        = number(data.profile.highestWeight) || (weightEntries2[0] ? number(weightEntries2[0].weight) : 0);
          const curW          = weightEntries2.length ? number(weightEntries2[weightEntries2.length-1].weight) : number(data.profile.weight);
          const goalW         = number(data.profile.goalWeight);
          const lost          = startW && curW ? round(startW - curW) : 0;
          const toGo          = curW && goalW ? round(curW - goalW) : 0;
          const journeyPct    = startW && goalW && startW > goalW ? Math.min(100, Math.max(0, (lost / (startW - goalW)) * 100)) : 0;

          const motivational = (() => {
            if (!curW) return "Set your weight in Me tab to track progress.";
            if (journeyPct >= 100) return "🎉 Goal reached! You crushed it.";
            if (journeyPct >= 75)  return `Almost there! Only ${toGo} kg to go.`;
            if (journeyPct >= 50)  return `Halfway there — ${lost} kg down, ${toGo} kg to go!`;
            if (journeyPct >= 25)  return `Great start — ${lost} kg down so far!`;
            if (lost > 0)          return `${lost} kg down. Every day counts — keep going!`;
            return goalW && curW > goalW ? `${toGo} kg to your goal. Log consistently and you'll get there.` : "Log your meals daily to see your progress here.";
          })();

          return (
            <>
              {/* Hero ring */}
              <div className="today-hero">
                <div className="hero-ring-wrap">
                  <CalorieRing consumed={Math.round(totals.calories)} burned={Math.round(burnedToday)} target={dailyTarget} percent={caloriePercent} size={168} />
                  {burnedToday > 0 && (
                    <div className="ring-legend">
                      <span className="ring-legend-dot" style={{ background: "#ff4500" }} />eaten
                      <span className="ring-legend-dot" style={{ background: "#00d278", marginLeft: 8 }} />burned
                    </div>
                  )}
                </div>
                <div className="hero-ring-copy">
                  <strong className={`hero-kcal${netRemaining < 0 ? " over" : ""}`}>{Math.abs(Math.round(netRemaining))}</strong>
                  <span className="hero-sub">{netRemaining >= 0 ? "kcal left today" : "kcal over target"}</span>
                  <span className="hero-ratio">{Math.round(totals.calories)} eaten · {Math.round(burnedToday)} burned · {dailyTarget} target</span>
                </div>
              </div>

              {/* BMR / deficit strip */}
              {bmr > 0 && (
                <div className="bmr-strip">
                  <div className="bmr-stat"><span>Doing nothing (BMR)</span><strong>{bmr} kcal</strong></div>
                  <div className="bmr-stat"><span>Safe eat target</span><strong style={{ color: "var(--accent)" }}>{dailyTarget} kcal</strong></div>
                  {deficitKcal > 0 && <div className="bmr-stat"><span>Daily deficit</span><strong style={{ color: "var(--success)" }}>−{deficitKcal} kcal</strong></div>}
                  {deficitPct > 0 && <div className="bmr-stat"><span>Fat burn rate</span><strong style={{ color: "var(--success)" }}>−{deficitPct}% of BMR</strong></div>}
                </div>
              )}

              {/* Macro row */}
              <div className="macro-grid">
                {[
                  { label: "Protein", value: totals.protein, target: data.profile.proteinTarget, color: "#4dc3ff" },
                  { label: "Carbs",   value: totals.carbs,   target: data.profile.carbsTarget,   color: "#a99cff" },
                  { label: "Fat",     value: totals.fat,     target: data.profile.fatTarget,     color: "#ff4500" },
                ].map((m) => {
                  const pct = m.target ? Math.min(100, (m.value / m.target) * 100) : 0;
                  return (
                    <div key={m.label} className="macro-chip">
                      <strong>{round(m.value)}g</strong>
                      <span>{m.label}</span>
                      <div className="macro-bar-rail">
                        <div className="macro-bar-fill" style={{ width: `${pct}%`, background: m.color }} />
                      </div>
                      <small>{m.target ? `${m.target}g goal` : "—"}</small>
                    </div>
                  );
                })}
              </div>

              {/* Water card */}
              <div className="water-card">
                <div className="water-top">
                  <div className="water-left">
                    <Droplets size={18} color="#4dc3ff" />
                    <span className="water-title">Water</span>
                  </div>
                  <span className="water-value">{Math.round(number(dailyLog.water))} / {data.profile.waterTarget || 2500} ml</span>
                </div>
                <div className="water-dots">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`water-dot${number(dailyLog.water) >= (i + 1) * 250 ? " filled" : ""}`} />
                  ))}
                </div>
                <button className="water-add" onClick={() => addWater(250)}>+250 ml</button>
              </div>

              {/* Activity card */}
              <ActivityCard dailyLog={dailyLog} patchDailyLog={patchDailyLog} weightKg={data.profile.weight} />

              {/* Weight progress strip */}
              <div className="weight-strip">
                {startW && curW ? (
                  <>
                    <div className="weight-strip-numbers">
                      <div className="weight-strip-stat"><strong>{startW} kg</strong><span>Start</span></div>
                      <div className="weight-strip-progress">
                        <div className="weight-strip-bar-track">
                          <div className="weight-strip-bar-fill" style={{ width: `${journeyPct}%` }} />
                          <div className="weight-strip-marker" style={{ left: `${journeyPct}%` }}>{curW} kg</div>
                        </div>
                        <div className="weight-strip-bar-labels">
                          <span>Start {startW} kg</span>
                          {goalW ? <span>Goal {goalW} kg</span> : null}
                        </div>
                      </div>
                      {goalW ? <div className="weight-strip-stat right"><strong>{goalW} kg</strong><span>Goal</span></div> : null}
                    </div>
                    <p className="weight-strip-motivation">{motivational}</p>
                  </>
                ) : (
                  <p className="weight-strip-motivation" style={{ textAlign: "center" }}>
                    Log your weight in <strong style={{ color: "var(--accent)" }}>Me → Profile</strong> to see your journey here.
                  </p>
                )}
              </div>

              {/* Today's log — collapsible meal summary */}
              <details className="todays-log-section">
                <summary className="todays-log-summary">
                  <span>📋 Today's Log</span>
                  <span className="todays-log-meta">
                    {items.length} item{items.length !== 1 ? "s" : ""} · {Math.round(totals.calories)} kcal
                    <ChevronRight size={14} className="meal-chevron" />
                  </span>
                </summary>
                <div className="todays-log-body">
                  {MEALS.map((meal) => {
                    const mealItems = items.filter((e) => e.meal === meal);
                    if (!mealItems.length) return null;
                    const mealCals = totalsFor(mealItems).calories;
                    return (
                      <div key={meal} className="todays-log-meal">
                        <div className="todays-log-meal-header">
                          <span>{MEAL_ICONS[meal]} {meal}</span>
                          <span className="todays-log-meal-cal">{Math.round(mealCals)} kcal</span>
                        </div>
                        {mealItems.map((item) => (
                          <div key={item.id} className="todays-log-item">
                            <span className="todays-log-item-name">{item.name}</span>
                            <span className="todays-log-item-cal">{Math.round(item.calories)}</span>
                            <button className="food-delete" onClick={() => removeFood(item.id)} aria-label="Remove">
                              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="todays-log-empty">No food logged yet today. Tap + to add.</p>}
                </div>
              </details>

              {/* Streak — taps to Progress */}
              {streak > 0 && (
                <button className="streak-pill" onClick={() => setTab("progress")}>
                  <span className="streak-count">🔥{streak}</span>
                  <div className="streak-label">
                    <strong>{streak === 1 ? "1 day streak" : `${streak}-day streak`}</strong>
                    <span>Tap to see your full history →</span>
                  </div>
                  <div className="streak-dots">
                    {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
                      <div key={i} className={`streak-dot${i < streak ? " lit" : ""}`} />
                    ))}
                  </div>
                </button>
              )}
            </>
          );
        })()}

        {/* ═══ LOG ═══ */}
        {tab === "add" && (
          <div className="log-screen">
            <h2>What did you eat?</h2>

            {/* Meal tabs */}
            <div className="meal-tabs">
              {MEALS.map((m) => (
                <button key={m} className={`meal-tab${logForm.meal === m ? " active" : ""}`} onClick={() => setLogForm((f) => ({ ...f, meal: m }))}>
                  {MEAL_ICONS[m]} {m}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="search-bar-wrap">
              <Search size={18} className="search-bar-icon" />
              <input
                className="search-bar"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchOpenFoodFacts()}
                placeholder="Search foods…"
                autoFocus
              />
              {query && <button className="search-bar-clear" onClick={() => { setQuery(""); setResults([]); }}>✕</button>}
            </div>
            <div className="search-actions">
              <button className="secondary" onClick={searchOpenFoodFacts} disabled={busy}>Search</button>
              <button className="secondary" onClick={searchUsda} disabled={busy}>USDA</button>
            </div>

            {/* AI tools */}
            <div className="ai-tools">
              <label className="ai-tool-btn ai-tool-camera">
                <div className="ai-tool-icon ai-icon-camera"><Camera size={20} /></div>
                Photo
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => analyzeFoodPhoto(e.target.files?.[0])} />
              </label>
              <button className="ai-tool-btn" onClick={() => setDescribeOpen((v) => !v)}>
                <div className="ai-tool-icon ai-icon-describe"><Brain size={20} /></div>
                Describe
              </button>
            </div>

            {/* Describe input */}
            {describeOpen && (
              <div className="describe-box">
                <input
                  value={mealDescription}
                  onChange={(e) => setMealDescription(e.target.value)}
                  placeholder="e.g. nasi lemak with egg and sambal…"
                  onKeyDown={(e) => e.key === "Enter" && describeMealToAi()}
                  autoFocus
                />
                <button className="primary" style={{ flexShrink: 0 }} onClick={describeMealToAi} disabled={busy}>Estimate</button>
              </div>
            )}

            {/* Photo preview */}
            {scanPreview && <img src={scanPreview} alt="Food photo" className="scan-preview" />}

            {/* Pending AI result */}
            {pendingLogFood?.calories && (
              <div className="pending-card">
                <h4>{pendingLogFood.name}</h4>
                <p>
                  {pendingLogFood.calories} kcal · P {pendingLogFood.protein || 0}g · C {pendingLogFood.carbs || 0}g · F {pendingLogFood.fat || 0}g
                  {pendingLogFood.confidence === "ai" && " · AI estimate"}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="primary" style={{ flex: 1 }} onClick={() => {
                    saveFoodToDiary({
                      name: pendingLogFood.name, confidence: "ai",
                      per100: { calories: number(pendingLogFood.calories), protein: number(pendingLogFood.protein), carbs: number(pendingLogFood.carbs), fat: number(pendingLogFood.fat), fiber: number(pendingLogFood.fiber) },
                    }, 100, logForm.meal);
                    setPendingLogFood(null); setScanPreview(""); setAiPhotoResult("");
                  }}>Add to {logForm.meal}</button>
                  <button className="secondary" onClick={() => { setPendingLogFood(null); setScanPreview(""); setAiPhotoResult(""); }}>Discard</button>
                </div>
              </div>
            )}

            {/* Results */}
            {displayResults.length > 0 && (
              <div className="results-section">
                <p className="results-label">{query.trim() ? "Results" : "Quick add"}</p>
                <div className="results-list">
                  {displayResults.slice(0, 12).map((food) => {
                    const cal = Math.round(scaleNutrition(food.per100, food.servingGrams).calories);
                    return (
                      <button key={`${food.source}-${food.id}`} className="result-item" onClick={() => openLogFood(food)}>
                        <div className="result-info">
                          <span className="result-name">{cleanFoodName(food.name)}</span>
                          <span className="result-sub">{food.brand || food.source} · {food.servingGrams}g</span>
                        </div>
                        <span className="result-cal">{cal}</span>
                        <Plus size={18} color="var(--accent)" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual entry toggle */}
            <button className="manual-entry-toggle" onClick={() => setShowManual((v) => !v)}>
              <Plus size={14} /> Enter manually
            </button>
            {showManual && (
              <div className="manual-form">
                <div className="form-grid">
                  <Field label="Food name" value={custom.name} onChange={(e) => updateCustom({ name: e.target.value })} />
                  <Field label="Serving" suffix="g" type="number" min="0" value={custom.servingGrams} onChange={(e) => updateCustom({ servingGrams: e.target.value })} />
                  <Field label="Calories" suffix="kcal" type="number" min="0" value={custom.calories} onChange={(e) => updateCustom({ calories: e.target.value })} />
                  <Field label="Protein" suffix="g" type="number" min="0" value={custom.protein} onChange={(e) => updateCustom({ protein: e.target.value })} />
                  <Field label="Carbs" suffix="g" type="number" min="0" value={custom.carbs} onChange={(e) => updateCustom({ carbs: e.target.value })} />
                  <Field label="Fat" suffix="g" type="number" min="0" value={custom.fat} onChange={(e) => updateCustom({ fat: e.target.value })} />
                </div>
                <button className="primary" onClick={saveCustomFood}>Save &amp; add</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ PROGRESS ═══ */}
        {tab === "progress" && (
          <div className="progress-screen">
            <WeightJourneyCard
              entries={weightEntries}
              highestWeight={data.profile.highestWeight}
              currentWeight={data.profile.weight}
              goalWeight={number(data.profile.goalWeight) || null}
              setData={setData}
              flash={flash}
            />

            {/* Body composition card */}
            {(() => {
              const bc = calcBodyComposition(data.profile);
              if (!bc) return (
                <div className="bodyfat-card">
                  <h3>Body Composition</h3>
                  <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>
                    Add your <strong style={{ color: "var(--text2)" }}>waist, neck{data.profile.gender === "female" ? ", and hip" : ""}</strong> measurements in the Me tab to unlock body fat %, lean mass, and a personalised calorie target using the US Navy formula.
                  </p>
                </div>
              );
              const tdee = calcTDEE(data.profile);
              const target = calcDailyTarget(data.profile);
              const deficitPct = tdee > 0 ? Math.round((1 - target / tdee) * 100) : 0;
              const bfColor = bc.bf < 15 ? "#00d278" : bc.bf < 25 ? "#ff8c00" : "#ff5050";
              return (
                <div className="bodyfat-card">
                  <h3>Body Composition (US Navy Formula)</h3>
                  <div className="bodyfat-grid">
                    <div className="bodyfat-stat"><strong style={{ color: bfColor }}>{bc.bf}%</strong><span>Body Fat</span></div>
                    <div className="bodyfat-stat"><strong>{bc.leanMass} kg</strong><span>Lean Mass</span></div>
                    <div className="bodyfat-stat"><strong>{bc.fatMass} kg</strong><span>Fat Mass</span></div>
                  </div>
                  <div className="bodyfat-bar-wrap">
                    <div className="bodyfat-bar-track">
                      <div className="bodyfat-bar-fill" style={{ width: `${Math.min(100, bc.bf * 2.5)}%` }} />
                    </div>
                    <div className="bodyfat-bar-labels"><span>Essential</span><span>Fit</span><span>Average</span><span>Obese</span></div>
                  </div>
                  {tdee > 0 && (
                    <div className="calculation">
                      <div><span>TDEE</span><strong>{tdee} kcal</strong></div>
                      <div><span>Daily target</span><strong>{target} kcal</strong></div>
                      {deficitPct > 0 && <div><span>Deficit</span><strong style={{ color: "var(--success)" }}>−{deficitPct}%</strong></div>}
                    </div>
                  )}
                  <p className="bodyfat-hint">Based on height {data.profile.height} cm · waist {data.profile.waist} cm · neck {data.profile.neck} cm{data.profile.hip ? ` · hip ${data.profile.hip} cm` : ""}. Update measurements in Me tab for a fresh reading.</p>
                </div>
              );
            })()}

            <div className="tool-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">7 days</span>
                  <h2>Calorie history</h2>
                </div>
              </div>
              <CalorieChart diary={data.diary} target={dailyTarget} />
              {streak > 0 && (
                <div className="streak-pill" style={{ marginTop: 10 }}>
                  <span className="streak-count">🔥{streak}</span>
                  <div className="streak-label"><strong>{streak}-day logging streak</strong></div>
                </div>
              )}
            </div>

            <div className="tool-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Log measurement</span>
                  <h2><Scale size={16} style={{ verticalAlign: "middle", marginRight: 5 }} />Body Measurements</h2>
                </div>
              </div>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <Field label="Weight" suffix="kg" type="number" step="0.1" min="20" max="300" value={measurement.weight} onChange={(e) => setMeasurement((m) => ({ ...m, weight: e.target.value }))} />
                <Field label="Waist" suffix="cm" type="number" step="0.1" min="40" max="200" value={measurement.waist} onChange={(e) => setMeasurement((m) => ({ ...m, waist: e.target.value }))} />
                <Field label="Neck" suffix="cm" type="number" step="0.1" min="20" max="70" value={measurement.neck || ""} onChange={(e) => setMeasurement((m) => ({ ...m, neck: e.target.value }))} />
                {data.profile.gender === "female" && (
                  <Field label="Hip" suffix="cm" type="number" step="0.1" min="50" max="200" value={measurement.hip || ""} onChange={(e) => setMeasurement((m) => ({ ...m, hip: e.target.value }))} />
                )}
              </div>
              <button className="primary" style={{ width: "100%", marginBottom: 14 }} onClick={saveMeasurement}>Save measurement</button>

              {sortedMeasurements.slice(0, 5).length > 0 && (
                <div className="history">
                  {sortedMeasurements.slice(0, 5).map((m) => (
                    <div key={m.id} className="entry-row">
                      <span className="entry-date">{m.date}</span>
                      {m.weight && <span className="entry-weight">{m.weight} kg</span>}
                      {m.waist  && <span className="entry-waist">{m.waist} cm waist</span>}
                      <button className="entry-delete" onClick={() => deleteMeasurement(m.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ME ═══ */}
        {tab === "settings" && (
          <div className="me-screen">
            {/* Profile */}
            <div className="tool-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Step 1</span>
                  <h2>Profile</h2>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Name" value={data.profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
                <label className="field">
                  <span>Sex</span>
                  <select value={data.profile.gender} onChange={(e) => setProfile({ gender: e.target.value })}>
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                <Field label="Age" suffix="yrs" type="number" min="10" max="120" value={data.profile.age} onChange={(e) => setProfile({ age: e.target.value })} />
                <Field label="Height" suffix="cm" type="number" min="100" max="250" value={data.profile.height} onChange={(e) => setProfile({ height: e.target.value })} />
                <Field label="Current weight" suffix="kg" type="number" step="0.1" min="20" max="300" value={data.profile.weight} onChange={(e) => setProfile({ weight: e.target.value })} />
                <Field label="Waist" suffix="cm" type="number" step="0.1" min="40" max="200" value={data.profile.waist} onChange={(e) => setProfile({ waist: e.target.value })} />
                <Field label="Neck" suffix="cm" type="number" step="0.1" min="20" max="70" value={data.profile.neck} onChange={(e) => setProfile({ neck: e.target.value })} />
                {data.profile.gender === "female" && (
                  <Field label="Hip" suffix="cm" type="number" step="0.1" min="50" max="200" value={data.profile.hip} onChange={(e) => setProfile({ hip: e.target.value })} />
                )}
                <label className="field">
                  <span>Activity level</span>
                  <select value={data.profile.activityLevel} onChange={(e) => setProfile({ activityLevel: e.target.value })}>
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light (1–3×/wk)</option>
                    <option value="moderate">Moderate (3–5×/wk)</option>
                    <option value="active">Active (6–7×/wk)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Goal</span>
                  <select value={data.profile.goalMode} onChange={(e) => setProfile({ goalMode: e.target.value })}>
                    <option value="lose">Lose weight</option>
                    <option value="maintain">Maintain weight</option>
                    <option value="gain">Gain muscle</option>
                  </select>
                </label>
                <Field label="Goal weight" suffix="kg" type="number" step="0.1" value={data.profile.goalWeight} onChange={(e) => setProfile({ goalWeight: e.target.value })} />
                <Field label="Highest weight" suffix="kg" type="number" step="0.1" value={data.profile.highestWeight} onChange={(e) => setProfile({ highestWeight: e.target.value })} />
              </div>
              <div className="profile-actions">
                <button className={`primary${profileSaved ? " btn-saved" : ""}`} onClick={() => {
                  if (profileSaveTimer.current) clearTimeout(profileSaveTimer.current);
                  setProfileSaved(true);
                  profileSaveTimer.current = setTimeout(() => setProfileSaved(false), 1800);
                }}>{profileSaved ? "✓ Saved!" : "Save profile"}</button>
              </div>
            </div>

            {/* Goals */}
            <div className="tool-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Step 2</span>
                  <h2><SlidersHorizontal size={16} style={{ verticalAlign: "middle", marginRight: 5 }} />Goals</h2>
                </div>
              </div>
              {calcTDEE(data.profile) > 0 && (() => {
                const tdee = calcTDEE(data.profile);
                const target = calcDailyTarget(data.profile);
                const deficitPct = tdee > 0 ? Math.round((1 - target / tdee) * 100) : 0;
                const bc = calcBodyComposition(data.profile);
                return (
                  <div className="calculation" style={{ marginBottom: 14 }}>
                    <div><span>TDEE (maintenance)</span><strong>{tdee} kcal</strong></div>
                    <div><span>Eating target</span><strong>{target} kcal</strong></div>
                    {deficitPct > 0 && <div><span>Calorie deficit</span><strong style={{ color: "var(--success)" }}>−{deficitPct}%</strong></div>}
                    {bc && <>
                      <div><span>Body fat %</span><strong style={{ color: "#ff8c00" }}>{bc.bf}%</strong></div>
                      <div><span>Lean mass</span><strong>{bc.leanMass} kg</strong></div>
                      <div><span>Fat mass</span><strong>{bc.fatMass} kg</strong></div>
                    </>}
                  </div>
                );
              })()}
              <div className="form-grid">
                <Field label="Daily calorie goal" suffix="kcal" type="number" min="0" value={data.profile.calorieTarget} onChange={(e) => setProfile({ calorieTarget: number(e.target.value) })} />
                <Field label="Protein goal" suffix="g" type="number" min="0" value={data.profile.proteinTarget} onChange={(e) => setProfile({ proteinTarget: number(e.target.value) })} />
                <Field label="Carbs goal" suffix="g" type="number" min="0" value={data.profile.carbsTarget} onChange={(e) => setProfile({ carbsTarget: number(e.target.value) })} />
                <Field label="Fat goal" suffix="g" type="number" min="0" value={data.profile.fatTarget} onChange={(e) => setProfile({ fatTarget: number(e.target.value) })} />
                <Field label="Water goal" suffix="ml" type="number" min="0" value={data.profile.waterTarget} onChange={(e) => setProfile({ waterTarget: number(e.target.value) })} />
              </div>
              <button className="secondary" onClick={autoCalcTargets}>Auto-calculate from profile</button>
            </div>

            {/* Security */}
            <div className="tool-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Privacy</span>
                  <h2><Stethoscope size={16} style={{ verticalAlign: "middle", marginRight: 5 }} />{security ? "Change PIN" : "Optional PIN lock"}</h2>
                </div>
                {security && <button className="secondary compact" onClick={() => setLocked(true)}>Lock now</button>}
              </div>
              <div className="form-grid">
                {security && <Field label="Current PIN" type="password" inputMode="numeric" value={pinChange.current} onChange={(e) => setPinChange((p) => ({ ...p, current: e.target.value.replace(/\D/g, "") }))} />}
                <Field label="New PIN" type="password" inputMode="numeric" value={pinChange.next} onChange={(e) => setPinChange((p) => ({ ...p, next: e.target.value.replace(/\D/g, "") }))} />
                <Field label="Confirm new PIN" type="password" inputMode="numeric" value={pinChange.confirm} onChange={(e) => setPinChange((p) => ({ ...p, confirm: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <button className="primary" onClick={changePin}>{security ? "Change PIN" : "Create PIN lock"}</button>
            </div>

            {/* Data */}
            <div className="tool-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Data</span>
                  <h2><Activity size={16} style={{ verticalAlign: "middle", marginRight: 5 }} />Backup &amp; Sync</h2>
                </div>
                <span className="feature-badge">
                  {!supabaseConfig.configured ? "Local only" : cloudHealth.status === "authenticated" ? "Synced" : cloudHealth.status === "offline" ? "Offline" : "Ready"}
                </span>
              </div>
              {supabaseConfig.configured && (
                <div className={`cloud-health ${cloudHealth.status === "error" ? "bad" : "good"}`}>
                  <strong>Cloud status</strong>
                  <span>{cloudHealth.message}</span>
                </div>
              )}
              {supabaseConfig.configured && cloudSession?.user && (
                <>
                  <div className="cloud-status">
                    <div><span>Signed in</span><strong>{cloudSession.user.email || cloudSession.user.id}</strong></div>
                    <div><span>Last sync</span><strong>{syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : "Not synced yet"}</strong></div>
                  </div>
                  <div className="settings-actions">
                    <button className="primary" disabled={syncing || !online} onClick={() => runCloudSync()}>Back up now</button>
                    <button className="secondary" disabled={syncing} onClick={disconnectCloud}>Sign out</button>
                  </div>
                </>
              )}
              <div className="settings-actions">
                <button className="secondary" onClick={exportData}>Export backup</button>
                <button className="secondary" onClick={() => importRef.current?.click()}>Import backup</button>
                <input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => importData(e.target.files?.[0])} />
                <button className="danger-button" onClick={() => setDeleteConfirm(true)}>Delete all data</button>
              </div>
              <p className="helper" style={{ marginTop: 10, fontSize: 11 }}>Your data lives on this device. Cloud backup is optional. The PIN only locks this screen.</p>
            </div>
          </div>
        )}
      </main>

      {/* ─── Bottom nav ─── */}
      <nav className="bottom-nav" role="tablist" aria-label="Primary navigation">
        {[
          ["diary",    "Today",    <CalendarDays size={22} strokeWidth={1.8} aria-hidden="true" />],
          ["add",      "Log",      <Plus         size={24} strokeWidth={2}   aria-hidden="true" />],
          ["progress", "Progress", <Activity     size={20} strokeWidth={1.8} aria-hidden="true" />],
          ["settings", "Me",       <User         size={20} strokeWidth={1.8} aria-hidden="true" />],
        ].map(([key, label, icon]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ─── FAB (Today only) ─── */}
      {tab === "diary" && (
        <button className="fab" aria-label="Log food" onClick={() => setTab("add")}>
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {/* ─── Food log modal ─── */}
      {selectedFood && (
        <div className="modal-backdrop" onClick={() => setSelectedFood(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="log-food-title" onClick={(e) => e.stopPropagation()}>
            <span className="eyebrow">Add to {logForm.meal.toLowerCase()}</span>
            <h2 id="log-food-title">{cleanFoodName(selectedFood.name)}</h2>
            <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>{selectedFood.brand || selectedFood.source}</p>
            <div className="portion-actions">
              <button className="secondary" onClick={() => setLogForm((f) => ({ ...f, grams: round((selectedFood.servingGrams || 100) / 2) }))}>Half</button>
              <button className="secondary" onClick={() => setLogForm((f) => ({ ...f, grams: selectedFood.servingGrams || 100 }))}>Typical</button>
              <button className="secondary" onClick={() => setLogForm((f) => ({ ...f, grams: round((selectedFood.servingGrams || 100) * 2) }))}>Double</button>
            </div>
            <div className="form-grid">
              <Field label="Amount eaten" suffix="g" type="number" min="0" value={logForm.grams} onChange={(e) => setLogForm((f) => ({ ...f, grams: e.target.value }))} />
              <label className="field">
                <span>Meal</span>
                <select value={logForm.meal} onChange={(e) => setLogForm((f) => ({ ...f, meal: e.target.value }))}>
                  {MEALS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
            </div>
            <div className="calculation">
              <div><span>Calories</span><strong>{scaleNutrition(selectedFood.per100, logForm.grams).calories} kcal</strong></div>
              <div><span>Macros</span><strong>P {scaleNutrition(selectedFood.per100, logForm.grams).protein}g · C {scaleNutrition(selectedFood.per100, logForm.grams).carbs}g · F {scaleNutrition(selectedFood.per100, logForm.grams).fat}g</strong></div>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setSelectedFood(null)}>Cancel</button>
              <button className="primary" onClick={confirmSelectedFood}>Add to {logForm.meal}</button>
            </div>
          </section>
        </div>
      )}

      {/* ─── Delete confirm modal ─── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" onClick={(e) => e.stopPropagation()}>
            <span className="eyebrow crimson">Destructive action</span>
            <h2 id="delete-confirm-title">Delete all data?</h2>
            <p className="helper" style={{ marginBottom: "1rem" }}>This will permanently erase all food logs, measurements, goals, and settings from this device. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setDeleteConfirm(false)}>Cancel</button>
              <button className="danger-button" onClick={() => { setData(defaultData); setDeleteConfirm(false); }}>Yes, delete everything</button>
            </div>
          </section>
        </div>
      )}

      {/* ─── Toast ─── */}
      {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
    </div>
  );
}

export default function AppV2() {
  return <ErrorBoundary><AppV2Inner /></ErrorBoundary>;
}
