<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs chapter-notes.feature-plan.json -->

# Notes beside a chapter

`chapter-notes` · 1 surface

## Problem

While reading a chapter there is no place to write. The only route is selecting text and pressing Add to notes, which creates a new page every time and takes you nowhere: you can't type your own words next to the text, and a chapter's notes end up scattered across many pages.

## Not in this feature

- Inline margin annotations anchored to paragraphs.
- Notes beside project briefs (same panel later, not now).
- A new editor: the panel uses the Notes page's block editor.

## Surfaces

### Chapter with notes · `/courses/$courseId/chapters/$chapterId`

Archetype: `detail` — Read the chapter and write about it side by side.

**Peak** — you type a thought next to the paragraph that prompted it, without leaving the chapter

**End** — the chapter finished, and its notes page holds your words and the passages you quoted, one click from Notes

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Chapter with notes                               [ Notes ] │
│ New course    │                                                            │
│ Tutor         │ ┌────────────────────────────────────────────────────────┐ │
│ Notes         │ │ 2.1 Queries, keys, values                              │ │
│ Sources       │ │ chapter text, 820px column                             │ │
│ Settings      │ │ ────────────────────────────────────────────────────── │ │
│ Chapter with …│ │ Selection                   [Add to notes] [Ask tutor] │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Your notes                                       Saved │ │
│               │ │ Notes: Queries, keys, values                           │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ > quoted passage                                       │ │
│               │ │ your own words…                                        │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ [Open in Notes]  [Close]                               │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                                  [ Notes ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Chapter with notes⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Selection  [Add to … │ │
│ └──────────────────────┘ │
│        [ Notes ]         │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ No note yet: the     │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ editor is open and   │   │ Compact ErrorState   │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ empty with the       │   │ in the panel: 'Your  │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ placeholder 'Write   │   │ notes didn't load'   │
│                      │   │ about this chapter'; │   │ with Try again; the  │
│                      │   │ the page is created  │   │ chapter stays        │
│                      │   │ on the first         │   │ readable.            │
│                      │   │ keystroke, not on    │   │                      │
│                      │   │ open.                │   │ [ Try again ]        │
│                      │   │                      │   │                      │
│                      │   │ [ Notes ]            │   │                      │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: The block editor with the chapter's note; it saves after a pause in typing and shows Saving / Saved.

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
| chapter | `In-page side pane with ResizeHandle` | notes sit beside the text you're reading and stay put while you scroll; the same drag handle as the tutor panel, so widths behave the same | `Drawer (covers the text)` |
| chapter | `Notes page's block editor (BlockEditorView)` | one editor across the app: chapter mentions, diagram and quiz blocks all work, and the page opens unchanged in Notes | `Textarea` |
| chapter | `Header Button 'Notes' (toggle, open state remembered)` | one obvious way in, next to Ask the tutor; remembered so a note-taker doesn't reopen it every chapter | `Floating action button` |

## Data model

- **NotePage (existing)**
  - `chapterId`: string | null — already in the schema; marks the one notes page for a chapter
  - `parentId`: string | null — chapter notes nest under one page per course
  - _relations:_ at most one live page per chapter; nested under the course's notes page

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/chapters/:id/note` | no | the chapter's notes page, or null |
| POST | `/api/chapters/:id/note` | no | get-or-create it (nested under the course page); optional { append } adds a quoted passage |

## Integration points

```
  Add to notes (selection)  ──▶  POST /chapters/:id/note { append }   (quotes go into the chapter's page and the panel opens, instead of a new page per quote)
  ChapterPage header        ──▶  Notes toggle   (On this page outline hides while the panel is open)
  tutor context             ──▶  noteId of the open chapter note   (the tutor can read what you wrote)
  Notes page tree           ──▶  course page > chapter pages   (the same pages, editable either place)
```

## Blast radius

```
new (3)
  ├── src/pages/Chapter/ChapterNotes.tsx
  ├── agent/tests/test_chapter_notes.py
  └── src/test/chapter-notes.test.tsx

changed (6)
  ├── agent/app/api/chapters.py
  ├── src/api/services/coursewrightService.ts
  ├── src/hooks/useCoursewright.ts
  ├── src/pages/Chapter/ChapterPage.tsx
  ├── src/pages/Notes/NoteEditor.tsx
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
