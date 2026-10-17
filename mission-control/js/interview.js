/* interview.js: question selection, attempts, weak areas, mock feedback and STAR (Claude calls). */
function questionById(id) { return QUESTIONS.find(q => q.id === id); }
function catLabel(id) { const c = INTERVIEW_CATS.find(x => x.id === id); return c ? c.label : id; }

function pickFromCategory(cat, attempts, offset, exclude) {
  const all = QUESTIONS.filter(q => q.cat === cat && !exclude.includes(q.id));
  const fresh = all.filter(q => !attempts[q.id]);
  const pool = fresh.length ? fresh : all;
  return pool[offset % pool.length];
}

/* Two questions per day (primary + secondary category), fixed for the day once chosen. */
function dailyQuestions(state) {
  const iv = state.interview, today = todayStr();
  if (iv.todayDate === today && iv.todayIds.length) return iv.todayIds.map(questionById).filter(Boolean);
  const day = dayNumber(state), n = INTERVIEW_CATS.length;
  const cats = [INTERVIEW_CATS[(day - 1) % n].id, INTERVIEW_CATS[(day + 2) % n].id];
  const ids = [];
  cats.forEach((c, i) => { const q = pickFromCategory(c, iv.attempts, day + i, ids); if (q) ids.push(q.id); });
  iv.todayDate = today; iv.todayIds = ids;
  saveState(state);
  return ids.map(questionById);
}

function recordAttempt(state, id, result) {
  const iv = state.interview, today = todayStr();
  iv.attempts[id] = result;
  if (iv.lastDate !== today) {
    iv.streak = iv.lastDate && daysBetween(iv.lastDate, today) === 1 ? iv.streak + 1 : 1;
    iv.lastDate = today;
  }
  saveState(state);
}
function currentStreak(state) {
  const iv = state.interview;
  return iv.lastDate && daysBetween(iv.lastDate, todayStr()) <= 1 ? iv.streak : 0;
}
function practisedCount(state) { return Object.keys(state.interview.attempts).length; }

function categoryStats(state) {
  return INTERVIEW_CATS.map(c => {
    const qs = QUESTIONS.filter(q => q.cat === c.id);
    const attempted = qs.filter(q => state.interview.attempts[q.id]).length;
    const confident = qs.filter(q => state.interview.attempts[q.id] === "confident").length;
    const rate = attempted ? confident / attempted : null;
    return { id: c.id, label: c.label, attempted, confident, rate, weak: attempted > 0 && rate < 0.5 };
  });
}

/* ---------- Claude-powered mock and STAR ---------- */
const strList = v => (Array.isArray(v) ? v : []).filter(x => typeof x === "string").slice(0, 6);

async function evaluateMock(q, answer) {
  const system = "You are a strict but supportive interviewer for Business Analyst and Data Analyst roles in India. " +
    "Reply with JSON only, no markdown: {\"score\": number 0-10, \"worked\": [string], \"improve\": [string], \"ideal\": [string], \"followUp\": string}. " +
    "Keep each list to at most 4 short items.";
  const user = "Question (" + q.cat + ", " + q.diff + "): " + q.q + "\n\nCandidate answer:\n" + answer;
  const o = await askClaudeJSON(system, user, 900);
  return {
    score: Math.round(Math.max(0, Math.min(10, Number(o.score) || 0)) * 10) / 10,
    worked: strList(o.worked), improve: strList(o.improve), ideal: strList(o.ideal),
    followUp: typeof o.followUp === "string" ? o.followUp : ""
  };
}

async function buildStar(q, context) {
  const system = "You help a Data Analyst candidate answer behavioural questions. Reply with JSON only, no markdown: " +
    "{\"situation\": string, \"task\": string, \"action\": string, \"result\": string, \"tip\": string}. " +
    "Total about 200 words across situation, task, action and result, in first person, with a measurable result. " +
    "If the candidate gives no context, invent a plausible analytics example and keep it generic. 'tip' is one delivery tip.";
  const user = "Question: " + q.q + (context ? "\n\nCandidate context:\n" + context : "");
  const o = await askClaudeJSON(system, user, 900);
  const s = k => (typeof o[k] === "string" ? o[k] : "");
  return { situation: s("situation"), task: s("task"), action: s("action"), result: s("result"), tip: s("tip") };
}
