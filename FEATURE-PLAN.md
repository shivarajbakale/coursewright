<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs course-extend-ui.feature-plan.json -->

# Extend a finished course from its page

`course-extend-ui` · 2 surfaces

## Problem

Courses can now grow (POST /api/courses/:id/extend: plan new modules on top of what the course teaches, review, then write only them), but only through the API. The owner should be able to say 'also teach X' on a finished course, review the new modules the same way as a new outline, and keep reading the course while the new part is written.

## Not in this feature

- Editing or rewriting existing lessons: an extension only appends modules.
- Extending courses imported from a folder (no builder plan): the menu item is hidden for them.
- The phone and iPad reader: it shows the new modules once written, with no extend action.

## Surfaces

### Course page: Extend this course · `/courses/:courseId`

Archetype: `detail` — Ask for more of a finished course, and see where that request stands.

**Peak** — typing 'also teach options and execution' and seeing it start planning new modules on top of the course

**End** — back on the course page, a quiet banner says the new modules are being planned, waiting for review, or being written, with a link

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Dashboard     │ Course page: Extend this course                            │
│ Customers     │                                                            │
│ Inbox         │ ┌────────────────────────────────────────────────────────┐ │
│ Team          │ │ Extension banner (only while one is in progress)       │ │
│ Billing       │ │ ────────────────────────────────────────────────────── │ │
│ Settings      │ │ Planning  Planning new modules on top of this course…… │ │
│ Course page: …│ │ Review    8 new modules are ready for you to review. … │ │
│               │ │ Writing   Writing 77 new lessons. You can keep readin… │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Modules (as today)                                     │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Course options ⋯    Extend this course · Delete course │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                                [ Primary ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Course page: Exte…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Planning  Planning … │ │
│ │ Review    8 new mod… │ │
│ │ Writing   Writing 7… │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ No extension in      │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ progress: no banner. │   │ The extension's      │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │ planning failed: the │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │ banner says          │
│                      │   │                      │   │ 'Planning the new    │
│                      │   │                      │   │ modules failed' with │
│                      │   │                      │   │ Try again (sends the │
│                      │   │                      │   │ same request) and    │
│                      │   │                      │   │ Dismiss.             │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: When the new modules are written the banner goes and they appear at the end of the outline.

Held to:

- B5 — exactly one <h1>, and it names the subject
- B5 — content in at least two declared sections (data-section)
- B5 — the primary action is pinned outside the scroll region

### Progress and review (the build page, reused) · `/courses/:courseId/building`

Archetype: `sequence` — Follow the extension and approve its outline, exactly as a new course's.

**Peak** — the new modules listed under the existing ones, reshaped by asking, then 'Write these modules'

**End** — the writing progress, with a link back to read the course meanwhile

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Dashboard     │ Progress and review (the build page…                       │
│ Customers     │                                                            │
│ Inbox         │                   Step 1 of 2 — Progress                   │
│ Team          │        ######################......................        │
│ Billing       │                                                            │
│ Settings      │        ┌──────────────────────────────────────────┐        │
│ Progress and …│        │ Steps  Researching → Mapping the new co… │        │
│               │        └──────────────────────────────────────────┘        │
│               │                                                            │
│               │        [ Back ]                            [ Next ]        │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Progress and revi…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Steps  Researching … │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ No extension for     │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ this course: the     │   │ A failed step shows  │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ page shows the       │   │ its message with Try │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ course's last build, │   │ again, as a failed   │
│                      │   │ as today.            │   │ build does today.    │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Approving starts writing; 'Read the course meanwhile' links back to the course page.

Held to:

- B7 — exactly one step on screen at a time
- B7 — progress is declared and sits in the top half
- B7 — a back affordance exists (data-back) and never destroys an answer

## Overlays

```
          dialog · extend
┌────────────────────────────────┐
│ Extend this course           ✕ │
│ ────────────────────────────── │
│ What should it add?  [ Advanc… │
│ ────────────────────────────── │
│ [ Cancel ] [ Plan new modules …│
└────────────────────────────────┘
```

## Components

Each choice states the neighbour it beat. `Use when:` / `Instead:` for every
component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;
the choices between families live in
`docs/principles/component-selection.md`.

| Surface | Control | Why this one | Not |
| --- | --- | --- | --- |
| course | `Menu item 'Extend this course' in the existing Course options menu, opening a Modal with a Textarea` | a rare, deliberate action; the menu already holds the course's other whole-course action (Delete) and keeps the header to one primary button | `a second header button (competes with Continue) and a page of its own (one field does not need one)` |
| course | `Alert banner above the modules while an extension is planning, waiting for review, or writing` | the course stays readable during an extension, so the page must say what is happening without blocking it | `redirecting to the build page as a new course does (it would hide a readable course)` |
| review | `The existing build page and OutlineReview, with existing modules collapsed and labelled` | one review flow for new courses and extensions; the outline chat already edits only the new modules | `a separate extension review screen` |

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/courses/:id/extend` | no | start planning (exists) |
| GET | `/api/courses/:id` | no | adds extension: {status: planning|review|writing|failed, jobId, modules} (new field) |
| GET/POST | `/api/courses/:id/plan, /plan/chat, /plan/approve` | no | review and approve (exist) |

## Integration points

```
  CoursePage      ──▶  useExtendCourse → courseService.extend, then navigate to /courses/:id/building   (MSW handler for extend)
  GeneratingPage  ──▶  follows the course's current job even when the course is ready   (today it treats ready + job as done)
  OutlineReview   ──▶  knows which modules are new from plan.extension.from   (button reads 'Write these modules')
```

## Blast radius

```
new (1)
  └── src/pages/Course/ExtendCourseModal.tsx

changed (4)
  ├── src/pages/Course/CoursePage.tsx
  ├── src/pages/Generating/GeneratingPage.tsx, OutlineReview.tsx
  ├── src/api/services/coursewrightService.ts, src/api/types, src/hooks/useCoursewright.ts, src/mocks
  └── agent/app/api/common.py (course detail: extension), agent/app/api/plans.py (plan_out: extension.from)
```

## Verification plan

- [ ] `vitest: menu item opens the modal, extend posts and navigates; banner per state; review collapses existing modules`
- [ ] `make check`
- [ ] `WebKit against the Mac mini: extend a small course end to end`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
