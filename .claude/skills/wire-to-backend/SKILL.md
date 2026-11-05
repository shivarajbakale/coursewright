---
name: wire-to-backend
description: Move the app off its MSW mocks onto a real backend — for one resource or the whole app. Use when the user says "connect to the real API", "turn off the mocks", "point this at my backend", or is ready to integrate a resource with a live server.
---

# wire-to-backend — swap MSW mocks for a real API

This starter is **mock-first**: every endpoint has an MSW handler so the app runs
with no backend (see the `add-feature` / `add-api-endpoint` skills). The service
layer already speaks real HTTP via axios — the mocks just intercept it. "Wiring
to a backend" is therefore mostly *removing an interception* and pointing the
base URL at a real server; the service and hooks don't change.

## Know the seams

- **Mock toggle** — `VITE_ENABLE_MOCKING` in `.env`. `enableMocking()` in
  `src/main.tsx` only starts the worker when it's `'true'` in dev.
- **The worker + handler registry** — `src/mocks/browser.ts` starts the worker
  from the handlers listed in `src/mocks/handlers/index.ts`.
- **The HTTP client** — `src/api/client.ts` (axios). Base URL is
  `import.meta.env.VITE_API_BASE_URL || '/api'`; `withCredentials` is on for
  cookie sessions.
- **Auth bypass** — when `VITE_ENABLE_MOCKING === 'true'`, `src/lib/auth.ts`
  returns a fake session and the app skips login. Turning mocks off turns real
  auth back on.

## Option A — take the whole app onto a real backend

1. Set `VITE_ENABLE_MOCKING=false` in `.env`. This stops MSW **and** re-enables
   real auth via `src/lib/auth.ts`.
2. Point the client at the backend: set `VITE_API_BASE_URL` (e.g.
   `https://api.example.com`), or rely on the dev proxy that forwards `/api/*` to
   your local server. Confirm the base URL in `src/api/client.ts`.
3. Make sure the real API implements what the services call — same paths, same
   `ApiResponse<T>` envelope (`src/api/types/api.types.ts`). Reconcile any drift
   in the service file (`src/api/services/*`), not in the components.
4. Wire real auth in `src/lib/auth.ts` if it's still the demo shim.

## Option B — one resource live, the rest still mocked

Keep the app running mock-first but let a single resource hit the server:

1. Leave `VITE_ENABLE_MOCKING=true`.
2. In `src/mocks/handlers/index.ts`, remove (or comment out) just that resource's
   handler array from the registry. MSW then **passes those requests through** to
   the network while still mocking everything else.
3. Ensure `VITE_API_BASE_URL` / the proxy routes that resource's calls to the real
   server, and that the server implements them.

## Rules

- Don't change the service or the Query hooks to "call the backend" — they already
  do. The only things that move are the toggle, the base URL, and which handlers
  are registered.
- Keep the mock handlers in the repo even after going live — they're how the app
  stays runnable offline and how tests (`src/test/*`) exercise the services.

## Verify

Run the real backend, then `npm run dev`. Confirm the wired resource loads real
data (Network tab shows requests reaching the server, not `[MSW]`), a mutation
persists on the server, and — for Option A — login goes through real auth. Run the
`verify` skill for the full bar. For any UI-touching change, also run the seven
items in the `ux-prepass` skill (loading + error states, in particular, will
look different against a real network).
