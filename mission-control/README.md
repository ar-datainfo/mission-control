# Mission Control

A calm, single-user daily planner for a Business/Data Analyst job search. Static site (HTML, CSS, vanilla JS). No build step, no backend, no tracking. All data lives in your browser's localStorage.

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout and tabs: Schedule, Curriculum, Interview Prep, EOD Log, Settings |
| `css/style.css` | Dark theme |
| `js/data/curriculum.js` | The 5 tracks and their topics (edit freely) |
| `js/data/projects.js` | 11 portfolio projects with rotation weights |
| `js/data/interview.js` | Question bank (hint and model answer per question) |
| `js/state.js` | State shape (versioned), load/save, import/export, reset, API key helpers |
| `js/interview.js` | Daily picks, attempts, weak areas, streak, mock feedback, STAR |
| `js/schedule.js` | Claude API call, project rotation, daily plan with offline fallback |
| `js/render.js` | All DOM rendering (user and model text is escaped) |
| `js/app.js` | Init and event handling |

## Notes

- The API key is stored under its own key (`mc.apiKey`), separate from app data. Export never includes it and Reset Progress never removes it.
- Your browser calls `https://api.anthropic.com/v1/messages` directly with the `anthropic-dangerous-direct-browser-access` header. Keep the key on devices you trust.
- Without a key, the offline planner builds the schedule. Mock feedback and the STAR builder need a key.
- Add questions by appending to `QUESTIONS` in `js/data/interview.js` (unique `id`, `cat`, `diff`, `q`, `hint`, `a`).

## Git setup (branch `master`)

New repo, or replacing the contents of an existing one:

```bash
cd mission-control
git init
git checkout -B master
git add .
git commit -m "Rebuild Mission Control"
git remote add origin https://github.com/ar-datainfo/mission-control.git
git push -u origin master --force
```

Then in GitHub: Settings > Pages > Source: Deploy from a branch > `master` / `(root)`.

- Your remote's default branch is currently `main`. After switching Pages to `master` you can set `master` as the default under Settings > Branches and delete `main`. To keep using `main` instead, push with `git push -u origin master:main --force`.
- `--force` overwrites the remote history. If you would rather keep it, run `git pull origin main --rebase --allow-unrelated-histories` before pushing (expect a README conflict to resolve) and drop `--force`.
- If `git remote add` says the remote exists, use `git remote set-url origin <url>`.

## Manual test checklist

1. Open the site: header shows Day 1, no countdown anywhere, no console errors.
2. Settings: save a key (starts with `sk-ant-`); status shows the last 4 characters. Remove it and confirm status changes.
3. Schedule: pick Interview day, Generate today. A plan appears. Reload: the same plan remains and Generate is gone.
4. With no key, generate on a fresh state: the plan says "Offline planner". With a key: "Planned by Claude".
5. Curriculum: Mark done moves Python from 0/25 to 1/25 and the next topic changes; Undo reverses it. Check counts: Python 25, SQL 14, Tableau 12, Statistics 14, ML 16.
6. Interview: two questions today. Reveal hint and answer, mark Confident and Struggled; streak becomes 1; the category bar updates; a category under 50% shows "Needs work".
7. Mock: Start mock, submit with no key shows the missing-key message; with a key you get a score, lists and a follow-up.
8. STAR builder returns Situation, Task, Action, Result and a tip.
9. EOD Log: save an entry with ticks and applications; it appears in History; header Applied updates. Saving again the same day replaces it.
10. Weekly stats: +1 and −1 work and the bars move toward 14, 7 and 20.
11. Export JSON, open it: it has `version` and no API key. Import it back; data is restored. Try importing a random JSON file and see the error.
12. Reset Progress: confirm dialog appears; after confirming the page reloads with everything at zero and Settings still shows your saved key.
13. Resize to phone width: tabs scroll sideways and nothing overflows.
