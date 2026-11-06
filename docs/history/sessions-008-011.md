# Sessions 008-011

Moved out of claude-progress.md to keep the session prelude within its doc-lint budget.

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
