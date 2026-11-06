<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs reader-pwa-read.feature-plan.json -->

# Phone and iPad reader: library, outline, chapter reader, reading settings

`reader-pwa-read` · 3 surfaces

## Problem

Courses can only be read on the desktop web app, whose sidebar, panels and notes do not fit a phone. The owner wants to read a course on an iPhone or iPad the way they read a book: large, calm text, one tap to resume where they stopped, and nothing else on screen. The Phase 0 spike proved the stack (react-native-web at /m/, the shared API layer, the tutor stream); this phase builds the reading itself from the approved design canvas https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS.

## Not in this feature

- The tutor sheet, paragraph asking and docked tutor pane: Phase 3. The spike's tutor box is removed from the library screen.
- End-of-chapter quizzes and Flowmovie/Mermaid diagrams: Phase 2. A chapter's diagrams and questions are not shown yet.
- Offline reading, install manifest and service worker: Phase 4.
- Notes, sources, creating courses and projects: never in the reader.

## Surfaces

### Library · `/m/`

Archetype: `list` — Pick up reading where you left off, or open another course.

**Peak** — one tap on Resume opens the exact chapter they stopped in, scrolled to where they were

**End** — the course list with each course's progress, and the continue card showing what is next

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library ◀     │ Library                                         [ Resume ] │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ Continue reading                                       │ │
│               │ │ Reasoning block: the model's working-out…              │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Course                         Build an agent harness… │ │
│               │ │ Where                                 Chapter 25 of 65 │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ [Resume →]                                             │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Continue reading                                       │ │
│               │ │ Reasoning block: the model's working-out…              │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Course                         Build an agent harness… │ │
│               │ │ Where                                 Chapter 25 of 65 │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ [Resume →]                                             │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ All courses                                            │ │
│               │ ├────────────────────────────────────────────────────────┤ │
│               │ │ 37%  Build an agent harness…     ›                     │ │
│               │ │ 0%   Distributed Systems: Raft   ›                     │ │
│               │ │ 7%   Long-running coding agents  ›                     │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Library           ⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Course  Build an ag… │ │
│ │ Where   Chapter 25 … │ │
│ │ ──────────────────── │ │
│ │ [Resume →]           │ │
│ └──────────────────────┘ │
│        [ Resume ]        │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ No courses yet. Make │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ one in the desktop   │   │ Couldn't reach your  │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ app; it appears here │   │ server. Check that   │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ when it is ready.    │   │ Tailscale is on,     │
│                      │   │                      │   │ then try again. [Try │
│                      │   │ [ Resume ]           │   │ again]               │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Continue card for the most recently opened ready course, then every ready course with its progress. Courses still building show 'Building…' and do not open.

Held to:

- B8 — exactly one <h1>, and it names the collection
- B8 — a collection region (<table>, <ul>, <ol> or role=list) is present
- B8 — a filter or scope control, pinned above the rows rather than inside them
- B8 — one primary action, outside the scroll region

### Course and chapter · `/m/courses/:courseId and /m/courses/:courseId/chapters/:chapterId`

Archetype: `list-detail` — Read one chapter, and move through the course without losing your place. Under 1024 px the outline is its own screen (phone) or a drawer (iPad portrait); from 1024 px it sits beside the chapter.

**Peak** — the chapter opens straight into large serif text at a comfortable measure, with nothing competing with it

