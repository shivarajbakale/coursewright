<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/lockup-dark.svg">
    <img src="public/brand/lockup-light.svg" alt="Coursewright" height="64">
  </picture>
</p>

<p align="center">
  <strong>Name anything you want to learn. A team of AI agents writes you a course.</strong><br>
  Chapters explained from first principles, step-by-step diagrams, quizzes, projects,
  a tutor that answers from your own course, and notes beside every chapter.
</p>

<p align="center">
  <a href="#run-it-in-a-minute">Run it</a> ·
  <a href="#what-you-get">Features</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#the-full-stack">Full stack</a> ·
  <a href="LICENSE">MIT licence</a>
</p>

<p align="center">
  <img src="docs/media/demo.gif" alt="Naming a topic, answering a short interview, watching the agents build the course, then reading a chapter and taking notes beside it" width="900">
</p>

## Run it in a minute

You need Node 20 or newer. No API key, no backend: the app runs on realistic mock data, including a finished
course on Raft consensus.

```bash
git clone https://github.com/shivarajbakale/coursewright.git
cd coursewright
npm install
npm run dev            # http://localhost:5173
```

To build real courses and talk to a real tutor, run [the full stack](#the-full-stack) with a model key.

## What you get

<table>
  <tr>
    <td width="50%"><img src="docs/media/interview.png" alt="The New course interview"><br>
      <strong>A short interview, not a form.</strong> Name a topic and answer a few questions one at a time:
      how much you know, what you want to be able to do, how much time you have. Number keys pick, Enter moves on.</td>
    <td width="50%"><img src="docs/media/building.png" alt="A course being built, stage by stage"><br>
      <strong>Watch it being built.</strong> Agents research the topic, map the concepts, outline modules, write
      chapters, draw diagrams and design projects. Each stage animates live; leave and come back any time.</td>
  </tr>
  <tr>
    <td><img src="docs/media/chapter-notes.png" alt="A chapter with notes open beside it"><br>
      <strong>Read, and write beside it.</strong> Chapters start from the problem, define every term and build one
      idea at a time. Open notes next to the text; select a passage to quote it in.</td>
    <td><img src="docs/media/course.png" alt="Course overview with outline, weak spots and concept map"><br>
      <strong>See where you are.</strong> Modules, chapters and a project per module, your progress, the concepts
      you keep missing, and a map of how the ideas depend on each other.</td>
  </tr>
  <tr>
    <td><img src="docs/media/tutor.png" alt="The tutor"><br>
      <strong>A tutor that knows your course.</strong> It answers from your chapters and notes with citations,
      says when your course doesn't cover something, quizzes you, and turns a process into a step-by-step movie.
      It also opens beside any screen with ⌘J.</td>
    <td><img src="docs/media/notes.png" alt="Notes"><br>
      <strong>Notes that stay connected.</strong> Nested pages, a block editor, @-mentions of chapters, diagram
      and quiz blocks, and backlinks. Every chapter's notes live under its course.</td>
  </tr>
</table>

And the rest you'd want: projects with milestones, hints and a GitHub code review; a search index you can inspect
and test on the Sources page; notifications when a build or review finishes; Continue for a build that stopped;
resizable panels; light and dark themes; and empty and error states that tell you what to do next.

## How it works

```
 Interview ──▶ brief ──▶ ┌──────────── course builder (deepagents) ────────────┐
                         │ researcher → curriculum → writers → diagrammer      │
                         │            → project designer → reviewer            │
                         └──────────────────────────┬──────────────────────────┘
                                                    ▼
                    chapters · questions · diagrams · projects  (files → SQLite)
                                                    ▼
                    hybrid search index (sqlite-vec + FTS5)  ◀── your notes, links you add
                                                    ▼
                    tutor (CopilotKit + deepagents): answers with [n] citations
```

- **One shared rule for clarity.** Every agent that writes for the learner follows the same
  [explaining rules](agent/app/prompts/course_format.md): start from the problem, define each term before using
  it, intuition before formula, no "simply" or "obviously". The reviewer treats unclear writing as blocking.
- **Builds that survive.** Builds checkpoint as they go. A stopped or interrupted build continues from where it
  was, and a build that has written its whole course is saved even past its token budget.
- **Diagrams that are checked.** Movies are [Flowmovie](agent/vendor/flowmovie) scripts, compiled
  and checked before they ship; anything that fails falls back to Mermaid.

More: [architecture](docs/plan/architecture.md) · [API contract](docs/plan/api-contract.md) ·
[agent service](agent/README.md).

## The full stack

Three processes: the web app, the CopilotKit runtime for the tutor, and the Python agent service.

```bash
# once
cd agent && uv sync && cd ..
cp agent/.env.example agent/.env     # then add your ANTHROPIC_API_KEY

# every time
npm run dev:stack                    # agent :8123 · runtime :4000 · web :5173
```

| Process | Port | Built with |
| --- | --- | --- |
| Web app | 5173 | React 19, TypeScript, Vite, Mantine 9, TanStack Router and Query |
| Tutor runtime | 4000 | CopilotKit runtime (Node) |
| Agent service | 8123 | Python 3.12, FastAPI, deepagents / LangGraph, SQLite with sqlite-vec and FTS5 |

**Models.** Claude by default. Any Anthropic-compatible provider works too; for MiniMax, set these in
`agent/.env`:

```bash
ANTHROPIC_API_KEY=<your MiniMax key>
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
CW_MODEL=MiniMax-M3
```

**Without a key** everything except the model still works: the seeded Raft course, reading, quizzes, progress,
notes, sources and search. Add `VOYAGE_API_KEY` for better retrieval; without it a local embedder is used. All
settings are in [agent/README.md](agent/README.md#environment).

## Develop

```bash
npm test              # unit and component tests (Vitest)
npm run ui-probe      # layout, hierarchy and motion checks in real Chromium
make check            # everything: types, lint, design-system lint, tests, probe
cd agent && uv run pytest
```

In mock mode, add `?mock=empty`, `?mock=fail`, `?mock=offline` or `?mock=demo` to any URL to see the empty,
error, offline and fully-connected states (`?mock=default` resets).

The UI uses Mantine as its only design system; `npm run ui-lint` fails the build on hand-rolled primitives.
The block editor, page tree and theme come from [kit](vendor/kit), vendored as built packages.

## Licence

[MIT](LICENSE). The vendored kit packages are MIT too.
