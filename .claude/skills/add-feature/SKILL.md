---
name: add-feature
description: Scaffold a complete resource end-to-end (types → API service → MSW mock → query hooks → pages → route → nav → test), mirroring the Customers reference slice. Use when the user asks to "add a feature", "add a resource/page for X", "build CRUD for X", or "add a section" (e.g. Invoices, Tickets, Deals).
---

# add-feature — build a full vertical slice

This app ships one **reference slice**: **Customers**. Every layer already exists
for it. To add a new resource, copy that slice and rename. Study the reference
first, then reproduce every layer for the new resource — do not skip a layer.

## The reference slice (read these first)

| Layer | Customers file | What it is |
| --- | --- | --- |
| Types | `src/api/types/customer.types.ts` | domain type + Create/Update DTOs |
| Service | `src/api/services/customerService.ts` | the HTTP calls (`extractData`) |
| Query hooks | `src/hooks/useCustomers.ts` | `useX`, `useCreateX`, … + `xKeys` |
| Mock API | `src/mocks/handlers/customerHandlers.ts` | MSW handlers + seed data |
| Registry | `src/mocks/handlers/index.ts` | where handlers are registered |
| List page | `src/pages/Customers/CustomersPage.tsx` | the collection, full width — archetype `list` |
| Columns | `src/pages/Customers/customer-columns.tsx` | TanStack column definitions |
| Detail page | `src/pages/Customers/CustomerDetailPage.tsx` | one member, its own route — archetype `detail` |
| Form | `src/pages/Customers/customer-form.tsx` | RHF + zod over Mantine inputs, rendered in a Modal |
| Badges | `src/pages/Customers/HealthBadge.tsx`, `PlanBadge.tsx` | the one place a status maps to a colour |
| Route | `src/router/router.tsx` | route registration |
| Nav | `src/config/nav.ts` | sidebar + ⌘K entry |
| API test | `src/test/example.test.ts` | exercises the handlers |
| UI test | `src/test/ui-contract.test.tsx` | renders the slice against MSW |

**Layout contract.** The shell is a fixed viewport (`src/App.tsx` is `h-svh
overflow-hidden`). Pages never scroll as a whole — they render inside
`PageShell`, which pins the title band and gives the body one `ScrollArea`.
`make ui-lint` fails a build that adds `overflow-y-auto` outside the design
system (rule `page-scroll`).

## Step 0 — plan it first

If the shape isn't already settled, run `plan-feature` before step 1. It
renders `FEATURE-PLAN.md` — wireframes of each surface, the four states drawn,
the control choices with what they beat, integration points, blast radius —
and gates on approval. The archetype, controls, and state copy it produces are
the inputs to the steps below, so the decisions are made before any file
exists rather than argued over a diff.

Skip it when the user has already specified the feature down to the file.

## Procedure

Work top-down. Substitute your resource for `Customer`/`customer`/`customers`.

1. **Clarify the shape.** Ask for the resource name (singular + plural) and its
   fields if not given. Keep the first version small (3–6 fields).
2. **Types** — create `src/api/types/<resource>.types.ts` (copy
   `customer.types.ts`). Export it from `src/api/types/index.ts`.
3. **Service** — create `src/api/services/<resource>Service.ts` (copy
   `customerService.ts`). Endpoints are `/api/<resource-plural>`.
4. **Mock handlers** — create `src/mocks/handlers/<resource>Handlers.ts` (copy
   `customerHandlers.ts`, adjust the seed). Register the array in
   `src/mocks/handlers/index.ts`. Seed dates **relative to `Date.now()`**, never
   as literals — a fixture with absolute dates ages into an empty chart — and
   give the seed a real distribution rather than a uniform one, because any
   figure a dashboard derives from it is only as honest as its spread.
5. **Query hooks** — create `src/hooks/use<Resource>s.ts` (copy `useCustomers.ts`).
   Keep the `<resource>Keys` factory — reads and invalidations must use it.
6. **Pages** — create `src/pages/<Resource>s/` by copying the four Customers
   files above: the page, its columns, its detail pane, and its form. Wrap the
   page in `PageShell`. Render the list with `@/components/data-table` — never a
   hand-written `<table>` — and build the form with react-hook-form + zod over
   Mantine inputs (`register()` for text, `Controller` for value-reporting
   controls). Reach for the component that exists before writing markup:
   Mantine's `Progress`, `Textarea`, `SegmentedControl` and `Tabs`, and the
   app's `EmptyState` for zero states. Never hard-code colour — Mantine owns it
   (`c`, `bg`, `color`, `variant`), and lay out with `Group` / `Stack` /
   `SimpleGrid` rather than a `<div>` with a class.
7. **Routes** — register **two** pages in `src/router/router.tsx`: the list at
   `/<resources>` and the record at `/<resources>/$<resource>Id`. They are
   different components with different archetypes (`list` and `detail`), which
   is what lets the record be linked to, bookmarked and read at full width.
   Reach for `list-detail` — one component on both routes, two panes — only when
   the job is working *through* members without losing your place. Creation is a
   Modal on the list page, not a third route.
8. **Nav** — add an entry to `navItems` in `src/config/nav.ts` (pick a
   `lucide-react` icon). This wires both the sidebar and ⌘K.
9. **Tests** — two of them. Copy `src/test/example.test.ts` for the API layer
   (list, create, 404; base fetch URLs on `location.origin`), and copy
   `src/test/ui-contract.test.tsx` for the UI (rows render, selecting one fills
   the detail pane while the list stays mounted). Mount routed components with
   the `renderRoutes` helper in `src/test/render.tsx`.

## Definition of done

Run the `verify` skill. Minimum bar:

```bash
npm run type-check   # tsc --noEmit — zero errors
npx vitest run       # your new test passes
npm run dev          # open the new nav item; list, create, and open a detail
```

Report what you added (one line per layer) and the verification result.

<!-- ux-prepass:v2 -- canonical 7-item checklist lives in `.claude/skills/ux-prepass/SKILL.md`. -->
See `ux-prepass` for the mandatory UI gates. Confirm every box before marking this task done.
