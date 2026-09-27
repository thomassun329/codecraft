# CodeCraft

A Minecraft-style game for learning Python and SQL for kids (about 11–13, no prior coding needed).
Available in English, Spanish and German. Plain static site: no build step, no npm.

- **Python Mines** (5 levels): real Python runs in the browser (Pyodide in a Web Worker) and controls a miner.
  Commands → for loops → if/else → while + variables → functions (boss).
  Levels 3–4 are tested on 3 random worlds, so the code has to *look* (`ahead()`) instead of memorizing a path.
- **SQL Mobdex Lab** (3 levels × 3 quests): real SQLite (sql.js). SELECT → WHERE → ORDER BY / LIMIT / COUNT.
  Answers are checked by result, not by text, so any correct query counts. Solved quests unlock mob cards.
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
| `js/levels-python.js`, `js/levels-sql.js` | Level data, checks, and all level text in 3 languages |
| `js/i18n.js` | Interface text + kid-friendly error explanations |
| `js/progress.js` | localStorage + Supabase sync |
| `js/app.js` | Screens, routing, editor, runners |
