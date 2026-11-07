# Completed features

Finished features leave feature_list.json for this table, so the session prelude stays small.
The full records are in git history (feature_list.json before this move).

| Id | Title | Evidence |
| --- | --- | --- |
| `feature-001` | Library | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Headless Chromium against mocks and the real agent service: renders seeded Raft course, no console errors |
| `feature-002` | New course interview | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Playwright drove topic → 4 questions → Generate against the real agent service; landed on /courses/<id>/building |
| `feature-003` | Generating screen | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Mock build streamed all six stages; real build without a key showed the "ANTHROPIC_API_KEY is not set" failure state |
| `feature-004` | Course overview | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Rendered seeded course from the real API; ui-contract tests cover cold load and error state |
| `feature-005` | Chapter reader | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Rendered seeded chapter (real API) with Flowmovie player; MSW test grades an attempt |
| `feature-006` | Project | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Rendered seeded project from the real API |
| `feature-007` | Tutor (CopilotKit + deep agent) | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Browser → CopilotKit runtime (:4000) → POST /agents/tutor reached the agent; without a key the agent answered 503 and the UI showed a toast. Not yet |
| `feature-008` | Notes (kit, Notion-style) | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Rendered and autosaved against mocks; rendered seeded notes from the real API; 13 markdown round-trip tests for the custom blocks; slash insert, pas |
| `feature-009` | Sources (RAG index) | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); Test retrieval returned ranked seeded chunks via hybrid sqlite-vec + FTS5 search |
| `feature-010` | Python agent service | npm run type-check, lint, ui-lint, storybook-lint, capability-lint: green; npx vitest run: 327 passed; ui-probe: 153 passed (all nine routes measured); cd agent && uv run pytest: 41 passed; uvicorn served seeded data to the web app |
