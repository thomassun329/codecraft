# CodeCraft

A Minecraft-style game for learning Python and SQL for kids (about 11–13, no prior coding needed).
Available in English, Spanish and German. Plain static site: no build step, no npm.

- **Python Mines** (5 levels): real Python runs in the browser (Pyodide in a Web Worker) and controls a miner.
  Commands → for loops → if/else → while + variables → functions (boss).
  Levels 3–4 are tested on 3 random worlds, so the code has to *look* (`ahead()`) instead of memorizing a path.
- **SQL Mobdex Lab** (8 chapters, 51 quests, one new idea per quest): real SQLite (sql.js) over a small star schema —
  `mobs`, `items`, `players` (descriptive tables) and `hunts` (an event log), plus `chest_log` and `trades` for the detective case.
  Every new table starts with `DESCRIBE` (translated for SQLite, as is `SHOW TABLES`).
  1 Open the Mobdex (DESCRIBE, SELECT, AS, DISTINCT, ORDER BY, LIMIT, maths) · 2 Mob Hunter (WHERE, AND/OR, IN, BETWEEN, LIKE, IS NULL) ·
  3 The Hunt Log (COUNT, SUM, AVG, ROUND, MIN/MAX, COUNT DISTINCT) · 4 Village Report (GROUP BY, HAVING) ·
  5 Label Maker (CASE WHEN, UPPER/LENGTH, ||) · 6 Connect the Tables (JOIN, aliases, LEFT JOIN, 3-table joins) ·
  7 👑 The Diamond Thief (guided case: subqueries, WITH) · 8 ⭐ Leaderboards (RANK, PARTITION BY, running totals).
  Answers are checked by result, not by text, so any correct query counts; wrong ones get a specific explanation.
  Solved quests unlock mob and loot cards.
- **🧪 Free Lab** (`#/lab`): ungraded SQL playground over every table. Peek into tables, write anything
  (including CREATE / INSERT / UPDATE / DELETE — "Reset database" restores the originals), query history,
  and 6 open "ideas to explore". Friendly error messages and sortable results as in the quests.
- **Game layer**: XP, ranks (Wood → Netherite), 3 stars per level, unlockable helmets, sound, confetti.
- **Parent view** (`#/parent`): levels done, time, runs, hints, solution peeks, last problem, "may be stuck" flag.

## Run locally

```bash
python3 -m http.server 8777 --directory ~/claude_code_projects/personal/codecraft
```

Open http://localhost:8777. (Opening `index.html` directly won't work: browsers block Web Workers on `file://`.)

## Turn on accounts + cloud save (Supabase)

1. Create a project in the thomassun Supabase account.
2. SQL editor → run `supabase/schema.sql`.
3. Project settings → API → copy the URL and the anon/publishable key into `js/config.js`.
4. Authentication → URL configuration → add the deployed site URL. Either keep email confirmation on
   (the parent clicks a link once) or turn it off under Authentication → Providers → Email.

Without a config the game works fully and saves to the browser only. The login prompt appears after level 2.

## Deploy

Any static host. Vercel: import the repo, framework "Other", no build command, output directory `/`.

## Files

| File | What |
|---|---|
| `js/world.js` | Grid world and rules (shared by worker and page) |
| `js/py-worker.js` | Pyodide worker that runs the kid's code and records actions |
| `js/renderer.js`, `js/sprites.js` | Canvas animation, pixel-art blocks, mobs, and player |
| `js/levels-python.js` | Python levels, checks, and text in 3 languages |
| `js/sql-data.js`, `js/levels-sql.js` | SQL world and chapters — **generated**, edit `tools/gen_data.py` / `tools/gen_levels.py` and rerun them |
| `tools/answers.py` | Every quest's answer; `python3 tools/answers.py` prints each result for a sanity check |
| `js/i18n.js` | Interface text + kid-friendly error explanations |
| `js/progress.js` | localStorage + Supabase sync |
| `js/app.js` | Screens, routing, editor, runners |
