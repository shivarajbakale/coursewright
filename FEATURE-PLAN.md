<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs inkling-explainers.feature-plan.json -->

# Inkling explainers inside every chapter

`inkling-explainers` · 2 surfaces

## Problem

Chapters explain each idea in words, with at most one movie and the code-drawn 'Your map so far'. The owner wants every chapter to carry a hand-drawn explainer made with Inkling (~/Projects/inkling, their own library: text in, a hand-made drawing out that draws itself step by step), placed inline where it helps, chosen to fit the idea (sequence for a protocol, cycle for a loop, compare for two approaches, timeline, stack, mind map, flow) and never one fixed template. New courses get them from the builder and from agents writing through the MCP; the harness course gets them now as a trial before the other five.

## Not in this feature

- Backfilling the other five courses: after the owner has looked at the harness course.
- Replacing 'Your map so far' (kept as it is) or Flowmovie movies.
- Editing explainers in the app; they are written by the builder or an authoring agent.

## Surfaces

### Chapter (desktop app) · `/courses/:courseId/chapters/:chapterId`

Archetype: `detail` — Read the chapter with its explainer where it helps, not in a section at the end.

**Peak** — reaching the explainer right after the paragraph it pictures, and watching it draw the idea step by step

**End** — the drawing finished in place, its caption saying the idea in one line, and the text carrying on below it

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Chapter (desktop app)                                      │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ Chapter text                                           │ │
│ Chapter (desk…│ │ split at each ```inkling block                         │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Before                                        markdown │ │
│               │ │ Explainer       Inkling card: title, drawing, play bar │ │
│               │ │ After                                         markdown │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Explainer card                                         │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Paper             chalkboard (dark) / notebook (light) │ │
│               │ │ Play    draws on first view; step through with the bar │ │
│               │ │ Alt              the diagram's title and step captions │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                                [ Primary ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Chapter (desktop …⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Before      markdown │ │
│ │ Explainer  Inkling … │ │
│ │ After       markdown │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ A chapter with no    │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ explainer renders as │   │ An explainer that    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ today.               │   │ fails to parse shows │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │ its title and 'This  │
│                      │   │                      │   │ drawing has a        │
│                      │   │                      │   │ mistake, so here is  │
│                      │   │                      │   │ its text' with the   │
│                      │   │                      │   │ source; the chapter  │
│                      │   │                      │   │ still reads.         │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: The drawing appears inline, draws itself the first time it scrolls into view (not under reduced motion), and the play bar steps through it.

Held to:

- B5 — exactly one <h1>, and it names the subject
- B5 — content in at least two declared sections (data-section)
- B5 — the primary action is pinned outside the scroll region

### Chapter (phone and iPad reader) · `/m/courses/:courseId/chapters/:chapterId`

Archetype: `detail` — Same explainer, inline, in the reading theme.

**Peak** — the explainer drawing itself right under the paragraph it pictures, sized to the phone

**End** — the finished drawing, then the text carrying on

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Chapter (phone and iPad reader)                            │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ Chapter blocks                                         │ │
│ Chapter (phon…│ │ ────────────────────────────────────────────────────── │ │
│               │ │ Block                        inkling fence → Explainer │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Explainer                                              │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Paper          chalkboard / notebook / napkin by theme │ │
│               │ │ Width  the reading column; scales down, never scrolls… │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                                [ Primary ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Chapter (phone an…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Block  inkling fenc… │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ No explainer:        │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ unchanged.           │   │ The source as text   │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │ with a one-line      │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │ note.                │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Draws on first view, step bar under it.

Held to:

- B5 — exactly one <h1>, and it names the subject
- B5 — content in at least two declared sections (data-section)
- B5 — the primary action is pinned outside the scroll region

## Components

Each choice states the neighbour it beat. `Use when:` / `Instead:` for every
component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;
the choices between families live in
`docs/principles/component-selection.md`.

| Surface | Control | Why this one | Not |
| --- | --- | --- | --- |
| chapter-desktop | ````inkling fences inside the chapter markdown` | inline placement with no new schema: the text carries the drawing at the right spot, the builder, the MCP and authors all write the same thing, and the reader and desktop split on it | `a separate diagrams row with an anchor (two sources of truth for one position)` |
| chapter-desktop | `Vendored Inkling build (vendor/inkling via npm run vendor), loaded lazily` | the owner's own library, self-contained (rough.js and dagre bundled); lazy so chapters without one pay nothing | `a git dependency (Docker builds need it offline) and the CDN (private tailnet)` |
| chapter-desktop | `Paper chosen by the app's theme, overriding the source` | one look per reading theme; the builder writes content, not styling | `letting each explainer pick its own paper` |
| chapter-reader | `The reader's markdown parser emits an 'inkling' block for the fence` | same pattern as code blocks; the reader already owns its block renderer | `rendering fences as code` |

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/courses/:id/explainers` | no | start a background job that adds explainers to an existing course (the harness course now); returns jobId, progress like a build |
| GET | `/api/jobs/:id` | no | progress of that job (existing) |

## Integration points

```
  agent/app/inkling.py          ──▶  node agent/vendor/inkling/bin/inkling.mjs check   (the same Node path Flowmovie's check uses)
  pipeline 'explainers' stage   ──▶  after chapters are written: one model call per chapter picks 1-2 spots and writes the source; checked; up to 2 revisions; inserted as fences   (new builds)
  authoring.check_folder + MCP  ──▶  check every ```inkling fence; get_rules('inkling'); check_inkling tool   (agents writing courses)
  rag/chunk.py                  ──▶  drop inkling fences from indexed text, keep the title   (the tutor searches words, not diagram syntax)
  pedagogy rules                ──▶  explainer guidance: pick the layout from the idea, label in the course's words, 3-6 steps, captions say the idea   (the 'no set structure' requirement)
```

## Blast radius

```
new (8)
  ├── vendor/inkling/ (vendored build)
  ├── agent/vendor/inkling/ (Node checker)
  ├── agent/app/inkling.py
  ├── agent/app/jobs/explainers.py
  ├── agent/app/prompts/explainer.md
  ├── agent/tests/test_inkling.py
  ├── src/components/diagrams/InklingDiagram.tsx
  └── mobile/src/diagrams/Inkling.tsx

changed (8)
  ├── agent/app/jobs/pipeline.py (explainers stage)
  ├── agent/app/api/courses.py (POST /courses/:id/explainers)
  ├── agent/app/authoring.py, agent/app/mcp_server.py, docs/authoring-courses.md, .claude/skills/write-course
  ├── agent/app/rag/chunk.py
  ├── src/pages/Chapter/ChapterPage.tsx (split markdown at fences)
  ├── src/api/services, src/hooks, src/mocks (explainers job)
  ├── mobile/src/markdown/parse.ts, mobile/src/markdown/blocks.tsx
  └── courses/agent-harness-from-scratch (fences added to lessons)
```

## Verification plan

- [ ] `agent pytest (checker, fence insertion, job, MCP tools)`
- [ ] `vitest (fence split on desktop, reader block, error fallback)`
- [ ] `make check`
- [ ] `Backfill job on the Mac mini for the harness course: 65 chapters, every explainer passes the checker, layouts vary`
- [ ] `WebKit: desktop chapter and reader at phone and iPad sizes show explainers inline, drawn, no overflow`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
