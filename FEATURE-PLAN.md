<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs reader-pwa-offline.feature-plan.json -->

# Phone and iPad reader: install it, read offline, update cleanly

`reader-pwa-offline` · 4 surfaces

## Problem

The reader is a web page: on an iPhone 'Add to Home Screen' opens it like a browser tab, and with no signal (a plane, the underground) every screen fails with 'Couldn't load this chapter'. The owner reads on the move. Phase 4 makes the reader an installable app that opens on its own icon, keeps the courses you choose (and every chapter you open) on the device, lets you read, answer quizzes and keep your place offline, sends what you did once you are back online, and tells you when a new version is ready instead of changing under you.

## Not in this feature

- Asking the tutor offline: it needs the server; the Ask button already says 'Tutor needs a connection'.
- Push notifications (a finished build, a new course): later, if at all.
- Offline for the desktop app at /: the service worker's scope is /m/ only.
- Background sync while the app is closed: iOS has none; queued progress goes when the app is next open and online.
- Plain http://coursewright:8080: browsers only run service workers on https (the tailnet name) or localhost; over http the reader works as today, online only.

## Surfaces

### Library (offline aware) · `/m/`

Archetype: `list` — Resume reading, online or not.

**Peak** — opening the app on a plane and the Continue card still takes you straight into your chapter

