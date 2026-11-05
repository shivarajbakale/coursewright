# App Blueprint

**One-liner:** A personal course learner: an interview turns a topic into a course of modules, chapters,
diagrams and projects; you read, take Notion-style notes, and ask a tutor that answers from your course.

**Status:**
- [x] drafted
- [x] approved (the user reviewed the design canvas and asked for the end-to-end build, 2026-11-05)

**Last updated:** 2026-11-05

Design canvas: https://claude.ai/artifact/RRww3EWuxmjAgsok41XiNM ·
Architecture: [docs/plan/architecture.md](docs/plan/architecture.md) ·
API: [docs/plan/api-contract.md](docs/plan/api-contract.md)

## Screens

| # | Screen | Route | Layout | Purpose |
|---|--------|-------|--------|---------|
| 1 | Library | `/` | dashboard-grid | Courses, builds in progress, continue reading, recent notes |
| 2 | New course | `/new` | sequence | Interview, one question at a time, then generate |
| 3 | Generating | `/courses/$courseId/building` | sequence | Live build with an animated scene per stage |
| 4 | Course | `/courses/$courseId` | detail | Modules, chapters, projects, weak spots, concept map |
| 5 | Chapter | `/courses/$courseId/chapters/$chapterId` | detail | Read, diagrams and movies, check-yourself, add to notes, ask tutor |
| 6 | Project | `/courses/$courseId/projects/$projectId` | detail | Milestones, hints, rubric, code review |
| 7 | Tutor | `/tutor` | list-detail | Full-page tutor chat scoped to a course |
| 8 | Notes | `/notes`, `/notes/$pageId` | list-detail | kit page tree + page header + block editor |
| 9 | Sources | `/sources` | dashboard-grid | Index stats, sources, add URL, re-index, test retrieval |

## Navigation map

```
App (sidebar + topbar shell, tutor side panel ⌘J, src/App.tsx)
├── /                Library ─push→ /courses/$id ─push→ chapters/$chapterId, projects/$projectId
├── /new             Interview ─push→ /courses/$id/building ─auto→ /courses/$id
├── /tutor           Tutor
├── /notes           Notes ─push→ /notes/$pageId
├── /sources         Sources
└── /settings        (Settings — boilerplate)
```

## Data model

See [docs/plan/architecture.md §6](docs/plan/architecture.md) and the types in
[src/api/types/coursewright.types.ts](src/api/types/coursewright.types.ts).

## State

- **Server state** — `src/hooks/useCoursewright.ts` (TanStack Query) over
  `src/api/services/coursewrightService.ts`; job progress over SSE (`useJobEvents`).
- **Global UI state** — `useTutor` (Zustand, `src/copilot/tutorStore.ts`): tutor panel and the context it
  sends to the agent.

## Backend

The Python agent service in [agent/](agent/) serves every route; MSW mirrors them in
[src/mocks/handlers/coursewrightHandlers.ts](src/mocks/handlers/coursewrightHandlers.ts) so the web app
runs alone.

## Open questions

1. Sources page uploads (PDF/Markdown) — keep URL-only, or add uploads?
2. Hosting — Fly.io or Railway (persistent volume for SQLite, Litestream backups).
3. Cheaper models for high-volume workers once evals exist.
4. Publish kit to npm, or keep it linked from `../kit`.