**End** — the last paragraph read, the next chapter's title one tap away, and the chapter marked read in the outline

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Course and chapter                        [ Next chapter ] │
│ Course        │                                                            │
│ Chapter       │ ┌──────────────────┐ ┌───────────────────────────────────┐ │
│ Reading       │ │ 24 of 65 read    │ │ Reasoning block: the model's work…│ │
│ Course and ch…│ ├──────────────────┤ │ Talking to any model provider · a…│ │
│               │ │ ✓  1 · How a la… │ │ ───────────────────────────────── │ │
│               │ │ ▾  4 · Talking … │ │ Body      serif 18 px (20 on iPa… │ │
│               │ │ ✓    24 Model a… │ │ Code      mono 13 px, scrolls si… │ │
│               │ │ ●    25 Reasoni… │ │ Key idea             callout card │ │
│               │ │      26 Retry w… │ │ ───────────────────────────────── │ │
│               │ └──────────────────┘ │ [‹ Previous]  [Next chapter ›]    │ │
│               │                      └───────────────────────────────────┘ │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐         ┌──────────────────────────┐
│ ☰  Course and chapter⌕   │         │ ‹ Back  Reasoning block… │
├──────────────────────────┤         ├──────────────────────────┤
│ ┌──────────────────────┐ │    ──▶  │ ┌──────────────────────┐ │
│ │ 24 of 65 read        │ │         │ │ Reasoning block: the…│ │
│ ├──────────────────────┤ │         │ │ Talking to any model…│ │
│ │ ✓  1 · How a langua… │ │         │ │ ──────────────────── │ │
│ │ ▾  4 · Talking to a… │ │         │ │ Body      serif 18 … │ │
│ │ ✓    24 Model adapt… │ │         │ │ Code      mono 13 p… │ │
│ │ ●    25 Reasoning b… │ │         │ │ Key idea  callout c… │ │
│ │      26 Retry with … │ │         │ │ ──────────────────── │ │
│ └──────────────────────┘ │         │ │ [‹ Previous]  [Next… │ │
│     [ Next chapter ]     │         │ └──────────────────────┘ │
└──────────────────────────┘         └──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ This chapter is      │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ still being written. │   │ Couldn't load this   │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ Pick another from    │   │ chapter. [Try again] │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ the outline. [Open   │   │ [Back to the         │
│                      │   │ outline]             │   │ outline]             │
│                      │   │                      │   │                      │
│                      │   │ [ Next chapter ]     │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Markdown rendered as React Native blocks: headings, paragraphs, lists, inline code, fenced code, block quotes (a 'Key idea' quote becomes a callout), tables scroll sideways. Reading progress bar follows scroll. Opening marks the chapter started; reaching the end marks it read.

Held to:

- B1 — two or more top-level panels sharing a top edge
- B2 — no panel scrolls; PageShell owns the single scroll region

### Reading settings · `/m/settings`

Archetype: `settings` — Make the text comfortable. Every change applies at once and is remembered on this device.

**Peak** — dragging the size slider and seeing the sample paragraph change size live