**End** — a list where saved courses read normally and the rest say plainly they need a connection

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Library (offline aware)                         [ Resume ] │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ Offline bar (only when offline)                        │ │
│ Library (offl…│ │ ────────────────────────────────────────────────────── │ │
│               │ │ Bar  You're offline. Saved courses and chapters you o… │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Offline bar (only when offline)                        │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Bar  You're offline. Saved courses and chapters you o… │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Courses                                                │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Build an agent harness         12 of 65              … │ │
│               │ │ Distributed Systems: Raft      3 of 18           4 ch… │ │
│               │ │ How Postgres executes a query  0 of 40   Needs a conn… │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Library (offline …⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Bar  You're offline… │ │
│ └──────────────────────┘ │
│        [ Resume ]        │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ Offline before the   │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ library was ever     │   │ Online but the       │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ loaded on this       │   │ server fails: the    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ device: 'Open the    │   │ saved list with      │
│                      │   │ reader once while    │   │ 'Showing what's      │
│                      │   │ online and your      │   │ saved on this        │
│                      │   │ courses will be      │   │ device' and Try      │
│                      │   │ here.'               │   │ again.               │
│                      │   │                      │   │                      │
│                      │   │ [ Resume ]           │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Saved courses look as they do online; unsaved ones are dimmed with 'Needs a connection' and open their outline only if it was saved.

Held to:

- B8 — exactly one <h1>, and it names the collection
- B8 — a collection region (<table>, <ul>, <ol> or role=list) is present
- B8 — a filter or scope control, pinned above the rows rather than inside them
- B8 — one primary action, outside the scroll region

### Course outline with Save for offline · `/m/courses/:courseId`

Archetype: `list` — Keep a whole course on the device before going offline.

**Peak** — one tap on 'Save for offline' and every chapter, its drawings and its quiz are on the phone

**End** — 'Saved on this device · 65 chapters · 4.2 MB' under the title, with Remove

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Course outline with Save for offline  [ Save for offline ] │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ On this device                                         │ │
│ Course outlin…│ │ ────────────────────────────────────────────────────── │ │
│               │ │ Not saved  [Save for offline]  (chapters you open are… │ │
│               │ │ Saving               Saving 23 of 65 chapters…  [Stop] │ │
│               │ │ Saved          Saved · 65 chapters · 4.2 MB   [Remove] │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ On this device                                         │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Not saved  [Save for offline]  (chapters you open are… │ │
│               │ │ Saving               Saving 23 of 65 chapters…  [Stop] │ │
│               │ │ Saved          Saved · 65 chapters · 4.2 MB   [Remove] │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Outline                                                │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ 1  Language model                             ✓ read   │ │
│               │ │ 2  Token                                       saved   │ │
│               │ │ 3  Message roles   needs a connection (offline only)   │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Course outline wi…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Not saved  [Save fo… │ │
│ │ Saving     Saving 2… │ │
│ │ Saved      Saved · … │ │
│ └──────────────────────┘ │
│   [ Save for offline ]   │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ A course with no     │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ chapters: no save    │   │ Saving stops on a    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ row.                 │   │ failed chapter:      │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │ 'Saved 40 of 65.     │
│                      │   │ [ Save for offline ] │   │ Some chapters didn't │
│                      │   │                      │   │ download.' with Try  │
│                      │   │                      │   │ again (keeps what it │
│                      │   │                      │   │ has); storage full:  │
│                      │   │                      │   │ 'This device is out  │
│                      │   │                      │   │ of space for         │
│                      │   │                      │   │ courses.'            │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Saved: every chapter opens offline; the row shows the count and size, and Remove frees it.

Held to:

- B8 — exactly one <h1>, and it names the collection
- B8 — a collection region (<table>, <ul>, <ol> or role=list) is present
- B8 — a filter or scope control, pinned above the rows rather than inside them
- B8 — one primary action, outside the scroll region

### Chapter (offline) · `/m/courses/:courseId/chapters/:chapterId`

Archetype: `detail` — Read a saved chapter exactly as online.

**Peak** — reading, the explainer drawing itself and the quiz all working with no signal

**End** — finishing a chapter offline and seeing it ticked; the server hears about it the moment you're back

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Chapter (offline)                                          │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ Chapter                                                │ │
│ Chapter (offl…│ │ ────────────────────────────────────────────────────── │ │
│               │ │ Text, explainers, diagrams             from the device │ │
│               │ │ Quiz                        checked on the device (th… │ │
│               │ │ Ask tutor                   disabled: 'Tutor needs a … │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Kept for later (offline only)                          │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Line under the quiz  Answer kept; it reaches your pro… │ │
│               │ │ End of chapter       Finished ✓ (sent when you're onl… │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                                [ Primary ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Chapter (offline) ⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Text, explainers, d… │ │
│ │ Quiz               … │ │
│ │ Ask tutor          … │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ Offline and this     │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ chapter isn't saved: │   │ A drawing library    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ 'This chapter isn't  │   │ that was never       │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ on this device yet.  │   │ downloaded (Mermaid, │
│                      │   │ Open it once online, │   │ opened offline for   │
│                      │   │ or save the course.' │   │ the first time):     │
│                      │   │ with Back to the     │   │ that diagram shows   │
│                      │   │ outline.             │   │ its text, the        │
│                      │   │                      │   │ chapter still reads. │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: The chapter reads normally; progress and answers are kept on the device and sent in order once online.

Held to:

- B5 — exactly one <h1>, and it names the subject
- B5 — content in at least two declared sections (data-section)
- B5 — the primary action is pinned outside the scroll region

### Reading settings: app and storage · `/m/settings`

Archetype: `settings` — Install the reader, and manage what is saved.

**Peak** — seeing exactly how to put the reader on the home screen for this device

**End** — knowing what is saved and how much room it takes

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Reading settings: app and storage                          │
│ Course        │                                                            │
│ Chapter       │ ┌──────────────┐ ┌───────────────────────────────────────┐ │
│ Reading       │ │ > The app    │ │ The app                               │ │
│ Reading setti…│ │   On this de…│ │ ───────────────────────────────────── │ │
│               │ └──────────────┘ │ iPhone / iPad     Share ⬆, then 'Add… │ │
│               │                  │ Android / Chrome            [Install] │ │
│               │                  │ Installed         'Opened from your … │ │
│               │                  └───────────────────────────────────────┘ │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Reading settings:…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ iPhone / iPad     S… │ │
│ │ Android / Chrome  [… │ │
│ │ Installed         '… │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ Nothing saved:       │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ 'Chapters you open   │   │ The browser won't    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ are kept             │   │ report storage: the  │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ automatically. Save  │   │ row shows course     │
│                      │   │ a whole course from  │   │ counts only.         │
│                      │   │ its outline.'        │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Install instructions match the device; Remove asks once, then frees the space.

Held to:

- B6 — a section rail: a <nav>, role=navigation, or a tab strip
- B6 — one vertical scroll region, and it is the content column
- B6 — no switch inside a form with a submit; a switch applies on change

## Overlays

```
          popover · update                    alert-dialog · remove
┌────────────────────────────────┐     ┌──────────────────────────────────┐
│ A new version of the reader…   │     │ Remove saved course?             │
│ ────────────────────────────── │     │ ──────────────────────────────── │
│   [ Reload when y…]            │     │   [ Frees 4.2 MB.…]              │
│ ────────────────────────────── │     │ ──────────────────────────────── │
│           [ Later ] [ Reload ] │     │            [ Cancel ] [ Remove ] │
└────────────────────────────────┘     └──────────────────────────────────┘
```

## Components

Each choice states the neighbour it beat. `Use when:` / `Instead:` for every
component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;
the choices between families live in
`docs/principles/component-selection.md`.

| Surface | Control | Why this one | Not |
| --- | --- | --- | --- |
| library | `Service worker scoped to /m/, built with vite-plugin-pwa (Workbox generateSW) in the reader's Vite config only` | precache manifest of hashed assets and runtime caching rules are generated from the build, so a deploy can never ship a stale list; the desktop app and its MSW worker at / are untouched | `a hand-written sw.js (asset lists drift with every build) and one worker for both apps (the desktop app has no offline need and its dev MSW worker owns /)` |
| library | `Precache: the app shell, every reader chunk except Mermaid's, Inkling, the Flowmovie player, app-switch.js and the icons; Mermaid cached on first use` | about 1 MB that the reader always needs offline; Mermaid's chunks are several MB and few chapters use them | `precaching everything (Mermaid alone would multiply the first install)` |
| chapter | `API GETs (courses, course, chapter, chapter progress) NetworkFirst with a 4 s timeout, then the cached copy` | online you always see the latest; on a bad connection you get your saved copy instead of a spinner | `StaleWhileRevalidate (shows yesterday's progress first) and persisting TanStack Query to localStorage (5 MB cap, a second store of the same data)` |
| course | `'Save for offline' fetches every chapter of the course through the same cache, 4 at a time, with a progress row and Stop` | one explicit action before a trip; chapters opened normally are kept anyway, so most reading is covered without it | `saving every course automatically (hundreds of chapters on a phone) and a separate download format` |
| chapter | `An outbox in localStorage for progress and quiz attempts, sent in order on 'online' and on app start; quiz checked on the device from the chapter's answer` | iOS has no background sync; the queue is small and the server's writes are idempotent per chapter/question | `Workbox background sync (not on Safari) and blocking the quiz offline` |
| library | `Update popover when a new worker is waiting (registerType 'prompt'); Reload activates it` | the reader never reloads under you mid-chapter; the place is kept by the existing scroll marks | `autoUpdate (reloads while reading) and silently waiting for every tab to close (iOS standalone apps rarely close)` |
| settings | `Install row: Share-sheet steps on iOS/iPadOS, a button from beforeinstallprompt on Chromium, hidden when display-mode is standalone` | Safari has no install prompt, so the steps are the only way; Chrome offers the real prompt | `a banner on the library (nags every visit)` |
| library | `Web app manifest at /m/manifest.webmanifest: name 'Coursewright Reader', id/start_url/scope /m/, display standalone, the existing icons, theme and background #0B0D10` | opens on its own icon with no browser bar; the existing site.webmanifest stays for the desktop app | `editing site.webmanifest (its scope is the desktop app)` |
| library | `Offline bar under the top bar while navigator.onLine is false or a request fell back to the cache` | says once why some things are dimmed; no per-screen error | `a toast (disappears) and nothing (reads as a broken app)` |

## Data model

- **Saved course (this device)**
  - `courseId`: string
  - `chapterIds`: string[] — what Save fetched; opened chapters are in the cache without a record
  - `bytes`: number — summed from the cached responses
  - `savedAt`: ISO date
  - _relations:_ localStorage 'cw-reader-saved'; the responses themselves live in the 'cw-api' cache
- **Outbox item (this device)**
  - `kind`: 'progress' | 'attempt'
  - `path`: string — /api/chapters/:id/progress or the attempt path
  - `body`: object
  - `at`: ISO date — sent oldest first; a 4xx drops the item, a network error keeps it
  - _relations:_ localStorage 'cw-reader-outbox'

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/courses, /api/courses/:id, /api/chapters/:id` | no | unchanged; cached by the worker |
| POST | `/api/chapters/:id/progress, quiz attempts` | no | unchanged; replayed from the outbox when offline |

## Integration points

```
  vite.mobile.config.ts                  ──▶  vite-plugin-pwa (manifest, generateSW, scope /m/)   (dev: worker off unless VITE_PWA_DEV=1)
  deploy/nginx.conf                      ──▶  /m/sw.js and /m/manifest.webmanifest no-cache   (a cached worker would pin an old app)
  queries.ts                             ──▶  progress and answer mutations go through the outbox when offline   (the cached chapter is updated as today)
  Quiz                                   ──▶  local check from question.answer when offline   (same look; the attempt is queued)
  Library, Course, Chapter               ──▶  offline bar, saved/needs-a-connection markers, 'not on this device' state
  Google Fonts (text and Inkling hands)  ──▶  CacheFirst runtime cache   (so text and drawings keep their faces offline)
```

## Blast radius

```
new (7)
  ├── mobile/src/offline/register.ts (worker registration, update popover state)
  ├── mobile/src/offline/outbox.ts
  ├── mobile/src/offline/saved.ts (Save for offline, sizes, remove)
  ├── mobile/src/offline/useOnline.ts (shared with the tutor panel)
  ├── mobile/src/components/OfflineBar.tsx
  ├── mobile/src/components/UpdatePrompt.tsx
  └── mobile/src/offline.test.ts

changed (8)
  ├── vite.mobile.config.ts, package.json (vite-plugin-pwa)
  ├── mobile/index.html (manifest link, apple-touch-icon)
  ├── mobile/src/main.tsx, mobile/src/App.tsx
  ├── mobile/src/queries.ts
  ├── mobile/src/quiz/Quiz.tsx
  ├── mobile/src/screens/LibraryScreen.tsx, CourseScreen.tsx, ChapterScreen.tsx, SettingsScreen.tsx
  ├── mobile/src/tutor/TutorPanel.tsx (useOnline moves out)
  └── deploy/nginx.conf
```

## Verification plan

- [ ] `vitest: outbox order and drop rules, saved-course sizes, offline quiz check, offline bar and not-on-this-device states`
- [ ] `make check`
- [ ] `Playwright WebKit and Chromium against the Mac mini over https: install worker, save a course, go offline (context.setOffline), reload, read a saved chapter with its explainer, answer a quiz, finish it; back online the outbox empties and the server shows the progress`
- [ ] `Deploy a second build: the update popover appears, Reload lands on the same chapter and scroll place`
- [ ] `iPhone and iPad by hand: Add to Home Screen opens standalone at /m/`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
