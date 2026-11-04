# CmdCraft: project status

CmdCraft is a client-side learning site (static HTML and JavaScript, no build step, no backend) with one folder per subject.
Live: https://cmdcraft.vercel.app. Last updated: 2026-11-04.

## What exists today

| Area | Where | What it contains |
|---|---|---|
| Hub | `index.html` | One card per subject with links to each of its pages |
| Linux practice | `linux/index.html` | 400+ drills judged against a simulated machine (filesystem, processes, services, disks, SSH), Vim and Nano editors, a script interpreter, 23 incident simulations, spaced-repetition Review mode |
| Linux theory | `linux/theory/` | Reference of 242 commands with an impact badge (read-only, changes files, changes system, can destroy data), 13 troubleshooting playbooks, a command quiz built from the cards |
| Linux interview | `linux/interview.html` | Experienced-level Q&A with traps and cross-questions, study and mock-interview modes |
| AI / GenAI | `ai/index.html` | About 165 interview questions (RAG, LangChain, LangGraph, agents, MCP, fine-tuning, LLMOps, system design) in core, hard and pro tiers, plus live-coding problems |
| SQL | `sql/` | A 38-day roadmap (see below) |
| Progress | `progress.html` | Everything done on this device across subjects, with export and import of the JSON backup |
| Activity | `activity.html` | Cross-subject activity dashboard |
| Offline | `sw.js`, `sw-assets.json`, `manifest.webmanifest` | Installable PWA; network-first service worker that pre-caches 100 files |
| Cloud sync | `shared/cloud*.js` | Optional Firebase sync of progress |
| Ask Claude | `shared/ask-claude.js` | A button on the SQL lessons and practice pages that builds a tutoring prompt and opens claude.ai |

Python and React exist only as roadmap cards on the hub. Python was deferred by request.

## SQL roadmap (built from the "SQL Mastery Roadmap: Beginner to Expert" syllabus)

- **Syllabus as data:** `sql/content/syllabus.js` holds 38 days (Day 0 to 37) in 7 levels and 452 bullets.
- **Lessons:** `lessons-1..5.js`, one per day. `notes[i]` explains bullet `i`; each lesson also has a runnable example, internals, common mistakes, interview questions and revision points. Page: `sql/learn.html`.
- **Practice:** `sql/practice.html`, 448 items.
  - Query problems (result sets compared), `dml` problems (statements run, then a check query compared) and `mcq` theory questions (84).
  - Modules cover SELECT, filtering, aggregates, joins, subqueries, windows, CASE and NULLs, DDL, constraints, DML, operators, set operators, CTEs, dates, strings, reporting, views, triggers, transactions, indexes and EXPLAIN, normalization and design, interview classics, advanced interview problems, a 50-problem original interview set, and three projects (Employee Management, E-commerce Analytics, Banking with ACID transactions).
- **Interview Q&A:** `sql/interview.html`, 44 questions in 8 modules with a timed mock mode.
- **Lab:** `sql/lab.html`, a step-through isolation and locking simulator (dirty read, non-repeatable read, phantom, lost update, deadlock) and an index lab on a real 20,000-row table.
- **Coverage page:** `sql/coverage.html` lists every roadmap bullet.
- **Engine:** SQLite compiled to WebAssembly (sql.js) with `sql/app/compat.js`, a layer that rewrites common MySQL 8 syntax and registers MySQL functions.

### Honest limits
- The engine is SQLite, not MySQL 8. `EXPLAIN` output, a few functions and some edge cases differ.
- Not executed in the browser: stored procedures, user-defined functions, real multi-session isolation and locking, materialized views, `MODIFY COLUMN`, hash and merge join internals. They are taught as lessons, quiz questions and the lab simulator.
- The 50-problem set is original and in the style of well-known SQL 50 lists. The official LeetCode plan must be done on leetcode.com.

## Quality gates
- `npm test` runs 22 test files (`tests/run-all.js`): shell and system simulation, editors, scenarios, Linux and AI pages, progress, SQL content (every reference solution runs, wrong and no-op answers are rejected), SQL compatibility layer, SQL pages and the roadmap coverage test (every bullet has a note, every lesson example runs, every module has problems).
- `npm run test:offline` is a real-Chrome check: service worker registered, 100 of 100 files pre-cached, key pages and the SQLite engine work with the network off. Set `OFFLINE_BASE=https://cmdcraft.vercel.app/` to test the live site.
- CI: `.github/workflows/test.yml` runs the tests and checks `sw-assets.json` is current.

## How to release
1. `node tools/build-assets.js` (regenerates `sw-assets.json`; needed whenever site files are added or removed).
2. `npm test`.
3. `vercel deploy --prod --yes` (publishes the static site only; see `.vercelignore`), then check the live URLs and run the offline test against them.

Never commit or print `.env.local` (it holds a Vercel token).

## Decisions worth remembering
- One folder per subject, shared code in `shared/`; classic scripts, no bundler, so the site works from plain files.
- Judging is by behaviour (the state of the simulated system, or the result set of a query), not by comparing command text.
- Content tests prove the reference solutions are right and that wrong answers are rejected.
- A link can only start a new Claude chat; the Ask Claude panel lets you save your own chat URL so the prompt is copied and your ongoing chat opens.

## Possible next steps
- React track (syllabus, theory, interview Q&A, as for AI).
- Python track (deferred).
- An in-app tutor using the Anthropic API (needs an API key; the Pro subscription does not include API access).
- Ask Claude buttons on the Linux and AI pages.
