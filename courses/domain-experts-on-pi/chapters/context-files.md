# Context files: AGENTS.md read from every folder above

The prompt file gives the expert its role. Some facts belong to a place, not to a role. In the shop database, `orders.total` is in cents. That fact is true only next to that data. Where do you write it so the expert reads it whenever it works there, and not when it works elsewhere?

Think of a sticky note on a filing cabinet. Anyone who opens the cabinet sees the note. The note says how the files inside are arranged. The comparison differs from pi in one way: a person sees only the note on the cabinet in front of them, but pi collects notes from every folder above the working folder too.

pi does this with a **context file**. It is a Markdown file with one of these names: `AGENTS.md` or `CLAUDE.md`. pi looks in its own folder, `~/.pi/agent/`, and in every folder from the root of the disk down to the working folder. In each folder it takes the first file that exists from this list:

1. `AGENTS.override.md`
2. `AGENTS.md`
3. `AGENTS.MD`
4. `CLAUDE.md`
5. `CLAUDE.MD`

Only one file counts for each folder. The order of reading goes from outside to inside. The file in `~/.pi/agent/` comes first. Then come the files from the root folder down to the working folder. The working folder comes last, so its notes are closest to the end of the prompt.

pi wraps each file in a tag, `<project_instructions path="...">`, and puts all of them in the `project_context` section of the system prompt.

```inkling
title "Notes gather from every folder above"
layout flow
layout down
global: box "~/.pi/agent/ AGENTS.md"
root: box "Parent folders AGENTS.md"
data: box "fleet/data/ AGENTS.md"
ctx: box "project_context section"
global -> root -> data
data -> ctx
step 1: global "The file in pi's own folder comes first"
step 2: root "Each parent folder adds its file, outermost first"
step 3: data "The working folder adds its file last"
step 4: ctx "All files go into one section of the prompt"
```

A small case from `fleet`. You write `fleet/data/AGENTS.md`:

```ts
// fleet/data/AGENTS.md, shown as a string for this lesson
const notes = `orders.total is in cents.
placed_at is UTC.`;
```

You run the SQL expert from inside `fleet/data`. pi reads this file and puts it in `project_context`. The expert now knows to divide `total` by 100 before it reports money. The prompt file did not change.

There is a warning. A general rule file in a higher folder also loads. If your home folder has an `AGENTS.md` for your own coding habits, the SQL expert reads it too. To stop all context files, run pi with `--no-context-files` or `-nc`. Then the expert gets its knowledge only from its pack. These files also load when a project is not trusted, so do not put secrets in them.

> **Key idea:** pi reads one AGENTS.md or CLAUDE.md from ~/.pi/agent/ and from each folder down to the working folder, outermost first, into the project_context section.

## How pi does it

In each folder pi takes the first of `AGENTS.override.md`, `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`, `CLAUDE.MD` (packages/coding-agent/src/core/resource-loader.ts:212-231). The global file comes first, then each parent folder from the root down (resource-loader.ts:260-302). Each file is wrapped as `<project_instructions path="...">` in the project_context section (packages/coding-agent/src/core/system-prompt.ts:79-86). The flag `--no-context-files` turns this off (resource-loader.ts:679-685). These files load even when a project is not trusted (packages/coding-agent/docs/security.md:57).

## What you have now

You can place facts next to the data they describe, and you know the order pi reads them in. This joins the system prompt sections you met with the expert prompt. A context file is always in the prompt, and a long one costs space every time. How can an expert carry a long procedure and load it only when a task needs it?
