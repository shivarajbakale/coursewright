# Architecture

A map of coursewright: where things live, how a request or a command flows
through it, and which invariants the layout encodes.

It points at files rather than reproducing them, because a copy of code is a copy
that goes stale, and it deliberately does not repeat the stack, the entry point
or the commands — those are in [AGENTS.md](AGENTS.md), which is read every
session. This one is read on demand, which is what keeps that one short: anything
an agent needs *in order to find its way around* belongs here rather than there.

<!-- rocketship:own shape -->
## The shape

```
src/
  main.tsx         boots React: MSW, then QueryClient -> Theme -> Router providers
  App.tsx          the shell — sidebar, topbar, command palette, AuthGuard, <Outlet/>
  router/router.tsx   one manual route tree; every route is registered here
  pages/           one folder or file per screen
  components/
    auth/          AuthGuard
    _overview/     Storybook-only pages: tokens, type scale, Mantine primitives
    *.tsx          this product's own composites — sidebar, topbar, page-shell, data-table
  config/nav.ts    one source of truth for the sidebar, the palette and page titles
  hooks/           TanStack Query hooks — the only place server state is read
  api/
    client.ts      the axios instance and the ApiResponse<T> envelope helper
    services/      one service object per resource
    types/         pure types, no runtime imports
  lib/             auth.ts, queryClient.ts, errors.ts, utils.ts — leaf utilities
  mocks/handlers/  one MSW handler file per resource, so the app runs with no backend
docs/principles/   the "why" behind the recipes — read before designing a screen
docs/references/industry-conventions.md   the conventions this app follows
```

`src/theme.ts` holds the Mantine theme — palette, radius, component defaults —
and `src/App.css` holds the cascade: `@layer mantine, app`, Mantine's six
stylesheets, and this app's own rules above them. There is no `ui/` kit
directory (pages
import `@mantine/core` directly) and no `stores/` directory: server state lives
in Query, shell state in a Zustand hook, the rest in the router.

## How a screen is built

```
route in router.tsx -> page in pages/ -> query hook in hooks/
   -> service in api/services/ -> axios client -> MSW handler or the real API
```

Dependencies run one way. Pages depend on hooks, components and lib. Composites
in `components/` depend on Mantine and `lib/utils` only — never on pages, hooks
or api.
Services depend on the client and the types; types have no runtime imports at all.
A new cross-layer dependency needs a `DECISIONS.md` entry.

## Invariants the layout encodes

- **The shell is a fixed viewport.** `App.tsx` is `h-svh overflow-hidden` and
  pages scroll through `PageShell`'s `ScrollArea` — because a second scroll
  region is the dual-axis scroll `make ui-probe` exists to catch. Prefer tabs
  and panes over long stacked pages.
- **Use the Mantine component; do not hand-roll the primitive.** `npm run
  ui-lint` fails the build on a hand-rolled badge, card, tab, button, input,
  table or progress bar, because a parallel style is a design system nobody can
  retune from one place. The app's own composites are in Storybook under
  **Shell**; everything else is Mantine's, and its docs are the reference.
- **Colour, border, radius, elevation and layout are all Mantine's.** Pass `c`,
  `bg`, `color`, `variant`, `radius`, `shadow`, `withBorder`, and lay out with
  `Group` / `Stack` / `SimpleGrid` / `Grid` / `Box` — never a hex, never a
  utility class. Retune `src/theme.ts`.
- **Server data goes through a Query hook that calls a service.** Never `fetch`
  or `useEffect` in a component, and never a service call from JSX.
- **Every endpoint has an MSW handler**, so the app always runs standalone.
- **Auth is a local demo shim** in `src/lib/auth.ts` — `useSession`, `signIn`,
  `signUp`, `signOut` over localStorage, with MSW answering a Better Auth-shaped
  `/api/auth/get-session`. Replace the file, keep the exports, and nothing else
  in the app changes.

## The reference slice

**Projects** is implemented across every layer; copy it rather than inventing a
shape. `src/pages/Projects/ProjectsPage.tsx` is one component serving both
`/projects` and `/projects/$projectId`, which is the master-detail pattern this
app uses everywhere.

## Where to add a thing

| Adding | Goes | Start from |
| --- | --- | --- |
| a whole resource | types, service, mock, hook, page, route, nav | the `add-feature` skill |
| a standalone screen | `src/pages/`, route in `router.tsx` | the `add-page` skill |
| one endpoint | a service method, its MSW handler, a query hook | the `add-api-endpoint` skill |
| a shared component | `src/components/`, flat, with a `.stories.tsx` | the `add-ui-component` skill |
| a dependency or a new top-level directory | read [docs/CONSTRAINTS.md](docs/CONSTRAINTS.md) first | — |
<!-- /rocketship:own -->
