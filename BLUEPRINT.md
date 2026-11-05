# App Blueprint

> **For the agent:** if this file is still in stub form (no `One-liner`
> filled in, no `Approved` checkbox ticked), produce a real blueprint
> from the user's brief BEFORE touching `feature_list.json`. Protocol:
> [docs/BLUEPRINT.md](docs/BLUEPRINT.md). Do not start implementation
> until the user ticks **Approved**.
>
> **For the user:** describe the app you want (one paragraph is fine).
> The agent fills in the sections below, you review, you tick
> **Approved**, then features get queued. Change anything you like
> first — this is a 5-minute alignment doc, not a contract.

---

**One-liner:** _(filled by the agent from your brief)_

**Status:**
- [ ] drafted
- [ ] approved

**Last updated:** _(YYYY-MM-DD)_

## Screens

| # | Screen | Route | Layout | Purpose |
|---|--------|-------|--------|---------|
| 1 | _name_ | `/path` | sidebar-page / detail / modal | one-sentence purpose |

> `Route`: the path registered in
> [src/router/router.tsx](src/router/router.tsx). `Layout` matches the
> templates in [docs/FEATURES.md](docs/FEATURES.md#3-pick-a-page-layout).

## Navigation map

```
App (sidebar + navbar shell, src/App.tsx)
├── /            _dashboard_
├── /things      _list_  ─push→ /things/$id  _detail_
└── /settings    (Settings — boilerplate)
```

## Data model

- **EntityName:** field, field, field
- …

## State

- **Server state** — `useThingsQuery` (TanStack Query) backed by
  `src/api/services/thingService.ts`
- **Global UI state** — `useThingStore` (Zustand) if it must survive navigation

## Backend (mock routes)

- `GET /api/…` → shape
- `POST /api/…` → shape

> Real handlers get registered in
> [src/mocks/handlers/](src/mocks/handlers/) and added to
> [src/mocks/handlers/index.ts](src/mocks/handlers/index.ts) once approved.

## Open questions

1. _question for the user to answer before approval_

---

## Feature decomposition (filled after approval)

Once **Approved** is ticked, the agent splits this blueprint into
entries in [feature_list.json](feature_list.json), one feature per
screen or per substantial behaviour. Reference the screen `#` from the
table above in each feature's `notes`.