**End** — Done returns to the same chapter at the same place, now in the chosen size and theme

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Reading settings                                           │
│ Course        │                                                            │
│ Chapter       │ ┌──────────────┐ ┌───────────────────────────────────────┐ │
│ Reading       │ │ > Text       │ │ Text                                  │ │
│ Reading setti…│ │   Theme and …│ │ Sample paragraph in the current setti…│ │
│               │ └──────────────┘ │ ───────────────────────────────────── │ │
│               │                  │ Size                A ——●—— A   19 px │ │
│               │                  │ Typeface                 [Serif] Sans │ │
│               │                  │ Spacing          Tight [Normal] Loose │ │
│               │                  └───────────────────────────────────────┘ │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Reading settings  ⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Size      A ——●—— A… │ │
│ │ Typeface  [Serif] S… │ │
│ │ Spacing   Tight [No… │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ First visit: size    │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ starts from the      │   │ If the browser       │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ device's text-size   │   │ refuses storage      │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ setting, theme Dark, │   │ (private mode),      │
│                      │   │ Serif, Normal        │   │ settings still apply │
│                      │   │ spacing.             │   │ for this visit and a │
│                      │   │                      │   │ line says they won't │
│                      │   │                      │   │ be remembered.       │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Each control applies on change; no Save button.

Held to:

- B6 — a section rail: a <nav>, role=navigation, or a tab strip
- B6 — one vertical scroll region, and it is the content column
- B6 — no switch inside a form with a submit; a switch applies on change

## Overlays

```
      drawer · outline-drawer
┌────────────────────────────────┐
│ Outline (iPad portrait, 700…   │
│ ────────────────────────────── │
│ Module 4  [ ▾ 3/6         ]    │
│ 25        [ Reasoning blo…]    │
│ ────────────────────────────── │
│                      [ Close ] │
└────────────────────────────────┘
```

## Components

Each choice states the neighbour it beat. `Use when:` / `Instead:` for every
component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;
the choices between families live in
`docs/principles/component-selection.md`.

| Surface | Control | Why this one | Not |
| --- | --- | --- | --- |
| library | `ScrollView + mapped Pressable rows` | a handful of courses; every row renders at once, so a virtualised list buys nothing and complicates scroll restoration | `FlatList` |
| library | `Continue card from lastOpenedChapterId` | the peak of this screen is resuming; the server already records the last opened chapter per course | `a 'recent' section built from local history (wrong on a second device)` |
| reader | `markdown-it tokens rendered by our own React Native blocks (mobile/src/markdown/)` | we control typography, the Key idea callout and code scrolling exactly, with no native-only dependencies; markdown-it already ships in the tree | `react-native-markdown-display (pulls native-only packages and its own styling model)` |
| reader | `Layout chosen by useWindowDimensions width (<700, 700-1023, >=1024)` | iPad Split View and Slide Over change the window, not the device; the width is the only honest signal | `user-agent or device detection` |
| reader | `Hand-written router over the History API (mobile/src/router.ts, four routes)` | four routes, no nested layouts, back button and deep links are all it needs; avoids a second router package in the bundle | `TanStack Router (its code-based tree and devtools are built around the desktop shell) and React Navigation (native-first, heavy on web)` |
| reader | `Scroll position saved per chapter on this device` | the peak of resuming is landing on the paragraph, not the top of the chapter | `server-side scroll position (no endpoint, and it would fight across devices)` |
| settings | `Segmented buttons (aria-pressed) and a range input` | three or two mutually exclusive options read faster as visible choices than behind a menu, and each applies on change | `Select menus` |
| settings | `Zustand store persisted to localStorage, wrapped in try/catch` | settings are per device and synchronous, and zustand is already a dependency | `a server endpoint (no reason for a phone's font size to follow you to the desktop)` |

## Data model

- **ReaderSettings**
  - `size`: number — 16-26 px; first value from the device text size
  - `theme`: 'dark' | 'light' | 'sepia'
  - `typeface`: 'serif' | 'sans'
  - `spacing`: 'tight' | 'normal' | 'loose' — line height 1.45 / 1.6 / 1.8
  - _relations:_ stored on this device only
- **ScrollMark**
  - `chapterId`: string
  - `ratio`: number — 0-1 of the chapter height, so a size change still lands near the same paragraph
  - _relations:_ one per chapter, this device only

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/courses` | no | library rows and the continue card (existing, MSW handler exists) |
| GET | `/api/courses/:id` | no | outline: modules and chapters with done marks (existing) |
| GET | `/api/chapters/:id` | no | chapter markdown, prev/next (existing) |
| POST | `/api/chapters/:id/progress` | no | started on open, finished at the end (existing) |

## Integration points

```
  mobile/src/queries.ts      ──▶  courseService, chapterService   (same services and MSW handlers as the web app)
  chapter progress mutation  ──▶  invalidates reader course + courses keys   (outline ticks and library % update without a reload)
  deploy/nginx.conf          ──▶  /m/ falls back to /m/index.html   (already done in Phase 0, so deep links work)
  mobile/src/theme.ts        ──▶  three palettes keyed by theme   (every screen reads colours from the active palette)
```

## Blast radius

```
new (14)
  ├── mobile/src/router.ts
  ├── mobile/src/settings.ts
  ├── mobile/src/scrollMarks.ts
  ├── mobile/src/markdown/blocks.tsx
  ├── mobile/src/markdown/parse.ts
  ├── mobile/src/screens/LibraryScreen.tsx
  ├── mobile/src/screens/CourseScreen.tsx
  ├── mobile/src/screens/ChapterScreen.tsx
  ├── mobile/src/screens/SettingsScreen.tsx
  ├── mobile/src/components/Outline.tsx
  ├── mobile/src/components/TopBar.tsx
  ├── mobile/src/components/States.tsx
  ├── mobile/src/reader.test.tsx
  └── mobile/src/markdown/parse.test.ts

changed (6)
  ├── mobile/src/App.tsx
  ├── mobile/src/queries.ts
  ├── mobile/src/theme.ts
  ├── mobile/src/react-native.d.ts
  ├── mobile/src/App.test.tsx
  └── package.json (markdown-it as a direct dependency)
```

## Verification plan

- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `vitest run mobile`
- [ ] `Playwright WebKit against the Mac mini at 390x844, 320x1000, 590x820, 820x1180, 1180x820, 1366x1024: library, resume, outline, chapter, settings; no horizontal overflow`
- [ ] `Render every chapter of the 65-lesson harness course without a page error`
- [ ] `make check`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
