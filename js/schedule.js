/* schedule.js: Claude API wrapper, project rotation, daily plan (Claude with offline fallback). */
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const LEARN_ROTATION = ["python", "sql", "stats", "python", "tableau", "sql", "ml"];

/* ---------- Claude API ---------- */
async function callClaude(system, user, maxTokens) {
  const key = getApiKey();
  if (!key) throw new Error("NO_KEY");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json", "x-api-key": key,
      "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 1200, system: system, messages: [{ role: "user", content: user }] })
  });
  if (!res.ok) {
    let msg = "";
    try { const j = await res.json(); msg = j.error && j.error.message ? j.error.message : ""; } catch (e) { /* ignore */ }
    throw new Error("API " + res.status + (msg ? ": " + msg : ""));
  }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}
function parseJSON(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Claude's reply was not in the expected format.");
  return JSON.parse(text.slice(a, b + 1));
}
async function askClaudeJSON(system, user, maxTokens) { return parseJSON(await callClaude(system, user, maxTokens)); }
function friendlyError(e) {
  return e && e.message === "NO_KEY" ? "Add your Anthropic API key in Settings first." : "Claude request failed. " + (e && e.message ? e.message : "");
}

/* ---------- learning track and project rotation ---------- */
function pickLearnTrack(state) {
  const day = dayNumber(state);
  for (let i = 0; i < LEARN_ROTATION.length; i++) {
    const t = LEARN_ROTATION[(day - 1 + i) % LEARN_ROTATION.length];
    if (state.curriculum[t] < CURRICULUM[t].topics.length) return t;
  }
  return null;
}
/* Weighted, deterministic per day, never repeats the last 3 projects. */
function pickProject(state) {
  const recent = state.projectRecent.slice(-3);
  let pool = PROJECTS.filter(p => !recent.includes(p.id));
  if (!pool.length) pool = PROJECTS;
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = (dayNumber(state) * 7919) % total;
  for (const p of pool) { if (r < p.weight) return p; r -= p.weight; }
  return pool[0];
}

/* ---------- context ---------- */
function buildContext(state) {
  const track = pickLearnTrack(state), project = pickProject(state), last = state.eod[0];
  const progress = {};
  TRACKS.forEach(t => { progress[t] = state.curriculum[t] + "/" + CURRICULUM[t].topics.length; });
  return {
    day: dayNumber(state),
    weekday: new Date().toLocaleDateString("en-US", { weekday: "long" }),
    mode: state.mode,
    learn: track ? { name: CURRICULUM[track].name, topic: CURRICULUM[track].topics[state.curriculum[track]] } : null,
    project: { id: project.id, name: project.name },
    questions: dailyQuestions(state).map(q => ({ category: q.cat, question: q.q })),
    weakAreas: categoryStats(state).filter(c => c.weak).map(c => c.label),
    week: Object.assign({}, state.weekStats), targets: TARGETS,
    dayInWeek: daysBetween(state.weekStart, todayStr()) + 1,
    progress: progress,
    lastEod: last ? { date: last.date, text: last.text.slice(0, 400), checks: last.checks } : null
  };
}

/* ---------- offline planner ---------- */
function daysLeftInWeek(ctx) { return Math.max(1, 8 - ctx.dayInWeek); }
/* Per-day amount needed to still hit the weekly target, clamped to a sane range. */
function dailyNeed(ctx, key, min, max) {
  const left = Math.max(0, TARGETS[key] - ctx.week[key]);
  return Math.max(min, Math.min(max, Math.ceil(left / daysLeftInWeek(ctx))));
}
/* Yesterday's EOD entry, only if it really is from yesterday. */
function yesterdayEod(ctx) {
  const e = ctx.lastEod;
  return e && daysBetween(e.date, todayStr()) === 1 ? e : null;
}

function paceFlags(ctx) {
  const flags = [], y = yesterdayEod(ctx);
  if (y && /tired|drained|exhaust|burn|overwhelm|sick/i.test(y.text)) flags.push("Yesterday's note sounds low on energy. Consider a Light day.");
  if (y && (!y.checks.walk || !y.checks.circuit)) flags.push("Yesterday's walk or circuit was missed. Do it first today.");
  if (ctx.dayInWeek >= 3) Object.keys(TARGETS).forEach(k => {
    if (ctx.week[k] < TARGETS[k] * ctx.dayInWeek / 7 * 0.6) flags.push(TARGET_LABELS[k] + " are behind weekly pace (" + ctx.week[k] + " of " + TARGETS[k] + ").");
  });
  return flags.slice(0, 3);
}

