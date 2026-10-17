/* state.js: state shape, localStorage, import/export, reset, API key helpers.
   The API key lives under its own localStorage key and is never part of state or exports. */
const STATE_KEY = "mc.state";
const API_KEY_STORE = "mc.apiKey";
const STATE_VERSION = 1;
const TRACKS = ["python", "sql", "tableau", "stats", "ml"];
const MODES = ["normal", "interview", "assessment", "project", "light"];
const BLOCK_TYPES = ["health", "learn", "apply", "network", "project", "practice", "interview", "rest", "assessment", "wrap"];
const TARGETS = { india: 14, remote: 7, linkedin: 20 };
const TARGET_LABELS = { india: "India applications", remote: "Remote applications", linkedin: "LinkedIn connections" };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- small helpers ---------- */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function num(v, d) { return Number.isFinite(v) && v >= 0 ? Math.floor(v) : (d || 0); }
function str(v, n) { return typeof v === "string" ? v.slice(0, n) : ""; }
function pad(n) { return String(n).padStart(2, "0"); }
function todayStr() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function dateMs(s) { const p = s.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
function daysBetween(a, b) { return Math.round((dateMs(b) - dateMs(a)) / 86400000); }
function addDays(s, n) { const d = new Date(dateMs(s) + n * 86400000); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }

/* ---------- state shape ---------- */
function defaultState() {
  const today = todayStr();
  return {
    version: STATE_VERSION,
    startDate: today, weekStart: today, lastSeen: null,
    mode: "normal",
    eod: [],
    weekStats: { india: 0, remote: 0, linkedin: 0 },
    totalApps: 0,
    curriculum: { python: 0, sql: 0, tableau: 0, stats: 0, ml: 0 },
    projectRecent: [],
    plan: null,
    interview: { attempts: {}, todayDate: null, todayIds: [], streak: 0, lastDate: null }
  };
}

function cleanEod(e) {
  const c = isObj(e.checks) ? e.checks : {};
  return {
    date: e.date, text: str(e.text, 2000), apps: num(e.apps),
    checks: { walk: !!c.walk, circuit: !!c.circuit, noLateEating: !!c.noLateEating, practice: !!c.practice }
  };
}
function cleanBlock(b) {
  b = isObj(b) ? b : {};
  return { start: str(b.start, 5), end: str(b.end, 5), title: str(b.title, 80), detail: str(b.detail, 240), type: BLOCK_TYPES.includes(b.type) ? b.type : "wrap" };
}
function cleanPlan(p) {
  if (!isObj(p) || !DATE_RE.test(p.date) || !Array.isArray(p.blocks)) return null;
  return {
    date: p.date, mode: MODES.includes(p.mode) ? p.mode : "normal",
    source: p.source === "claude" ? "claude" : "offline",
    note: str(p.note, 240), learn: str(p.learn, 120), project: str(p.project, 80),
    blocks: p.blocks.slice(0, 14).map(cleanBlock).filter(b => b.title),
    flags: (Array.isArray(p.flags) ? p.flags : []).filter(f => typeof f === "string").slice(0, 3).map(f => f.slice(0, 160))
  };
}

function migrate(raw) { return raw; } /* future: upgrade older versions here */

function normalise(raw) {
  const s = defaultState();
  if (!isObj(raw)) return s;
  raw = migrate(raw);
  if (DATE_RE.test(raw.startDate)) s.startDate = raw.startDate;
  if (DATE_RE.test(raw.weekStart)) s.weekStart = raw.weekStart;
  if (DATE_RE.test(raw.lastSeen)) s.lastSeen = raw.lastSeen;
  if (MODES.includes(raw.mode)) s.mode = raw.mode;
  if (Array.isArray(raw.eod)) s.eod = raw.eod.filter(e => isObj(e) && DATE_RE.test(e.date)).slice(0, 30).map(cleanEod);
  if (isObj(raw.weekStats)) Object.keys(TARGETS).forEach(k => { s.weekStats[k] = num(raw.weekStats[k]); });
  s.totalApps = num(raw.totalApps);
  TRACKS.forEach(t => { s.curriculum[t] = Math.min(num(raw.curriculum && raw.curriculum[t]), CURRICULUM[t].topics.length); });
  if (Array.isArray(raw.projectRecent)) s.projectRecent = raw.projectRecent.filter(x => typeof x === "string").slice(-5);
  s.plan = cleanPlan(raw.plan);
  if (isObj(raw.interview)) {
    const iv = raw.interview;
    if (isObj(iv.attempts)) Object.keys(iv.attempts).slice(0, 200).forEach(id => {
      if (id.length < 40 && (iv.attempts[id] === "confident" || iv.attempts[id] === "struggled")) s.interview.attempts[id] = iv.attempts[id];
    });
    if (DATE_RE.test(iv.todayDate)) s.interview.todayDate = iv.todayDate;
    if (Array.isArray(iv.todayIds)) s.interview.todayIds = iv.todayIds.filter(x => typeof x === "string").slice(0, 2);
    s.interview.streak = num(iv.streak);
    if (DATE_RE.test(iv.lastDate)) s.interview.lastDate = iv.lastDate;
  }
  return s;
}

/* ---------- load / save ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return normalise(raw ? JSON.parse(raw) : null);
  } catch (e) { return defaultState(); }
}
function saveState(state) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
}

/* ---------- day, week and plan helpers ---------- */
function rollover(state) {
  const today = todayStr();
  const diff = daysBetween(state.weekStart, today);
  if (diff >= 7) {
    state.weekStats = { india: 0, remote: 0, linkedin: 0 };
    state.weekStart = addDays(state.weekStart, Math.floor(diff / 7) * 7);
  } else if (diff < 0) { state.weekStart = today; }
  if (state.lastSeen !== today) { state.mode = "normal"; state.lastSeen = today; }
  saveState(state);
}
function dayNumber(state) { return Math.max(1, daysBetween(state.startDate, todayStr()) + 1); }
function weekNumber(state) { return Math.floor(Math.max(0, daysBetween(state.startDate, state.weekStart)) / 7) + 1; }
function todayPlan(state) { return state.plan && state.plan.date === todayStr() ? state.plan : null; }

/* ---------- export / import ---------- */
function exportJSON(state) {
  return JSON.stringify(Object.assign({ app: "mission-control", exportedAt: new Date().toISOString() }, state), null, 2);
}
function parseImport(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new Error("That file is not valid JSON."); }
  if (!isObj(raw)) throw new Error("That file is not a Mission Control backup.");
  if (typeof raw.version !== "number") throw new Error("The backup has no version number.");
  if (raw.version > STATE_VERSION) throw new Error("The backup comes from a newer version of the app.");
  if (!isObj(raw.curriculum) || !Array.isArray(raw.eod)) throw new Error("The backup is missing curriculum or EOD data.");
  return normalise(raw);
}

/* ---------- reset: removes progress only, never touches the API key ---------- */
function resetProgress() {
  try { localStorage.removeItem(STATE_KEY); } catch (e) { /* ignore */ }
  location.reload();
}

/* ---------- API key helpers ---------- */
function getApiKey() { try { return localStorage.getItem(API_KEY_STORE) || ""; } catch (e) { return ""; } }
function setApiKey(k) { try { localStorage.setItem(API_KEY_STORE, k); return true; } catch (e) { return false; } }
function clearApiKey() { try { localStorage.removeItem(API_KEY_STORE); } catch (e) { /* ignore */ } }
