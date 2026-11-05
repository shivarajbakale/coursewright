<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs outline-review.feature-plan.json -->

# Shape the outline in a chat, then build it lean

`outline-review` · 2 surfaces

## Problem

A course is researched, outlined, written, illustrated and reviewed in one go, so the first time you see its shape it is finished: if it starts in the middle or has chapters you don't want, the only fix is to rebuild, after spending 10M+ tokens. The builder is one AI orchestrator that re-reads its growing conversation at every step (76 input tokens per output token in the last build) and can decide to rewrite whole modules.

## Not in this feature

- Editing a finished course (adding or removing chapters after writing) — a later feature.
- Reordering by drag and drop; the chat and per-chapter remove cover the first version.
- Changing the course file format beyond an optional one-line chapter summary.

## Surfaces

### Review the outline · `/courses/$courseId/building (outline step)`

Archetype: `sequence` — See the planned course before anything is written, and change it by asking.

**Peak** — you type 'add a chapter on embeddings before 1.2', and the outline updates with the new chapter highlighted

**End** — you press Write this course and the build continues on the outline you agreed

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Review the outline                   [ Write this course ] │
│ New course    │                                                            │
│ Tutor         │                     Step 1 of 2 — Step                     │
│ Notes         │        ######################......................        │
│ Sources       │                                                            │
│ Settings      │        ┌──────────────────────────────────────────┐        │
│ Review the ou…│        │ Outline · 4 modules · 12 chapters · abou…│        │
│               │        ├──────────────────────────────────────────┤        │
│               │        │ 1  Foundations: what RAG is and why    … │        │
│               │        │   1.1 What a language model can and can… │        │
│               │        │   1.2 Embeddings: turning text into num… │        │
│               │        │ 2  From pipeline to agent              … │        │
│               │        │   2.1 When a straight line is not enoug… │        │
│               │        ├──────────────────────────────────────────┤        │
│               │        │           [Write this course]            │        │
│               │        └──────────────────────────────────────────┘        │
│               │                                                            │
│               │        [ Back ]                            [ Next ]        │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Review the outline⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Outline · 4 modules …│ │
│ ├──────────────────────┤ │
│ │ 1  Foundations: wha… │ │
│ │   1.1 What a langua… │ │
│ │   1.2 Embeddings: t… │ │
│ │ 2  From pipeline to… │ │
│ │   2.1 When a straig… │ │
│ ├──────────────────────┤ │
│ │ [Write this course]  │ │
│ └──────────────────────┘ │
│  [ Write this course ]   │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ Never empty: the     │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ review step only     │   │ A chat turn that     │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ shows once an        │   │ fails shows inline   │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ outline exists. A    │   │ under the message    │
│                      │   │ chapter can't be     │   │ with Try again; the  │
│                      │   │ removed below one    │   │ outline is           │
│                      │   │ per module.          │   │ unchanged. Approve   │
│                      │   │                      │   │ failing shows an     │
│                      │   │ [ Write this course ]│   │ ErrorState with Try  │
│                      │   │                      │   │ again.               │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: The outline updates in place after each change, the changed chapters marked; Write this course continues the build.

Held to:

- B7 — exactly one step on screen at a time
- B7 — progress is declared and sits in the top half
- B7 — a back affordance exists (data-back) and never destroys an answer

### Interview summary · `/new (Confirm step)`

Archetype: `sequence` — Choose whether to review the outline before writing.

**Peak** — Generate course, knowing you'll see the outline before it's written

**End** — the build starts and pauses at the outline

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Interview summary                      [ Generate course ] │
│ New course    │                                                            │
│ Tutor         │                Step 1 of 2 — Ready to build                │
│ Notes         │        ######################......................        │
│ Sources       │                                                            │
│ Settings      │        ┌──────────────────────────────────────────┐        │
│ Interview sum…│        │ ☑  Let me review the outline before it'… │        │
│               │        │ ──────────────────────────────────────── │        │
│               │        │ [Generate course]                        │        │
│               │        └──────────────────────────────────────────┘        │
│               │                                                            │
│               │        [ Back ]                            [ Next ]        │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Interview summary ⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ ☑  Let me review th… │ │
│ │ ──────────────────── │ │
│ │ [Generate course]    │ │
│ └──────────────────────┘ │
│   [ Generate course ]    │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ n/a: always has a    │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ summary.             │   │ Could not start the  │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │ build alert, as      │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ [ Generate course ]  │   │ today.               │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: The build starts; with the box ticked it pauses at the outline.

