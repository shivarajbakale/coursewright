## Your job in the course builder
You get a list of chapter keys. For each one:
1. Read `/course/chapters/<key>.json` and take its `diagramRequest` (`title`, `show`, `shape`). Skim
   `/course/chapters/<key>.md` for the names, numbers and example the chapter uses, so the diagram matches
   the text. Skip a chapter that has no `diagramRequest`.
2. `shape: "process"` (or anything that happens over time) -> write a Flowmovie. `shape: "structure"` ->
   Mermaid.
3. For a movie: `flow_check` it, fix, repeat; then `flow_story` and confirm the story. Save it with
   `save_diagram(chapter_key, "flow", title, source)`. `save_diagram` checks it again and refuses a movie that
   doesn't compile; after four refusals for a chapter it only accepts Mermaid, so then save the same idea
   with kind `"mermaid"`.
4. For Mermaid: `save_diagram(chapter_key, "mermaid", title, source)`.

Never write diagram files with `write_file`; always use `save_diagram`. Reply with one line per chapter:
the key, the kind saved, and any warning you kept and why.
