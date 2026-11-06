# Progress Log

## Current Verified State

- Repository root: this project
- Standard startup path: `./init.sh`
- Standard verification path: `make check` (install + type-check + lint + test)
- Current highest-priority unfinished feature: none open; next: phone reader Phase 1 (library, outline, chapter reader, settings) planned with plan-feature from the design canvas https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS; later per-module skip quiz, later-name leaks in lessons
- Current blocker: none

## Session Log

### Session 012 — Phone and iPad reader, Phase 0 spike (2026-11-06)

- Owner: a phone/iPad reading app, a PWA built with react-native-web, easy to read, an Ask-tutor button,
  no notes. Plan: Vite + react-native-web app in `mobile/`, served at `/m/` by the same nginx; phases
  0 spike, 1 read, 2 rich content, 3 tutor, 4 PWA (offline, install), 5 ship. iPad: layout by window
  width (<700 one column, 700-1023 wide column + sheet, >=1024 three panes with docked tutor).
- Design canvas approved: https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS (6 iPhone, 2 iPad screens).
- Spike (feature reader-pwa-spike): library from /api/courses and a streamed tutor reply, verified in
  WebKit at 390x844 and 820x1180 against the Mac mini. Tutor runs on `@copilotkit/core` + `mobile/src/tutor.ts`
  (react-core's v2 entry bundles its chat UI: 700 KB gzipped vs 278 KB). See DECISIONS.md 2026-11-06.
- Found: tutor replies carry citation markers like `[6]`; Phase 3 must turn them into chapter links.

### Session 011 — Coding agents can write courses (2026-11-06)

- Owner: wants Claude Code, Codex or any agent to write a course. The course folder the builder already
  writes is the contract; `agent/app/authoring.py` checks it (errors block import, teaching rules from
  pedagogy.py are warnings) and imports it under seed_key `authored:<slug>`, adding the map diagram.
- Ways in: `make course-check|course-import|course-schema` (app/cli.py), POST /api/courses/import, the
  `write-course` skill + docs/authoring-courses.md, and the `coursewright` MCP server
  (agent/app/mcp_server.py, mcp 2.x, stdio, registered in .mcp.json): rules as tools, resources and a prompt;
  save tools check each piece.
- The check found real prerequisite-order errors in the Raft seed (2) and the Rust course (1); not fixed.
- A 14-lesson Bloom filter draft from a test agent sits outside the repo; owner deferred course writing.

### Session 010 — Every course starts from zero, one concept per lesson (2026-11-06)

- Owner: chapter 1 of the Agentic RAG course assumed RAG ("You already have a working retrieval system").
  Courses must start from the basics, one concept per short lesson, titles that name the concept.
- Curriculum is a concept map worked backwards to a fixed floor; one lesson per concept, titled
  `<concept>: <plain words>`, sized to pace (3 months = 60-90). Level never reaches research, curriculum or
  writer. Lessons in dependency waves with a glossary; code rejects terms before they are taught; a
  beginner reader marks sticking points and the lesson is revised (up to 2 rounds). "Your map so far"
  diagram per lesson, drawn by code. Whole-course review removed. Rules: agent/app/jobs/pedagogy.py.
- Teaching eval (evals/teaching.py, export_course.py): old course stuck 12.6/chapter (18 in ch. 1), 14/14
  vague titles; new build 5.5/lesson (5 in lesson 1), 1/80 vague, 0 forward refs. 4.1M tokens (was 0.76M).
- Open: 11 lessons still name a later concept; per-module skip quiz for experienced learners not built.

### Session 009 — Outline review and the build pipeline (2026-11-05)

- A build pauses after its outline (default; a checkbox in the interview turns it off). The learner
  reshapes it by chat or removes chapters, then Write this course continues. New: course_plans table,
  outline_ready notice, /courses/:id/plan endpoints, OutlineReview on the building page, Library badge.
- The deepagents orchestrator is replaced by agent/app/jobs/pipeline.py: one structured call per piece,
  checks in code with retries that revise the draft, tokens per stage on the job, resume by files on disk.
- Measured on the Mac mini (MiniMax-M3): without a per-chapter check, 0.66M tokens and eval 3/5 twice
  (accuracy 2-3) vs the old engine's 4/5 twice at 11.9M. A verify stage (numbers, code, answer keys per
  chapter, then a revision) brought it to 4/5 twice, accuracy 4, at 0.76M tokens.
- Open: chapter length on MiniMax (3 of 12 still over 1300 words). Unpushed commits since 653c251.

### Session 008 — Public release (2026-11-05)

- Published at https://github.com/shivarajbakale/coursewright (public, MIT).
- Logo (public/brand/), web icons, BrandMark in the sidebar; README with a demo GIF and screenshots
  (docs/media/, regenerated from mock mode with ?mock=demo).
- kit packages vendored as tarballs in vendor/kit; a fresh clone with no sibling kit installs, type-checks,
  passes 334 tests, builds and serves.
- Commit emails rewritten to the owner's chosen public address before the first push; gitleaks clean
  (seed-key false positives only). Local branch backup/pre-email-rewrite keeps the old history; not pushed.

Earlier sessions: [docs/history/sessions-001-007.md](docs/history/sessions-001-007.md).
