<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs course-epub-export.feature-plan.json -->

# Download a course as an EPUB book

`course-epub-export` · 1 surface

## Problem

A course can only be read inside Coursewright. The owner wants to take one course to an e-reader (Apple Books, Kobo, Kindle via Send to Kindle) and read it offline, as a book: the lessons in order, the drawings, the questions and the projects.

## Not in this feature

- Moving Flowmovie diagrams: an EPUB cannot play them; the book prints each diagram's step-by-step text instead.
- The learner's own notes, progress and tutor chats: the book holds only the course.
- PDF or other formats, and exporting several courses at once.
- The phone and iPad reader app: export is on the web course page only.

## Surfaces

### Course page: Download as EPUB · `/courses/:courseId`

Archetype: `detail` — Save the whole course as one EPUB file.

**Peak** — choosing 'Download as EPUB' and the browser saving 'build-domain-expert-agents-on-pi.epub' a moment later

**End** — the book opens in Apple Books with the title page, a module-by-module contents and every drawing in place

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Dashboard     │ Course page: Download as EPUB                              │
│ Customers     │                                                            │
│ Inbox         │ ┌────────────────────────────────────────────────────────┐ │
│ Team          │ │ Header (as today)                                      │ │
│ Billing       │ │ ────────────────────────────────────────────────────── │ │
│ Settings      │ │ Course options ⋯  Extend this course · Download as EP… │ │
│ Course page: …│ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ┌────────────────────────────────────────────────────────┐ │
│               │ │ Outline and progress (as today, unchanged)             │ │
│               │ │ ────────────────────────────────────────────────────── │ │
│               │ │ Modules     the course's modules and lessons, as today │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ ────────────────────────────────────────────────────────── │
│               │                                                [ Primary ] │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐
│ ☰  Course page: Down…⌕   │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Course options ⋯  E… │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ A course that is     │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ still being written  │   │ A red notification:  │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ has no lessons yet:  │   │ 'Could not build the │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ the item is disabled │   │ book. Try again.'    │
│                      │   │ with the hint        │   │ The course page is   │
│                      │   │ 'Available when the  │   │ unchanged.           │
│                      │   │ course is ready'.    │   │                      │
│                      │   │                      │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: The browser saves <course-title>.epub; a green notification says 'Book downloaded'.

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
| course | `Menu item 'Download as EPUB' with a BookDown icon in the existing Course options menu` | a rare whole-course action like Extend and Delete; the menu keeps the header to one primary button | `a header button (competes with Continue) and a dialog with format options (there is one format)` |
| course | `Mantine notifications for success and failure` | the download happens in the background and needs only a short confirmation | `an Alert on the page (it would stay after the download is done)` |

## Data model

- **EPUB book (built on request, not stored)**
  - `undefined`: undefined
  - `undefined`: undefined
  - `undefined`: undefined
  - `undefined`: undefined
  - `undefined`: undefined

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/courses/:id/export.epub` | no | builds and returns the EPUB (application/epub+zip, Content-Disposition attachment); 404 for an unknown course, 409 while the course is not ready |

## Integration points

```
  CoursePage                ──▶  useDownloadCourseEpub → coursewrightService.downloadEpub (axios, responseType blob) → saves the file   (MSW handler returns a small fixture EPUB)
  agent/app/api/courses.py  ──▶  agent/app/epub.py build_epub(course detail, chapters, projects)   (stdlib zipfile; markdown-it-py for markdown; inkling render via the vendored CLI under Node, falling back to the drawing's title when Node is missing)
  agent/app/cli.py          ──▶  export-epub <folder> -o book.epub   (same builder for a course folder, so authored courses can be checked as books before import)
```

## Blast radius

```
new (3)
  ├── agent/app/epub.py
  ├── agent/tests/test_epub.py
  └── src/mocks/fixtures/course.epub (tiny)

changed (3)
  ├── src/pages/Course/CoursePage.tsx
  ├── src/api/services/coursewrightService.ts, src/hooks/useCoursewright.ts, src/mocks handlers
  └── agent/app/api/courses.py (new route), agent/app/cli.py (export-epub), agent/pyproject.toml (markdown-it-py)
```

## Verification plan

- [ ] `pytest: the book is a valid EPUB 3 zip (mimetype first and stored, container.xml, opf manifest lists every file, nav lists every lesson), every lesson present, Inkling SVG embedded, questions and answers present`
- [ ] `epubcheck on the domain-experts-on-pi book if available, else open it in Apple Books`
- [ ] `vitest: menu item calls the service, shows loading, success and error notifications; disabled while the course is not ready`
- [ ] `make check`
- [ ] `Download from the running app against the Mac mini and open the file`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
