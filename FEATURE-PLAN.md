<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs notifications.feature-plan.json -->

# Notifications

`notifications` · 1 surface

## Problem

Course builds take minutes and project reviews run in the background, and both are built for leaving and coming back. Nothing tells you when one finished or failed: you find out only by reopening the Library or the project. A notifications menu exists from the template but nothing opens it, and the agent service has no notifications at all.

## Not in this feature

- A separate inbox page. The menu holds the history; the template's 'View all' link to /inbox goes.
- Browser or OS push notifications, email, or sound.
- Notifying every background re-index of a note. Only work you started and are waiting on is worth a notice.

## Surfaces

### Notifications · `sidebar row above Search, opens a menu on any screen`

Archetype: `list` — See what finished or failed while you were away, and jump to it.

**Peak** — the row badge shows 1 and the top line reads 'Rust ownership and borrowing is ready', one click from the course

**End** — the course open, the notice marked read, the badge gone

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Notifications                            [ Mark all read ] │
│ New course    │                                                            │
│ Tutor         │ ┌────────────────────────────────────────────────────────┐ │
│ Notes         │ │ Notifications                 [Mark all read]          │ │
│ Sources       │ ├────────────────────────────────────────────────────────┤ │
│ Settings      │ │ ● ✓ Rust ownership and borrowing is ready   2m         │ │
│ Notifications…│ │ ● ✕ Build failed: Postgres query engine     1h         │ │
│               │ │   ✓ Review ready: Build a Raft log          1d         │ │
│               │ │   ✕ Couldn't index raft.github.io/raft.pdf  3d         │ │
│               │ ├────────────────────────────────────────────────────────┤ │
│               │ │                   latest 30, scrolls                   │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Notifications                 [Mark all read]          │ │
│               │ ├────────────────────────────────────────────────────────┤ │
│               │ │ ● ✓ Rust ownership and borrowing is ready   2m         │ │
│               │ │ ● ✕ Build failed: Postgres query engine     1h         │ │
│               │ │   ✓ Review ready: Build a Raft log          1d         │ │
│               │ │   ✕ Couldn't index raft.github.io/raft.pdf  3d         │ │
│               │ ├────────────────────────────────────────────────────────┤ │
│               │ │                   latest 30, scrolls                   │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Notifications     ⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Notifications       …│ │
│ ├──────────────────────┤ │
│ │ ● ✓ Rust ownership … │ │
│ │ ● ✕ Build failed: P… │ │
│ │   ✓ Review ready: B… │ │
│ │   ✕ Couldn't index … │ │
│ ├──────────────────────┤ │
│ │  latest 30, scrolls  │ │
│ └──────────────────────┘ │
│    [ Mark all read ]     │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ Inbox spot drawing:  │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ 'You're all caught   │   │ Compact ErrorState   │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ up. Builds and       │   │ in the menu:         │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ reviews tell you     │   │ 'Notifications       │
│                      │   │ here when they       │   │ didn't load' with    │
│                      │   │ finish.'             │   │ Try again; the       │
│                      │   │                      │   │ sidebar row shows no │
│                      │   │ [ Mark all read ]    │   │ badge.               │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Rows newest first, unread on a faint wash with a dot; clicking marks read and opens the course, project or Sources.

Held to:

- B8 — exactly one <h1>, and it names the collection
- B8 — a collection region (<table>, <ul>, <ol> or role=list) is present
- B8 — a filter or scope control, pinned above the rows rather than inside them
- B8 — one primary action, outside the scroll region

## Components

Each choice states the neighbour it beat. `Use when:` / `Instead:` for every
component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;
the choices between families live in
`docs/principles/component-selection.md`.

| Surface | Control | Why this one | Not |
| --- | --- | --- | --- |
| menu | `Menu` | a short list of links opened from one control and dismissed on choice; the existing NotificationsDropdown is already a Menu with rows, unread wash and Mark all read | `Popover` |
| menu | `Sidebar row with Badge count` | the app has no topbar; the sidebar footer already holds Search and Tutor as rows, so Notifications sits with them and collapses to an icon like they do | `Indicator on a floating ActionIcon` |
| menu | `StatePanel / ErrorState` | the empty and error states use the same family as every other screen | `plain Text` |

## Data model

- **Notification**
  - `id`: string
  - `kind`: 'course_ready' | 'course_failed' | 'review_ready' | 'review_failed' | 'source_failed'
  - `title`: string — one line, names the course or project
  - `body`: string — the failure reason, or what to do next
  - `href`: string — where a click goes
  - `courseId`: string | null
  - `read`: boolean
  - `createdAt`: ISO date
  - _relations:_ optionally references one Course (deleted with it)

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/notifications` | no | latest 30, newest first |
| PATCH | `/api/notifications/:id` | no | { read: true } |
| POST | `/api/notifications/mark-all-read` | no | returns { updated } |

## Integration points

```
  agent/app/jobs/worker.py  ──▶  notify.on_job_finished   (one row per build or review that finishes or fails; cancelled writes nothing)
  agent ingest of a URL     ──▶  source_failed notice   (note re-indexes stay silent)
  notificationKeys          ──▶  refetch every 30 s, and when a watched job ends   (badge stays current without a socket)
  app-sidebar footer        ──▶  Notifications row above Search   (collapses to an icon like Search and Tutor)
  mocks                     ──▶  Coursewright-shaped notices + ?mock=empty|fail   (both states reachable in dev)
```

## Blast radius

```
new (4)
  ├── agent/app/db/migrations/003_notifications.sql
  ├── agent/app/api/notifications.py
  ├── agent/app/notify.py
  └── agent/tests/test_notifications.py

changed (8)
  ├── agent/app/jobs/worker.py
  ├── agent/app/main.py
  ├── src/api/types/notification.types.ts
  ├── src/components/notifications-dropdown.tsx
  ├── src/components/app-sidebar.tsx
  ├── src/hooks/useNotifications.ts
  ├── src/mocks/handlers/notificationHandlers.ts
  └── src/mocks/scenarios.ts
```

## Verification plan

- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run ui-lint`
- [ ] `npm run test`
- [ ] `npm run ui-probe`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
