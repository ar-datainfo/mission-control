/* app.js: init and event binding. */
let state;

function save() { if (!saveState(state)) toast("Could not save. Browser storage may be full or blocked."); }

const handlers = {
  tab: el => showTab(el.dataset.tab),
  mode: el => { state.mode = el.dataset.mode; save(); renderSchedule(state); },
  generate: async () => {
    const btn = $("btn-generate"); btn.disabled = true; btn.textContent = "Planning…";
    await generatePlan(state);
    renderSchedule(state); renderIvDaily(state);
  },
  "topic-done": el => { const t = el.dataset.track; if (state.curriculum[t] < CURRICULUM[t].topics.length) state.curriculum[t]++; save(); renderCurriculum(state); },
  "topic-undo": el => { const t = el.dataset.track; if (state.curriculum[t] > 0) state.curriculum[t]--; save(); renderCurriculum(state); },
  hint: el => { ui.hints[el.dataset.id] = !ui.hints[el.dataset.id]; renderIvDaily(state); renderIvBank(state); },
  answer: el => { ui.answers[el.dataset.id] = !ui.answers[el.dataset.id]; renderIvDaily(state); renderIvBank(state); },
  mark: el => { recordAttempt(state, el.dataset.id, el.dataset.result); renderInterview(state); },
  mock: el => {
    ui.mock = { id: el.dataset.id, answer: "", loading: false, feedback: null, error: "" };
    renderMock(); $("iv-mock").scrollIntoView({ behavior: "smooth", block: "start" });
  },
  "mock-close": () => { ui.mock = null; renderMock(); },
  "mock-submit": async () => {
    const m = ui.mock; if (!m) return;
    m.answer = $("mock-answer").value.trim().slice(0, 4000); m.error = "";
    if (!m.answer) { m.error = "Write an answer first."; return renderMock(); }
    if (!getApiKey()) { m.error = "Mock feedback needs your Anthropic API key. Add it in Settings."; return renderMock(); }
    m.loading = true; m.feedback = null; renderMock();
    try { m.feedback = await evaluateMock(questionById(m.id), m.answer); } catch (e) { m.error = friendlyError(e); }
    m.loading = false; renderMock();
  },
  "star-build": async () => {
    const s = ui.star;
    s.id = $("star-q").value; s.ctx = $("star-ctx").value.trim().slice(0, 1500); s.error = ""; s.out = null;
    if (!getApiKey()) { s.error = "The STAR builder needs your Anthropic API key. Add it in Settings."; return renderStar(); }
    s.loading = true; renderStar();
    try { s.out = await buildStar(questionById(s.id), s.ctx); } catch (e) { s.error = friendlyError(e); }
    s.loading = false; renderStar();
  },
  "eod-save": () => {
    const entry = {
      date: todayStr(), text: $("eod-text").value.trim().slice(0, 2000),
      apps: Math.max(0, Math.min(99, parseInt($("eod-apps").value, 10) || 0)),
      checks: { walk: $("c-walk").checked, circuit: $("c-circuit").checked, noLateEating: $("c-noLateEating").checked, practice: $("c-practice").checked }
    };
    const i = state.eod.findIndex(x => x.date === entry.date);
    const prev = i >= 0 ? state.eod[i].apps : 0;
    if (i >= 0) state.eod.splice(i, 1);
    state.eod.unshift(entry); state.eod = state.eod.slice(0, 30);
    state.totalApps = Math.max(0, state.totalApps + entry.apps - prev);
    save(); renderHeader(state); renderHistory(state); toast("Today's log saved.");
  },
  stat: el => {
    const k = el.dataset.key;
    state.weekStats[k] = Math.max(0, state.weekStats[k] + Number(el.dataset.delta));
    save(); renderWeek(state);
  },
  "save-key": () => {
    const v = $("key-input").value.trim();
    if (!/^sk-ant-/.test(v)) return toast("That does not look like an Anthropic key. It should start with sk-ant-.");
    if (!setApiKey(v)) return toast("Could not save the key. Browser storage may be blocked.");
    renderSettings(); renderSchedule(state); toast("API key saved.");
  },
  "clear-key": () => { clearApiKey(); renderSettings(); renderSchedule(state); toast("API key removed."); },
  export: () => {
    const url = URL.createObjectURL(new Blob([exportJSON(state)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "mission-control-" + todayStr() + ".json";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast("Backup downloaded. It does not include your API key.");
  },
  "import-pick": () => $("import-file").click(),
  reset: () => {
    if (confirm("Reset all progress?\n\nThis clears your EOD log, weekly stats, curriculum progress and interview history. Your saved API key is kept.")) resetProgress();
  }
};

document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]");
  if (!el || !handlers[el.dataset.act]) return;
  try { await handlers[el.dataset.act](el); } catch (err) { toast("Something went wrong: " + err.message); }
});
document.addEventListener("toggle", e => {
  const t = e.target;
  if (t.tagName === "DETAILS" && t.dataset.track) ui.openTracks[t.dataset.track] = t.open;
}, true);
document.addEventListener("change", async e => {
  if (e.target.id === "category-filter") { ui.filter = e.target.value; renderIvBank(state); }
  if (e.target.id === "import-file") {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    try {
      const next = parseImport(await file.text());
      if (!confirm("Replace your current data with this backup? Your API key is not affected.")) return;
      state = next; rollover(state); renderAll(state); toast("Backup imported.");
    } catch (err) { toast(err.message); }
  }
});

state = loadState();
rollover(state);
ui.star.id = QUESTIONS.find(q => q.cat === "behavioural").id;
renderAll(state);
