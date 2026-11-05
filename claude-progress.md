# Progress Log

## Current Verified State

- Repository root: this project
- Standard startup path: `./init.sh`
- Standard verification path: `make check` (install + type-check + lint + test)
- Current highest-priority unfinished feature: none open; next work is architecture.md §11 gaps
- Current blocker: none

## Session Log

### Session 004 — Empty and error states (2026-11-05)

- One family of states: `StatePanel` / `ErrorState` (`src/components/state-panel.tsx`) with line-art spot
  drawings (`src/illustrations/spots.tsx`). Errors are sorted into service not answering (status 0,
  502-504), missing (404) and service error; stock server messages are hidden.
- Applied to Library, Course, Chapter, Project, Building, Notes, Sources, 404, notifications, the tutor's
  empty conversation (page and ⌘J panel), and crashes: a route that throws now keeps the shell and shows
  the crash state instead of TanStack Router's default.
- Tutor page: one wide conversation, scope as a strip on top, starters inside the empty state.
- Dev mock scenarios: `?mock=empty|fail|offline|crash|default` (`src/mocks/scenarios.ts`, kept per tab).
- Verified: make check green (330 web tests, 153 probe); all 19 states screenshotted in dark and light.
- Not reachable: the notifications dropdown is not mounted anywhere in the app.

### Session 003 — Interview hardening (2026-11-05)

- New course is keyboard-first: number keys pick, Enter continues, one progress bar, a quiet brief beside
  the step. Enter on a focused button no longer submits twice.
- Agent interview: answers carry their header; a repeated question or the cap ends the interview with a
  model-worded summary (falls back to a plain one). Structured output inlines `$ref`s and repairs
  near-miss shapes (string booleans, `{"item": [...]}` arrays, hoisted fields).
- Verified: make check green (153 probe), agent pytest 45; interview driven to Generate in Chrome on MSW.
- Still unverified: the live model path for the interview.

### Session 002 — Finishing pass (2026-11-05)

- Retired storybook-lint R8 (owner: stories are a waste; DECISIONS.md).
- Interview Back keeps answers; level/goal/pace go into the brief.
- Tutor chat renders search_course citations, make_flow movies, make_quiz quizzes; frontend tools
  highlight_passage and start_quiz.
- Notes: chapter @mentions, Diagram (Mermaid/Flowmovie) and Quiz card blocks; read-only in the reader.
- Agent: diagrammer + Flowmovie check, resumable builds with heartbeats, tutor make_flow/make_quiz,
  per-turn web search, CW_SHARED_SECRET, evals (not run, no key), Docker/Fly/Litestream (not deployed).
- Verified: make check green (327 web tests, 153 probe), agent pytest 41; full stack running in the
  owner's Chrome.
- Still unverified: every live Claude call. Open: real auth before deploying.

### Session 001 — Coursewright end to end (2026-11-05)

- Replaced the template's sample pages with nine screens (Library, New course, Generating, Course, Chapter,
  Project, Tutor, Notes, Sources), a CopilotKit tutor (side panel ⌘J + page), kit-based Notes, animated
  build illustrations, MSW mocks for every route.
- Added the CopilotKit runtime (`runtime-dev/`, Vercel function `api/copilotkit/`) and the Python agent
  service (`agent/`: FastAPI, deepagents, SQLite + sqlite-vec + FTS5, jobs + SSE, seeded Raft course).
- Verified: type-check, lint, ui-lint, storybook-lint, capability-lint, vitest (314), ui-probe (153),
  agent pytest (24); full stack driven in headless Chromium.
- Not verified: anything that calls Claude (no `ANTHROPIC_API_KEY` here). Next: run with a key, tune
  prompts, then the gaps in docs/plan/architecture.md §11.
- User preference: no new Storybook stories.
