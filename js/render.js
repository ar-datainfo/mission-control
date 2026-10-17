/* render.js: all DOM rendering. Every piece of user or model text goes through esc(). */
const ui = {
  tab: "schedule", hints: {}, answers: {}, filter: "all", openTracks: {}, mock: null,
  star: { id: "", ctx: "", loading: false, out: null, error: "" }
};
const $ = id => document.getElementById(id);
const MODE_INFO = [
  { id: "normal", label: "Normal", desc: "Full day" },
  { id: "interview", label: "Interview day", desc: "Prep takes over" },
  { id: "assessment", label: "Assessment day", desc: "Deadline work" },
  { id: "project", label: "Project deep-dive", desc: "One project, in depth" },
  { id: "light", label: "Light day", desc: "Less volume" }
];
const EOD_CHECKS = [["walk", "Walk done"], ["circuit", "Circuit done"], ["noLateEating", "No late eating"], ["practice", "SQL/practice done"]];
const modeLabel = id => (MODE_INFO.find(m => m.id === id) || MODE_INFO[0]).label;

let toastTimer;
function toast(text) {
  const el = $("toast"); el.textContent = text; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

function showTab(tab) {
  ui.tab = tab;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach(p => { p.hidden = p.id !== "tab-" + tab; });
}

function renderHeader(state) {
  $("hdr-day").textContent = dayNumber(state);
  $("hdr-apps").textContent = state.totalApps;
}

/* ---------- schedule ---------- */
function renderSchedule(state) {
  const plan = todayPlan(state);
  $("sch-modes").innerHTML = MODE_INFO.map(m =>
    '<button class="mode' + (state.mode === m.id ? " active" : "") + '" data-act="mode" data-mode="' + m.id + '"' + (plan ? " disabled" : "") + '><b>' + m.label + '</b><span>' + m.desc + '</span></button>').join("");
  $("sch-action").innerHTML = plan
    ? '<p class="muted">Today\'s plan is set. You can generate a new one tomorrow.</p>'
    : '<button class="btn primary" id="btn-generate" data-act="generate">Generate today</button><p class="muted small">' +
      (getApiKey() ? "Claude will plan the day." : "No API key saved, so the offline planner will be used.") + "</p>";
  $("sch-plan").innerHTML = plan ? planHtml(plan) : '<p class="empty">Pick a mode, then generate today\'s plan.</p>';
}
function planHtml(plan) {
  const blocks = plan.blocks.map(b =>
    '<li class="block t-' + b.type + '"><span class="time mono">' + esc(b.start) + "–" + esc(b.end) + '</span><div><b>' + esc(b.title) + "</b><p>" + esc(b.detail) + "</p></div></li>").join("");
  const flags = plan.flags.length ? '<ul class="flags">' + plan.flags.map(f => "<li>" + esc(f) + "</li>").join("") + "</ul>" : "";
  return '<div class="plan-head"><span class="chip">' + esc(modeLabel(plan.mode)) + '</span><span class="chip' + (plan.source === "claude" ? " teal" : "") + '">' +
    (plan.source === "claude" ? "Planned by Claude" : "Offline planner") + "</span></div>" +
    (plan.note ? '<p class="muted small">' + esc(plan.note) + "</p>" : "") +
    '<div class="focus"><div><span class="muted small">Learning</span><b>' + esc(plan.learn || "Nothing due") + '</b></div><div><span class="muted small">Project</span><b>' + esc(plan.project) + "</b></div></div>" +
    flags + '<ol class="blocks">' + blocks + "</ol>";
}

/* ---------- curriculum ---------- */
function renderCurriculum(state) {
  $("cur-list").innerHTML = TRACKS.map(t => {
    const c = CURRICULUM[t], i = state.curriculum[t], n = c.topics.length, done = i >= n;
    const items = c.topics.map((x, k) => '<li class="' + (k < i ? "done" : k === i ? "next" : "") + '">' + esc(x) + "</li>").join("");
    return '<article class="card"><div class="row"><h3>' + esc(c.name) + '</h3><span class="mono">' + i + " / " + n + "</span></div>" +
      '<div class="bar"><i style="width:' + Math.round(i / n * 100) + '%"></i></div>' +
      '<p class="next">' + (done ? "Track complete." : "Next: " + esc(c.topics[i])) + "</p>" +
      '<div class="btn-row"><button class="btn primary sm" data-act="topic-done" data-track="' + t + '"' + (done ? " disabled" : "") + ">Mark done</button>" +
      '<button class="btn ghost sm" data-act="topic-undo" data-track="' + t + '"' + (i === 0 ? " disabled" : "") + ">Undo</button></div>" +
      '<details data-track="' + t + '"' + (ui.openTracks[t] ? " open" : "") + "><summary>All topics</summary><ol class=\"topics\">" + items + "</ol></details></article>";
  }).join("");
}

/* ---------- interview ---------- */
function questionCard(q, state) {
  const st = state.interview.attempts[q.id], id = esc(q.id);
  return '<article class="q"><div class="q-meta"><span class="chip">' + esc(catLabel(q.cat)) + '</span><span class="chip diff-' + q.diff + '">' + q.diff + "</span>" +
    (st ? '<span class="chip st-' + st + '">' + st + "</span>" : "") + "</div>" +
    '<p class="q-text">' + esc(q.q) + "</p>" +
    (ui.hints[q.id] ? '<p class="reveal"><b>Hint.</b> ' + esc(q.hint) + "</p>" : "") +
    (ui.answers[q.id] ? '<p class="reveal"><b>Model answer.</b> ' + esc(q.a) + "</p>" : "") +
    '<div class="btn-row">' +
    '<button class="btn ghost sm" data-act="hint" data-id="' + id + '">' + (ui.hints[q.id] ? "Hide hint" : "Reveal hint") + "</button>" +
    '<button class="btn ghost sm" data-act="answer" data-id="' + id + '">' + (ui.answers[q.id] ? "Hide answer" : "Reveal answer") + "</button>" +
    '<button class="btn sm" data-act="mark" data-result="confident" data-id="' + id + '">Confident</button>' +
    '<button class="btn sm" data-act="mark" data-result="struggled" data-id="' + id + '">Struggled</button>' +
    '<button class="btn teal sm" data-act="mock" data-id="' + id + '">Start mock</button></div></article>';
}
function renderIvStats(state) {
  const rows = categoryStats(state).map(c =>
    '<div class="cat-row"><span>' + esc(c.label) + '</span><div class="bar' + (c.weak ? " weak" : "") + '"><i style="width:' + (c.rate === null ? 0 : Math.round(c.rate * 100)) + '%"></i></div>' +
    '<span class="mono small">' + (c.attempted ? Math.round(c.rate * 100) + "%" : "–") + "</span>" +
    (c.weak ? '<span class="chip warn">Needs work</span>' : "<span></span>") + "</div>").join("");
  $("iv-stats").innerHTML = '<div class="kpis"><div><span class="mono big">' + currentStreak(state) + '</span><span class="muted small">day streak</span></div>' +
    '<div><span class="mono big">' + practisedCount(state) + '</span><span class="muted small">questions practised</span></div></div>' +
    '<p class="muted small">Confident rate per category. Under 50% is flagged.</p>' + rows;
}
function renderIvDaily(state) { $("iv-daily").innerHTML = dailyQuestions(state).map(q => questionCard(q, state)).join(""); }
function renderIvBank(state) {
  $("iv-bank").innerHTML = QUESTIONS.filter(q => ui.filter === "all" || q.cat === ui.filter).map(q => questionCard(q, state)).join("");
}
function renderInterview(state) { renderIvStats(state); renderIvDaily(state); renderIvBank(state); }

function listHtml(title, items) {
  return items.length ? "<h4>" + title + "</h4><ul>" + items.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "";
}
function renderMock() {
  const m = ui.mock, el = $("iv-mock");
  if (!m) { el.innerHTML = '<p class="empty">Choose "Start mock" on any question, write your answer, and get scored feedback from Claude.</p>'; return; }
  const q = questionById(m.id), f = m.feedback;
  el.innerHTML = '<p class="q-text">' + esc(q.q) + '</p><textarea id="mock-answer" rows="6" placeholder="Answer the way you would say it in the interview.">' + esc(m.answer) + "</textarea>" +
    '<div class="btn-row"><button class="btn primary" data-act="mock-submit"' + (m.loading ? " disabled" : "") + ">" + (m.loading ? "Scoring…" : "Get feedback") + '</button><button class="btn ghost" data-act="mock-close">Close</button></div>' +
    (m.error ? '<p class="msg err">' + esc(m.error) + "</p>" : "") +
    (f ? '<div class="feedback"><div class="score"><span class="mono big">' + f.score + '</span><span class="muted">out of 10</span></div>' +
      listHtml("What worked", f.worked) + listHtml("What to improve", f.improve) + listHtml("Ideal answer points", f.ideal) +
      (f.followUp ? "<h4>Follow-up question</h4><p>" + esc(f.followUp) + "</p>" : "") + "</div>" : "");
}
function renderStar() {
  const s = ui.star, qs = QUESTIONS.filter(q => q.cat === "behavioural"), o = s.out;
  $("iv-star").innerHTML = '<select id="star-q" aria-label="Behavioural question">' + qs.map(q => '<option value="' + esc(q.id) + '"' + (q.id === s.id ? " selected" : "") + ">" + esc(q.q) + "</option>").join("") + "</select>" +
    '<textarea id="star-ctx" rows="3" placeholder="Optional: add context, a rough draft or a real example to build on.">' + esc(s.ctx) + "</textarea>" +
    '<div class="btn-row"><button class="btn primary" data-act="star-build"' + (s.loading ? " disabled" : "") + ">" + (s.loading ? "Building…" : "Build STAR answer") + "</button></div>" +
    (s.error ? '<p class="msg err">' + esc(s.error) + "</p>" : "") +
    (o ? '<div class="feedback"><h4>Situation</h4><p>' + esc(o.situation) + "</p><h4>Task</h4><p>" + esc(o.task) + "</p><h4>Action</h4><p>" + esc(o.action) + "</p><h4>Result</h4><p>" + esc(o.result) + "</p><h4>Delivery tip</h4><p>" + esc(o.tip) + "</p></div>" : "");
}

/* ---------- EOD ---------- */
function renderEodForm(state) {
  const e = state.eod.find(x => x.date === todayStr()) || { text: "", checks: {}, apps: 0 };
  $("eod-form").innerHTML = '<textarea id="eod-text" rows="5" placeholder="What happened today? What is the first task tomorrow?">' + esc(e.text) + "</textarea>" +
    '<div class="checks">' + EOD_CHECKS.map(c => '<label class="check"><input type="checkbox" id="c-' + c[0] + '"' + (e.checks[c[0]] ? " checked" : "") + "> " + c[1] + "</label>").join("") + "</div>" +
    '<label class="field">Applications sent today <input type="number" id="eod-apps" min="0" max="99" value="' + e.apps + '"></label>' +
    '<div class="btn-row"><button class="btn primary" data-act="eod-save">Save today\'s log</button></div>';
}
function renderWeek(state) {
  $("eod-week").innerHTML = Object.keys(TARGETS).map(k => {
    const v = state.weekStats[k], t = TARGETS[k], pct = Math.min(100, Math.round(v / t * 100));
    return '<div class="stat-row"><div class="row"><span>' + TARGET_LABELS[k] + '</span><span class="mono">' + v + " / " + t + '</span></div>' +
      '<div class="bar' + (v >= t ? " full" : "") + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="btn-row"><button class="btn ghost sm" data-act="stat" data-key="' + k + '" data-delta="-1" aria-label="Remove one">−1</button>' +
      '<button class="btn sm" data-act="stat" data-key="' + k + '" data-delta="1" aria-label="Add one">+1</button></div></div>';
  }).join("") + '<p class="muted small">Week ' + weekNumber(state) + ". Counts reset every 7 days.</p>";
}
function renderHistory(state) {
  $("eod-history").innerHTML = state.eod.length ? state.eod.map(e =>
    '<article class="entry"><div class="row"><b class="mono">' + esc(e.date) + '</b><span class="muted small">' + e.apps + " applications</span></div>" +
    '<div class="q-meta">' + EOD_CHECKS.map(c => '<span class="chip' + (e.checks[c[0]] ? " teal" : "") + '">' + c[1] + "</span>").join("") + "</div>" +
    (e.text ? '<p class="pre">' + esc(e.text) + "</p>" : "") + "</article>").join("") : '<p class="empty">No entries yet. Your first log appears here.</p>';
}
function renderEod(state) { renderEodForm(state); renderWeek(state); renderHistory(state); }

/* ---------- settings ---------- */
function renderSettings() {
  const k = getApiKey();
  $("key-status").textContent = k ? "Key saved in this browser (ends in " + k.slice(-4) + ")." : "No key saved.";
  $("key-input").value = "";
}

function renderAll(state) {
  renderHeader(state); renderSchedule(state); renderCurriculum(state); renderInterview(state);
  renderMock(); renderStar(); renderEod(state); renderSettings(); showTab(ui.tab);
}
