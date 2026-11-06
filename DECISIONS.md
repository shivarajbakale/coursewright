# Design Decisions

Append-only. New entries go at the top. Each entry should answer:

- **What** changed
- **Why** (the forcing function — constraint, deadline, stakeholder ask, bug)
- **Rejected alternatives** (and why)
- **Constraint or invariant** the decision creates (so future agents know what
  they can't silently undo)

---

## 2026-11-06 — Every course starts from zero, one concept per lesson

- **What:** the curriculum is a concept map worked backwards from the goal to a fixed floor ("can
  program, knows nothing about this field"), one lesson per concept, titled `<concept>: <plain words>`.
  The learner's stated level is removed from what the research, curriculum and writer calls see. Lessons
  are written in dependency waves against a glossary of terms earlier lessons explained; code rejects a
  term used before it is taught or a later concept named early. A beginner-reader call marks where a
  newcomer gets stuck and the lesson is revised (up to two rounds, kept only when it helps). The
  whole-course review stage is gone; per-lesson reading and the accuracy check replace it.
- **Why:** the owner found chapter 1 of the Agentic RAG course ("Why a fixed retrieval pipeline breaks")
  opening with "You already have a working retrieval system" and ~15 undefined terms. Measured
  (evals/teaching.py, same reader): 18 sticking points in chapter 1, 12.6 per chapter, 14/14 vague titles.
- **Rejected:** stronger prompts alone (the old prompts already said "from zero"; the brief's level won);
  keeping the level for pacing inside the writer (it leaks into the text); a whole-course review (too
  big at 60-90 lessons, and it never caught the problem).
- **Constraint:** don't pass `brief_text(level=True)` to anything that writes for the learner; keep
  `pedagogy.py` the one place the title/term rules live, shared by the pipeline and the teaching eval. A
  course costs ~4M tokens on MiniMax-M3 (was 0.76M); `READ_ROUNDS=1` is the lever if cost matters more.

## 2026-11-05 — Storybook stories are optional

- **What:** storybook-lint rule R8 (every composite in `src/components/` needs a sibling story and a
  taxonomy entry) is retired. Existing stories are still linted by R1–R7 and R9.
- **Why:** the owner considers writing stories a waste for this personal app.
- **Rejected:** keeping R8 and writing stories anyway; dropping storybook-lint entirely (the remaining
  rules still catch broken stories that exist).
- **Constraint:** don't add stories by default; components are verified by tests and the UI probe.
