# Coursewright

Personal course learner: breaks any topic into modules, chapters and projects, with notes and a RAG-backed tutor

Generated with [create-react-app](https://www.npmjs.com/package/create-react-app).

## Run

```bash
npm install
npm run dev
```

The app starts on http://localhost:5173. Mock Service Worker is enabled by
default (`VITE_ENABLE_MOCKING=true` in `.env`), so it boots with realistic
mock data and **needs no backend**. Point it at a real API by setting
`VITE_API_URL` and flipping `VITE_ENABLE_MOCKING=false`.

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
