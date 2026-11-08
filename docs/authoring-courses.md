# Writing a course with a coding agent

Any coding agent (Claude Code, Codex, Cursor, a person with an editor) can write a Coursewright course.
It writes the course as a folder of plain files, checks the folder, and imports it. The imported course
shows in the Library like one the builder made: lessons, quizzes, diagrams, projects, the tutor.

The folder is the same format the builder writes (`agent/app/materialise.py` reads both), so the checks
and the teaching rules are the same too.

## The loop

1. **Brief.** Agree with the person on the topic, the goal (what they can build or do at the end) and the
   pace. Write it to `brief.json`: `{"topic": "...", "goal": "...", "pace": "...", "answers": []}`.
2. **Outline.** Write `outline.json` by the rules in
   [curriculum.md](../agent/app/prompts/curriculum.md): work backwards from the goal to a floor everyone
   shares, one concept per lesson, prerequisites first. Run the check, then **show the person the
   outline and wait for their approval** before writing lessons.
3. **Lessons.** Write `chapters/<key>.md` for every lesson by [writer.md](../agent/app/prompts/writer.md),
   and `chapters/<key>.json` with 2-3 questions by [quiz.md](../agent/app/prompts/quiz.md). Everything the
   learner reads follows [course_format.md](../agent/app/prompts/course_format.md).
