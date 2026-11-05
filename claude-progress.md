# Progress Log

## Current Verified State

- Repository root: this project
- Standard startup path: `./init.sh`
- Standard verification path: `make check` (install + type-check + lint + test)
- Current highest-priority unfinished feature: none open; next work is architecture.md §11 gaps
- Current blocker: none

## Session Log

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