Held to:

- B7 — exactly one step on screen at a time
- B7 — progress is declared and sits in the top half
- B7 — a back affordance exists (data-back) and never destroys an answer

## Components

Each choice states the neighbour it beat. `Use when:` / `Instead:` for every
component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;
the choices between families live in
`docs/principles/component-selection.md`.

| Surface | Control | Why this one | Not |
| --- | --- | --- | --- |
| review | `Stack of module and chapter rows with an ActionIcon remove` | the outline is a short ordered list to read and prune, not a sortable data set | `DataTable` |
| review | `Own chat panel (ScrollArea + Textarea + Send)` | outline edits are one structured request and reply each, against the build's own endpoint; the CopilotKit tutor chat is built for the tutor agent and its tools | `CopilotChat` |
| review | `Button 'Write this course' (primary) and the Stepper paused on Outline` | one clear next step; the stepper already tells you where the build is | `Modal confirm` |
| summary | `Checkbox, checked by default` | a single on/off preference, defaulting to review | `Switch` |

## Data model

- **CoursePlan**
  - `courseId`: string
  - `outline`: CourseOutline — the course file format's outline, chapters gain an optional one-line summary
  - `messages`: {role: 'user' | 'agent', text, at}[]
  - `estimate`: {tokens: number} — rough cost to write this outline
  - `approvedAt`: ISO date | null
  - _relations:_ one per course, deleted with it

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/courses/:id/plan` | no | outline, chat, estimate, approved |
| POST | `/api/courses/:id/plan/chat` | no | {message} → updated outline + one-line reply + changed keys |
| POST | `/api/courses/:id/plan/remove` | no | {chapterKey} → updated outline (no model call) |
| POST | `/api/courses/:id/plan/approve` | no | continue the build: writing phase |

## Integration points

```
  jobs/pipeline.py (new)  ──▶  replaces the deepagents orchestrator   (code runs research → outline → [pause] → chapters (parallel) → diagrams → projects → review → fixes → save; one structured model call per artifact, each given only what it needs)
  code checks             ──▶  before the AI reviewer   (word count, key idea, banned words, valid questions, every concept taught, module 1 foundations: one retry with the failure)
  usage by stage          ──▶  job output   (tokens per stage recorded, so cost is measured, not guessed)
  notify.py               ──▶  outline_ready notice   (you can leave while it plans)
  evals/builder.py        ──▶  before vs after   (rubric score + tokens on the old Agentic RAG course and the new build)
```

## Blast radius

```
new (8)
  ├── agent/app/jobs/pipeline.py
  ├── agent/app/api/plans.py
  ├── agent/app/prompts/outline_chat.md
  ├── agent/app/db/migrations/004_course_plans.sql
  ├── agent/tests/test_pipeline.py
  ├── agent/tests/test_plans.py
  ├── src/pages/Generating/OutlineReview.tsx
  └── src/test/outline-review.test.tsx

changed (13)
  ├── agent/app/jobs/build_course.py
  ├── agent/app/materialise.py
  ├── agent/app/notify.py
  ├── agent/app/api/courses.py
  ├── agent/app/prompts/curriculum.md
  ├── agent/app/prompts/writer.md
  ├── agent/app/prompts/reviewer.md
  ├── src/pages/Generating/GeneratingPage.tsx
  ├── src/pages/NewCourse/NewCoursePage.tsx
  ├── src/pages/Library/LibraryPage.tsx
  ├── src/api/services/coursewrightService.ts
  ├── src/hooks/useCoursewright.ts
  └── src/mocks/handlers/coursewrightHandlers.ts
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