4. **Diagrams** (only where a moving picture shows what words can't), by
   [diagrammer.md](../agent/app/prompts/diagrammer.md).
5. **Projects** (optional): `projects/<key>.json` for a module with a `projectKey`.
6. **Check** until there are no errors, then fix the warnings you can.
7. **Import.**

Keep authored courses in `courses/<slug>/` at the repo root, so they are versioned and reviewable.

## Commands

Run from the repo root. `DIR` is the course folder.

```
make course-check  DIR=courses/bloom-filters          # every problem, with the file it is in
make course-import DIR=courses/bloom-filters          # check, then save it into the local database
make course-import DIR=courses/bloom-filters ARGS=--replace
make course-import DIR=courses/bloom-filters ARGS="--server http://localhost:8123"
make course-schema                                    # JSON Schemas of the three JSON files
```

The same commands, from `agent/`: `uv run python -m app.cli check|import|schema|export-epub ...`. `check --json`
gives a machine-readable report, and `--strict` fails on warnings as well as errors.

- **Local import** writes to the database the agent service uses (`CW_DB_PATH`, by default
  `agent/data/coursewright.db`). A running app shows the course after a reload.
- **`--server`** sends the folder to a running agent service (`POST /api/courses/import`), for example
  the deployed one. When that server has `CW_SHARED_SECRET` set, export the same value before running.
- **`--replace`** updates a course imported before under the same title. Its lessons are rewritten as new
  rows, so the learner's progress and quiz attempts on that course are lost.

## Through MCP

`agent/app/mcp_server.py` serves the same rules, checks and import as an MCP server, so an agent can
write a course without reading this repo.

- **Rules:** `get_guide`, `get_rules(stage)` (course_format, curriculum, writer, quiz, diagrammer, explainer) and
  `get_schema`. The same text is also available as `coursewright://guide` and `coursewright://rules/<stage>`
  resources, plus a `write-course` prompt that walks through the whole process.
- **Writing:** `start_course`, `save_outline`, `save_lesson`, `save_diagram`, `save_project`,
  `read_course`, `list_courses`, `check_diagram`, `check_inkling`. Each save checks what it wrote and returns
  its problems.
  A save that doesn't match the schema, or a diagram that doesn't compile, is refused.
- **Finishing:** `check_course`, `import_course` (pass `server` or set `CW_SERVER` to send the course to a
  running instance).

Folders go to `CW_COURSES_DIR`, by default `courses/` at the repo root.

Claude Code picks it up from `.mcp.json` in this repo. Elsewhere, register it with an absolute path:

```
claude mcp add coursewright -- uv --directory /path/to/coursewright/agent run python -m app.mcp_server
```

For Codex, add to `~/.codex/config.toml`:

```toml
[mcp_servers.coursewright]
command = "uv"
args = ["--directory", "/path/to/coursewright/agent", "run", "python", "-m", "app.mcp_server"]
```

## The folder

```
brief.json                 optional: topic, goal, pace
outline.json               the course: concepts, prerequisite edges, modules, lessons
chapters/<key>.md          one lesson, starting "# <title from outline.json>"
chapters/<key>.json        optional: questions, inline diagrams
diagrams/<key>.flow|.mmd   optional: the lesson's diagram (Flowmovie or Mermaid)
projects/<key>.json        a module's project, when the module names a projectKey
```

Keys are lower-case kebab-case (`context-window`). The smallest valid `outline.json`:

```json
{
  "title": "Bloom filters from zero",
  "topic": "Bloom filters",
  "summary": "Two sentences on what the course teaches and builds.",
  "colour": "teal",
  "concepts": [
    {"key": "hash-function", "name": "Hash function", "summary": "Turns any input into a number."},
    {"key": "bloom-filter", "name": "Bloom filter", "summary": "Answers 'maybe present' or 'surely absent'."}
  ],
  "edges": [{"from": "hash-function", "to": "bloom-filter"}],
  "modules": [
    {
      "key": "basics",
      "title": "Answering membership questions cheaply",
      "summary": "One plain sentence.",
      "chapters": [
        {"key": "hash-function", "title": "Hash function: turning any input into a number", "conceptKeys": ["hash-function"]},
        {"key": "bloom-filter", "title": "Bloom filter: a set that can say maybe", "conceptKeys": ["bloom-filter"]}
      ]
    }
  ]
}
```

An edge `{"from": A, "to": B}` means A is a prerequisite of B. `colour` is a Mantine colour name. A
`chapters/<key>.json`:

```json
{
  "questions": [
    {
      "prompt": "A Bloom filter says an item is present. What do you know for sure?",
      "options": ["It is present", "It may be present", "It is absent"],
      "answer": 1,
      "explanation": "Other items can set the same bits, so 'present' can be wrong; 'absent' never is.",
      "conceptKeys": ["bloom-filter"]
    }
  ]
}
```

On import, every lesson also gets the "Your map so far" diagram the builder draws, made from the
concepts and edges.

## Explainers

Every lesson carries one Inkling explainer, sometimes two: a hand-drawn drawing that draws itself step by
step, written as an ```` ```inkling ```` fence in the lesson's markdown right after the paragraph it
pictures. Both apps draw it where it sits, on the reader's theme paper. Pick the layout from the idea
(`sequence` for who sends what, `cycle` for a loop, `stack` for layers, `compare` for two approaches,
`timeline`, `mindmap`, or the default `flow`), so a course does not repeat one template. The rules and the
language are [explainer.md](../agent/app/prompts/explainer.md) (`get_rules("explainer")`).

````md
The loop is simple: the model thinks, asks for a tool, reads what came back, and thinks again.

```inkling
title "The agent loop"
layout cycle
center "until done"
think: circle "Think"
act: circle "Run a tool"
read: circle "Read the result"
cycle think, act, read
step 1: think "The model decides what to do"
step 2: act "The harness runs the tool it asked for"
step 3: read "The result goes back to the model"
```
````

The builder adds them on its own (the explainers stage), and `POST /api/courses/:id/explainers` adds them
to a course that has none. The tutor's index leaves the drawing's source out and keeps its title.

## What the check reports

**Errors** stop the import: a missing or unreadable file, a broken reference (an edge, a concept key, a
project), a duplicate key, a quiz answer out of range, a diagram or an explainer that doesn't compile,
or a lesson that comes before a lesson it depends on.

**Warnings** are the teaching rules the builder applies ([pedagogy.py](../agent/app/jobs/pedagogy.py)):
titles shaped `<concept>: <what it is in plain words>`, one concept per lesson, 250-800 words of prose,
no sentence that assumes the learner already knows the field, no name a later lesson teaches, no
reference to a later lesson, 2-3 questions per lesson, explainers with a title and steps (at most two,
narrow enough for a phone), and no file the outline doesn't list. The prose checks skip the explainers.

Flowmovie diagrams and Inkling explainers compile with `node`; without it they are skipped with a warning.
