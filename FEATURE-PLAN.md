<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs reader-pwa-tutor.feature-plan.json -->

# Phone and iPad reader: ask the tutor about a chapter or a paragraph

`reader-pwa-tutor` · 1 surface

## Problem

Reading on the phone has no way to ask anything: a confusing paragraph or a wrong quiz answer means switching to the desktop app. The owner wants an easy Ask-tutor option: one tap from the chapter, about the paragraph you are on, with answers that point back into the course. Design: 'Ask about this paragraph' (iPhone), 'iPad portrait' (sheet) and 'iPad landscape' (docked) on https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS, with the sheet fixes the owner asked for (size to content, full-width content, aligned edges).

## Not in this feature

- Saving tutor answers as notes: the reader has no notes, and the tutor is told so (surface: mobile).
- Voice input and attachments.
- Offline asking: the tutor needs the server; offline reading is Phase 4.

## Surfaces

### Tutor (sheet below 1024 px, docked pane from 1024 px) · `/m/courses/:courseId/chapters/:chapterId (over or beside the chapter)`

Archetype: `detail` — Ask about this chapter, or the paragraph you tapped, without leaving it.

**Peak** — the answer streams in plain words about the exact paragraph you tapped, with [n] links that open the passage it used

**End** — closing the sheet puts you back on the same paragraph, and the conversation is still there next time you open this chapter

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Tutor (sheet below 1024 px, docked …         [ Ask tutor ] │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ Tutor                                       Chapter 25 │ │
│ Tutor (sheet …│ │ About “Think of a maths exam…”                         │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ You       Explain simpler. What is the margin in code? │ │
│               │ │ Tutor        The margin is the model's rough work… [1] │ │
│               │ │ Sources                Reasoning block · Model adapter │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Ask                                                    │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Quick  [Explain simpler] [Give an example] [Quiz me] … │ │
│               │ │ Input            Ask about this chapter            (↑) │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                              [ Ask tutor ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Tutor (sheet belo…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ You      Explain si… │ │
│ │ Tutor    The margin… │ │
│ │ Sources  Reasoning … │ │
│ └──────────────────────┘ │
│      [ Ask tutor ]       │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ No conversation yet  │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ for this chapter:    │   │ 'The tutor couldn't  │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ one line ('Ask       │   │ answer.' with Try    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ anything about this  │   │ again, which resends │
│                      │   │ chapter, or tap a    │   │ the last question;   │
│                      │   │ paragraph first')    │   │ offline: the Ask     │
│                      │   │ above the quick      │   │ button reads 'Tutor  │
│                      │   │ prompts.             │   │ needs a connection'  │
│                      │   │                      │   │ and the input is     │
│                      │   │ [ Ask tutor ]        │   │ disabled.            │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Replies render as markdown; [n] markers become small links to the cited chapter, and the sources are listed under the reply. A made quiz plays inline; a made movie or diagram plays inline. The conversation is kept per chapter on this device.

Held to:

- B5 — exactly one <h1>, and it names the subject
- B5 — content in at least two declared sections (data-section)
- B5 — the primary action is pinned outside the scroll region

## Overlays

```
        sheet · tutor-sheet
┌────────────────────────────────┐
│ Tutor · Chapter 25 (below 1…   │
│ ────────────────────────────── │
│ Height  [ fits the conv…]      │
│ Expand  [ full height ⌃ ]      │
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
| tutor | `Bottom sheet that sizes to its content (max 75% of the window, expandable to full)` | the owner rejected a fixed-height sheet with an empty band; the chapter stays visible above a short conversation | `a fixed-height sheet, and a separate tutor screen (loses the paragraph you were on)` |
| tutor | `Docked right pane from 1024 px` | an iPad in landscape has room to read and ask side by side, as in the approved design | `the sheet at every width (covers half the text on a wide screen)` |
| tutor | `Tap a paragraph, then 'Ask about this' chip` | text selection is unreliable on touch; a paragraph is the natural unit and one tap marks it | `long-press text selection menus` |
| tutor | `Transcript built from the agent's messages (text, tool calls and their results)` | search_course results carry the numbered hits, so each [n] in a reply links to the chapter of the most recent search before it | `CopilotKit's chat UI (needs its 2.4 MB bundle and Tailwind CSS, measured in the spike)` |
| tutor | `The quiz component, in a local mode for tutor-made questions` | one quiz look everywhere; tutor questions have no server ids, so they are checked on the device | `a second quiz design` |
| tutor | `Tutor code loaded on first open (React.lazy)` | the CopilotKit core adds about 90 KB gzipped; a reader who never asks never downloads it | `loading it with the app` |

## Data model

- **TutorThread (this device)**
  - `chapterId`: string — one conversation per chapter
  - `threadId`: string — sent to the agent so its checkpoint matches
  - `messages`: AG-UI Message[] — last 60 kept
  - `selections`: Record<messageId, string> — the paragraph each question was about, for the label
  - _relations:_ stored in localStorage; nothing new on the server

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/copilotkit` | no | tutor runs through the existing CopilotKit runtime to /agents/tutor (existing) |

## Integration points

```
  ChapterScreen         ──▶  Ask button, paragraph tap, tutor sheet or pane   (the chapter keeps its scroll position under the sheet)
  Quiz (chapter)        ──▶  'Ask why' on a wrong answer   (opens the tutor with the question and your choice)
  agent prompt context  ──▶  {courseId, chapterId, selection, surface: 'mobile'}   (the tutor never offers notes here)
  citation link         ──▶  router: chapter of the cited hit   (a pane stays open; a sheet closes first)
```

## Blast radius

```
new (7)
  ├── mobile/src/tutor/TutorPanel.tsx
  ├── mobile/src/tutor/Transcript.tsx
  ├── mobile/src/tutor/transcript.ts
  ├── mobile/src/tutor/threads.ts
  ├── mobile/src/tutor/store.ts
  ├── mobile/src/tutor/transcript.test.ts
  └── mobile/src/tutor/tutor.test.tsx

changed (7)
  ├── mobile/src/tutor.ts (moves to mobile/src/tutor/useTutor.ts; per-chapter threads)
  ├── mobile/src/tutorLines.ts (replaced by transcript.ts)
  ├── mobile/src/screens/ChapterScreen.tsx
  ├── mobile/src/markdown/parse.ts (citation runs)
  ├── mobile/src/markdown/blocks.tsx (citation links, paragraph tap)
  ├── mobile/src/quiz/Quiz.tsx (local mode, Ask why)
  └── mobile/src/App.tsx (docked pane from 1024 px)
```

## Verification plan

- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `vitest run mobile (transcript: [n] mapped to the latest search, tool cards; sheet opens, Ask why prompt, paragraph label)`
- [ ] `Playwright WebKit against the Mac mini at 390x844, 820x1180 and 1180x820: tap a paragraph, ask, answer streams, a citation opens its chapter, conversation is back after reload`
- [ ] `make check`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