function fallbackSchedule(ctx) {
  const B = (start, end, title, detail, type) => ({ start, end, title, detail, type });
  const y = yesterdayEod(ctx), weak = ctx.weakAreas;
  const india = dailyNeed(ctx, "india", 1, 5), remote = dailyNeed(ctx, "remote", 0, 3), links = dailyNeed(ctx, "linkedin", 2, 8);
  const applyText = india + " India" + (remote ? " and " + remote + " remote" : "") + " applications, each with a tailored CV headline.";
  const learn = ctx.learn ? ctx.learn.name + ": " + ctx.learn.topic : "Revise your weakest topic";
  const proj = ctx.project.name;
  const drillTrack = ["SQL", "Python", "Statistics"].find(t => weak.includes(t)) || "SQL or Python";
  const practiceText = y && !y.checks.practice ? "Practice was skipped yesterday. Solve 4 problems against a timer." : "Solve 3 problems against a timer.";
  const prep = "Work through today's two questions in the Interview Prep tab." + (weak.length ? " Below 50% confident: " + weak.join(", ") + "." : "");
  const missedMove = y && (!y.checks.walk || !y.checks.circuit);
  const move = B("07:00", "07:45", "Walk and circuit", missedMove ? "Yesterday's walk or circuit was missed. Do this before anything else." : "Move first, then sit down to work.", "health");
  const lunch = B("12:30", "13:30", "Lunch and rest", "Step away from the screen.", "rest");
  const eod = B("21:00", "21:15", "EOD log", "Fill in the EOD Log tab and name tomorrow's first task." + (y && !y.checks.noLateEating ? " No late eating tonight." : ""), "wrap");
  const plans = {
    normal: [move,
      B("08:00", "09:30", "Learn", learn, "learn"),
      B("09:45", "11:15", "Applications", applyText, "apply"),
      B("11:15", "11:45", "LinkedIn", "Send " + links + " connection requests with a short note.", "network"),
      lunch,
      B("13:30", "15:00", "Project: " + proj, "Finish one concrete step and note it in the project README.", "project"),
      B("15:15", "16:15", drillTrack + " practice", practiceText, "practice"),
      B("16:30", "17:15", "Interview prep", prep, "interview"), eod],
    interview: [move,
      B("08:00", "09:30", "Mock interview", "Answer today's questions aloud, then review the model answers.", "interview"),
      B("09:45", "11:00", "Company and role research", "Products, recent news, the team, and 3 questions to ask them.", "interview"),
      B("11:00", "12:00", "STAR stories", "Rehearse two stories: a failure and a disagreement.", "interview"),
      lunch,
      B("13:30", "14:30", "Project walkthrough: " + proj, "Explain it in 3 minutes: problem, method, result, impact.", "project"),
      B("14:45", "15:30", drillTrack + " warm-up", "Two medium problems to stay sharp.", "practice"),
      B("16:00", "16:30", "Rest and set up", "Check your link, laptop and ID. Stop early.", "rest"), eod],
    assessment: [move,
      B("08:00", "12:00", "Assessment deep work", "Read the brief twice, plan, then build. Note assumptions as you go.", "assessment"),
      lunch,
      B("13:30", "16:30", "Assessment: build and check", "Finish the core answer, then check numbers and edge cases.", "assessment"),
      B("16:45", "17:15", "Review and submit", "Re-read the brief against your answer before submitting.", "assessment"),
      B("17:30", "18:00", "One interview question", prep, "interview"), eod],
    project: [move,
      B("08:00", "11:30", "Deep dive: " + proj, "One focused block: finish a feature, a chart or a model run.", "project"),
      B("11:30", "12:15", "Write it up", "Record decisions, metrics and trade-offs in the README.", "project"),
      lunch,
      B("13:30", "14:30", "Rehearse the story", "Explain the project in 2-minute and 5-minute versions.", "interview"),
      B("14:45", "15:45", "Applications", applyText, "apply"),
      B("16:00", "16:45", "Interview prep", prep, "interview"), eod],
    light: [
      B("08:00", "08:45", "Walk", "Easy movement, no phone.", "health"),
      B("09:30", "10:30", "Learn (light)", learn, "learn"),
      B("10:30", "11:15", "Applications", "One India application, done well.", "apply"),
      B("14:00", "14:30", "One interview question", "Pick one from today's two in the Interview Prep tab.", "interview"),
      B("15:00", "17:00", "Rest", "Nothing else is required today.", "rest"), eod]
  };
  return plans[ctx.mode] || plans.normal;
}

/* ---------- plan generation ---------- */
const PLAN_SYSTEM = "You plan one day for Anirudh, a Business Analytics graduate job hunting in Bengaluru (times in IST). " +
  "Reply with JSON only, no markdown: {\"blocks\": [{\"start\": \"HH:MM\", \"end\": \"HH:MM\", \"title\": string, \"detail\": string, \"type\": one of " +
  BLOCK_TYPES.join("|") + "}], \"flags\": [string]}. " +
  "Use 6 to 10 blocks between 07:00 and 21:30 and end with an EOD log block. Respect the mode (normal, interview, assessment, project, light). " +
  "Include the learning topic and project from the context unless the mode is assessment or light. Include applications that move the weekly targets, and today's interview questions. " +
  "Keep each detail under 20 words. flags: up to 3 short warnings, for example weekly pace behind or a skipped health habit.";

function parsePlan(obj) {
  if (!obj || !Array.isArray(obj.blocks) || obj.blocks.length < 3) throw new Error("The plan was incomplete.");
  const p = cleanPlan({ date: todayStr(), blocks: obj.blocks, flags: obj.flags });
  if (!p || p.blocks.length < 3) throw new Error("The plan was incomplete.");
  return { blocks: p.blocks, flags: p.flags };
}

async function generatePlan(state) {
  const ctx = buildContext(state);
  let plan = null, note = "";
  if (getApiKey()) {
    try { plan = parsePlan(await askClaudeJSON(PLAN_SYSTEM, JSON.stringify(ctx), 1500)); }
    catch (e) { note = "Claude could not plan today (" + (e && e.message ? e.message : "error") + "). Offline planner used."; }
  } else { note = "No API key saved, so the offline planner was used."; }
  const source = plan ? "claude" : "offline";
  if (!plan) plan = { blocks: fallbackSchedule(ctx), flags: paceFlags(ctx) };
  state.plan = cleanPlan({
    date: todayStr(), mode: state.mode, source: source, note: note,
    learn: ctx.learn ? ctx.learn.name + ": " + ctx.learn.topic : "", project: ctx.project.name,
    blocks: plan.blocks, flags: plan.flags
  });
  state.projectRecent = state.projectRecent.concat(ctx.project.id).slice(-5);
  saveState(state);
}
