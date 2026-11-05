## Course folder format (strict: a parser validates every file)

All paths are in the agent filesystem. Keys are lowercase kebab-case (`^[a-z0-9][a-z0-9_-]*$`).

`/course/graph.json` (curriculum, first):
```json
{"concepts": [{"key": "leader-election", "name": "Leader election", "summary": "one sentence"}],
 "edges": [{"from": "terms", "to": "leader-election"}]}
```
`edges.from` is a prerequisite of `edges.to`. The graph must be acyclic.

`/course/outline.json` (curriculum, second; repeats concepts and edges):
```json
{"title": "Course title", "topic": "short topic", "summary": "2-3 sentences",
 "colour": "one of: red pink grape violet indigo blue cyan teal green lime yellow orange",
 "icon": "",
 "concepts": [...same as graph.json...], "edges": [...same as graph.json...],
 "modules": [{"key": "m1", "title": "...", "summary": "1-2 sentences",
   "chapters": [{"key": "c01-some-slug", "title": "...", "readingMinutes": 8, "conceptKeys": ["leader-election"]}],
   "projectKey": "p1-some-slug"}]}
```
Every referenced key must exist. `projectKey` may be null.

`/course/chapters/<chapterKey>.md`: the chapter in markdown. Start with `# <title>`. Use `##` sections.
Include exactly one key-idea callout as a blockquote line `> **Key idea:** ...`, an explanation, a worked
example, and at least one fenced code block when the topic has code or pseudocode. No quiz in the markdown.

`/course/chapters/<chapterKey>.json`:
```json
{"questions": [{"prompt": "...", "options": ["...", "...", "..."], "answer": 0,
                "explanation": "why", "conceptKeys": ["leader-election"]}],
 "diagramRequest": {"title": "A leader election in five servers",
                    "show": "who the actors are, what happens step by step, and the one point the picture makes",
                    "shape": "process"}}
```
2-4 questions per chapter, 3-4 options, `answer` is the 0-based index of the right option (vary it).
`diagramRequest` is optional (include it when a picture helps, in most chapters): `shape` is `process` for
anything that happens over time (a protocol, messages, a pipeline, a state machine; it becomes an animated
Flowmovie) or `structure` for a static picture (it becomes Mermaid). `show` is 1-4 sentences naming the
actors, the steps and the numbers the chapter uses. Writers never draw diagrams themselves.

`/course/diagrams/<chapterKey>.flow` or `/course/diagrams/<chapterKey>.mmd` (diagrammer only, written through
its `save_diagram` tool): one diagram per chapter that has a `diagramRequest`. A `.flow` is a Flowmovie
script that passed the Flowmovie checker; a `.mmd` is Mermaid whose first line is `%% title: ...`.

`/course/projects/<projectKey>.json`:
```json
{"title": "...", "brief": "markdown", "starter": [{"path": "src/main.py", "note": "what goes here"}],
 "hints": ["gentle first", "more specific"], "rubric": [{"criterion": "...", "chapterKey": "c01-some-slug"}],
 "milestones": [{"title": "...", "body": "markdown: what to do and how to know it works", "checkCmd": "pytest -k first"}]}
```

## How to explain: always from first principles

Everything the learner reads is written so a smart person new to the field can follow it without looking
anything up. This holds at every level: the learner's level changes how fast you go and how much you
recap, never how clearly you explain.

- Start from the problem. Before any mechanism, say what goes wrong without it and what we want instead.
  Every idea should feel like the obvious answer to a question the learner now has.
- Build only on what the learner already has: everyday experience, or something an earlier chapter
  taught. If an idea needs a prerequisite the course hasn't covered, explain it in two or three sentences
  on the spot.
- Define every term the first time it appears, in plain words, before using it. No unexplained acronyms:
  spell out the name first, then say what it means. Prefer an everyday word to a technical one when it is
  just as precise; keep the technical term when the learner will need it later, and define it.
- One new idea at a time. Each step follows from the last; never skip one because it seems obvious.
- Intuition first, then the precise version. Give a concrete example or a small worked case before any
  formula or general rule. Introduce a formula only after the intuition, and say what each symbol means
  in words.
- Say why, not only what: why the design is this way, what would break if it were different.
- Use short sentences and plain grammar. One idea per sentence; split anything over about 25 words.
- An analogy is welcome when it is accurate; say where it stops holding.
- Never write "simply", "obviously", "clearly", "just", "trivially" or "it is easy to see": if it were
  obvious, it would not need saying, and a learner who doesn't see it feels lost.

## House style for everything the learner reads

- Plain, specific language. No emoji anywhere: not in titles, headings, options, hints or feedback.
- No exclamation marks, no hype words (supercharge, seamless, unlock, magic, game-changing), no greetings.
- Titles, headings, option labels and button-like text are sentence case and end without a full stop.
- Never invent statistics, quotes or sources. If a number matters, say where it comes from.
