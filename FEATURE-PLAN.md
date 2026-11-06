<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs reader-pwa-rich.feature-plan.json -->

# Phone and iPad reader: chapter diagrams and the end-of-chapter quiz

`reader-pwa-rich` · 1 surface

## Problem

The reader shows a chapter's text but drops its diagrams (the 'Your map so far' concept map on every lesson, and Flowmovie movies such as the agent loop) and its 2-3 check questions. Without them a chapter on the phone teaches less than the same chapter on the desktop, and there is no way to check yourself before moving on. Design: the 'End-of-chapter quiz' screen on https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS.

## Not in this feature

- Asking the tutor about a wrong answer: Phase 3 adds an 'Ask why' button that opens the tutor sheet.
- Drawing or editing diagrams: the reader only plays what the course already has.
- Offline diagrams: the Flowmovie player and Mermaid load from the server; Phase 4 caches them.

## Surfaces

### Chapter: diagrams and Check yourself · `/m/courses/:courseId/chapters/:chapterId (below the text)`

Archetype: `detail` — See the chapter's diagrams, then check you understood it, before moving on.

**Peak** — choosing an answer and seeing at once whether it was right, with the one-line reason

**End** — the last question answered, the score for the chapter, and the Next chapter button right below it

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Library       │ Chapter: diagrams and Check yourself      [ Next chapter ] │
│ Course        │                                                            │
│ Chapter       │ ┌────────────────────────────────────────────────────────┐ │
│ Reading       │ │ Diagrams                                               │ │
│ Chapter: diag…│ │ Movie · The agent loop    Diagram · Your map so far    │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Phone (<700)            a row per diagram; tap to open │ │
│               │ │ iPad (>=700)                       open from the start │ │
│               │ │ Movie                     Flowmovie player, scrubbable │ │
│               │ │ Diagram                       Mermaid, themed to match │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Check yourself                                   ▬ ▬ ▭ │ │
│               │ │ Question 2 of 3                                        │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ ○                             It never logs reasoning… │ │
│               │ │ ●                          It logs reasoning always… ✓ │ │
│               │ │ Right               The log keeps the fact either way… │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ [Next question]                                        │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                           [ Next chapter ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Chapter: diagrams…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Phone (<700)  a row… │ │
│ │ iPad (>=700)  open … │ │
│ │ Movie         Flowm… │ │
│ │ Diagram       Merma… │ │
│ └──────────────────────┘ │
│     [ Next chapter ]     │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ A chapter with no    │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ diagrams and no      │   │ A movie that can't   │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ questions shows      │   │ load says 'This      │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ neither section;     │   │ movie can't play     │
│                      │   │ Next chapter follows │   │ right now' with Try  │
│                      │   │ the text as now.     │   │ again; a diagram     │
│                      │   │                      │   │ with a syntax slip   │
│                      │   │ [ Next chapter ]     │   │ shows its source     │
│                      │   │                      │   │ text in a code box.  │
│                      │   │                      │   │ A failed answer save │
│                      │   │                      │   │ says 'Couldn't save  │
│                      │   │                      │   │ your answer' and     │
│                      │   │                      │   │ keeps the choice so  │
│                      │   │                      │   │ a retry is one tap.  │
│                      │   │                      │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Diagrams play in place. Questions go one at a time: choose, see Right or Not quite with the explanation and the right answer marked, then Next question. After the last: 'You got 2 of 3 right' and a Try again link. Answers already given show as answered when you come back.

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
| chapter-end | `One question at a time with step marks` | the approved design; one question on a phone screen keeps the choices large and the explanation next to them | `all questions in one long list (the desktop layout)` |
| chapter-end | `Answer rows as radio buttons (role radio, aria-checked) in a radiogroup` | exactly one choice per question, read correctly by VoiceOver; each row is at least 56 px tall | `plain buttons with no selected state` |
| chapter-end | `Diagram rows that open in place (aria-expanded) on phones, open by default from 700 px` | players are heavy and tall; on a phone they load only when asked so scrolling the text stays smooth | `a full-screen diagram viewer (one more screen to leave and come back from)` |
| chapter-end | `The vendored Flowmovie player and Mermaid, loaded lazily into a View's DOM node` | react-native-web renders real DOM, so the same players the web app uses run unchanged; nothing loads until a diagram opens | `a WebView or iframe (not available on the web, and iframes are slower and harder to size)` |

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/chapters/:id` | no | diagrams and questions with the last attempt (existing) |
| POST | `/api/questions/:id/attempts` | no | record an answer; returns correct, answer, explanation (existing, MSW handler exists) |
| GET | `/m/vendor/flowmovie/flowmovie.js` | no | the player, served from the shared public folder under /m |

## Integration points

```
  vite.mobile.config.ts  ──▶  publicDir ../public   (the reader serves the same vendored player and icons under /m/)
  attempt mutation       ──▶  updates the chapter query's question in place   (no chapter refetch, so the reading position does not jump)
  theme palette          ──▶  Mermaid theme (dark → dark, light and sepia → neutral)   (diagram redraws when the reading theme changes)
```

## Blast radius

```
new (5)
  ├── mobile/src/diagrams/FlowMovie.tsx
  ├── mobile/src/diagrams/Mermaid.tsx
  ├── mobile/src/diagrams/Diagrams.tsx
  ├── mobile/src/quiz/Quiz.tsx
  └── mobile/src/quiz/quiz.test.tsx

changed (3)
  ├── mobile/src/screens/ChapterScreen.tsx
  ├── mobile/src/queries.ts
  └── vite.mobile.config.ts
```

## Verification plan

- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `vitest run mobile (quiz: one at a time, right and wrong, score, resume answered; diagrams: open on tap, source shown on a syntax error)`
- [ ] `Playwright WebKit against the Mac mini at 390x844 and 820x1180: a chapter with a Flowmovie and the map diagram plays both; answering the quiz on a seed chapter (writes intercepted)`
- [ ] `make check`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
