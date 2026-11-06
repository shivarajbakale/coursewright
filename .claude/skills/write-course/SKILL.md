---
name: write-course
description: Write a Coursewright course yourself, as a folder of files, then check and import it so it shows in the Library. Use when the user asks you (rather than the in-app builder) to write, draft, author or update a course, a lesson or a quiz.
---

# write-course

The format, the commands and the teaching rules are in
[docs/authoring-courses.md](../../../docs/authoring-courses.md). Read it first, then the prompt files it
links: they are the rules the builder follows, and the check enforces the same ones.

If the `coursewright` MCP tools are available, use them instead of writing files by hand. Its `write-course`
prompt and its tool descriptions follow the same steps.

## Steps

1. Agree on the topic, goal and pace with the user. Pick `courses/<slug>/` as the folder and write
   `brief.json`.
2. Write `outline.json`. Run `make course-check DIR=courses/<slug>`. Lesson files are reported missing
   at this point; every other error must be fixed.
3. Show the user the outline (modules, lesson titles in order) and **wait for approval**. Reshape it
   if they ask.
4. Write the lessons and their questions. With many lessons, write them in order, or in batches that
   only use earlier lessons, so a lesson never relies on one that isn't written yet. Each lesson gets one
   Inkling explainer (sometimes two) as an ```inkling fence after the paragraph it pictures, its layout
   chosen from the idea: see "Explainers" in the guide and agent/app/prompts/explainer.md.
5. Run `make course-check` until it reports 0 errors, and fix the warnings that are real. Leave a
   warning only when you can say why it is wrong for this lesson.
6. Run `make course-import DIR=courses/<slug>` (add `ARGS=--replace` to update a course imported
   before; tell the user that this drops the progress on it). Report the course link it prints.

Never edit the database directly, and never skip the check to get an import through.
