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
 "icon": "one emoji",
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
 "diagrams": [{"kind": "mermaid", "title": "...", "source": "flowchart LR\n  A --> B"}]}
```
2-4 questions per chapter, 3-4 options, `answer` is the 0-based index of the right option (vary it).
Diagrams are optional: `kind` is `mermaid` (valid Mermaid source) or `flow`. Prefer Mermaid.

`/course/projects/<projectKey>.json`:
```json
{"title": "...", "brief": "markdown", "starter": [{"path": "src/main.py", "note": "what goes here"}],
 "hints": ["gentle first", "more specific"], "rubric": [{"criterion": "...", "chapterKey": "c01-some-slug"}],
 "milestones": [{"title": "...", "body": "markdown: what to do and how to know it works", "checkCmd": "pytest -k first"}]}
```
