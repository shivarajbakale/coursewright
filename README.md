# Coursewright

A personal course learner. Name a topic, answer a short interview, and a team of Claude agents builds you a
course: modules, chapters with diagrams and Flowmovie movies, check-yourself questions and a project per
module. Read in the chapter reader, keep Notion-style notes (built on kit), and ask a tutor (CopilotKit +
a deepagents agent) that answers from your own course with citations, through hybrid RAG over SQLite.

- Architecture: [docs/plan/architecture.md](docs/plan/architecture.md)
- API contract (frontend and agent service): [docs/plan/api-contract.md](docs/plan/api-contract.md)
- Agent service: [agent/README.md](agent/README.md)

## Run

```bash
npm install
npm run dev          # web only, on mock data (MSW), no backend needed
```

The whole stack (agent service, CopilotKit runtime, web against the real API):

```bash
cd agent && uv sync && cd ..
echo "ANTHROPIC_API_KEY=sk-ant-..." >> agent/.env     # optional: VOYAGE_API_KEY=..., GITHUB_TOKEN=...
npm run dev:stack    # agent :8123, runtime :4000, web :5173
```

Without `ANTHROPIC_API_KEY` everything except Claude works: the seeded Raft course, reading, quizzes,
progress, notes, sources and retrieval. The interview falls back to four fixed questions, course builds
fail with a clear message, and the tutor says it has no key. Without `VOYAGE_API_KEY` retrieval uses a
local hashed embedder.

| Process | Port | Command |
| --- | --- | --- |
| web (Vite, React 19, Mantine 9, kit) | 5173 | `npm run dev` |
| CopilotKit runtime (Node) | 4000 | `npm run runtime` |
| agent service (FastAPI, deepagents, SQLite) | 8123 | `npm run agent` |

## Screens

| Route | Screen |
| --- | --- |
| `/` | Library: courses, builds in progress, recent notes |
| `/new` | Interview: one question at a time, then generate |
| `/courses/:id/building` | Generating: live job events with an animated scene per stage |
| `/courses/:id` | Course overview: modules, chapters, projects, weak spots, concept map |
| `/courses/:id/chapters/:chapterId` | Chapter reader: diagrams, movies, questions, add to notes, ask tutor |
| `/courses/:id/projects/:projectId` | Project: milestones, hints, rubric, GitHub code review |
| `/tutor` | Tutor: full-page chat, scoped to a course |
| `/notes/:pageId?` | Notes: kit page tree, page header and block editor, autosave, backlinks |
| `/sources` | Sources: index stats, add URL, re-index, test retrieval |

The tutor also opens beside any screen (⌘J or the Tutor button) and knows the chapter, note and selection
you're on.

## What's inside

- React 19 + TypeScript (strict) + Vite 6
- TanStack Router (type-safe routing) and TanStack Query (server state)
- Mantine 9 for the design system — colour, radius, elevation and typography
  come from `src/theme.ts`; Tailwind CSS 4 is layout only, and
  `npm run ui-lint` fails the build when either side crosses that line
- React Hook Form + Zod for forms and validation
- Zustand for lightweight client state
- Axios service layer with a `{ data }` response envelope
- MSW for realistic API mocking in dev and tests
- Storybook 10 for component development
- Vitest + Playwright for tests

## Scripts

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # type-check + production build
npm run preview      # preview the production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm test             # Vitest
npm run ui-lint      # design-system contract (Mantine paints, Tailwind lays out)
npm run storybook    # Storybook component explorer
```

Which Mantine component to reach for, and which neighbour is reached for by
mistake, is written down in
`.claude/skills/use-mantine/mantine-capabilities.md`. `npm run capability-lint`
fails the build when a component enters the source with no entry there.

## Identifiers

- npm package: `coursewright`

See `CLAUDE.md` for the full architecture guide and conventions.
