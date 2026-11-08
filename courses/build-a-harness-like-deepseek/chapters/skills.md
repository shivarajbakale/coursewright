# Skills: instructions loaded only when needed

With MCP tools, outside programs add tools to the registry. Some help is not a program, though. It is a long set of steps: how this team writes release notes, how it runs a database change, how to fill in a PDF form. Each set may be thousands of tokens. If every request carried all of them, most of the context window would hold instructions that this task never uses. How can the model have them without paying for them on every request?

## A library catalogue

Think of a library. You do not carry every book around. At the entrance there is a catalogue: one card per book, with a title and one line about it. You read the cards, pick the book you need, and ask the desk for it. Only that book comes to your table.

In the harness, the books are skills: a **skill** is a Markdown file of instructions for one kind of task. The catalogue is a short list of skill names and one-line descriptions that the model sees. The desk is one tool named `skill` that returns a skill's full text. The comparison differs in one way: the model, not a person, decides when a book matches. So each description must say clearly when to use the skill.

## A file, a list and a tool

Each skill is a folder with a file named **SKILL.md**. It starts with a short header in YAML between two `---` lines, which holds the name and the description:

```md
---
name: release-notes
description: Write release notes from merged changes, in this repository's house style.
---
# Release notes
1. List the merged changes since the last tag with git log.
...
```

In mini-dsh, `src/skills.ts` reads `.agents/skills/*/SKILL.md`, then adds two things:

```ts
const tools = ctx.get<ToolsService>('tools')!
ctx.effect(() => tools.register(defineTool({
  name: 'skill',
  description: 'Load the full instructions for a skill. Call it before acting on a task that matches a skill in the catalog.',
  parameters: { name: { type: 'string', required: true } },
  async execute({ name }) {
    const skill = skills.find((s) => s.name === name)
    if (skill === undefined) throw new Error(`skill "${name}" is unknown`)
    return skill.body
  },
})))

let lastCatalog: string | undefined
ctx.on('agent/pre-step', async (payload, next) => {
  const decision = await next()
  const text = ['<available_skills>', ...skills.map((s) => `- ${s.name}: ${s.description}`), '</available_skills>'].join('\n')
  if (text === lastCatalog) return decision
  lastCatalog = text
  return { messages: [...decision.messages, userNote(text)] }
})
```

The catalogue arrives like the time note: a logged user message, added again only when the list changes. Trace a project with three skills:

1. Count the full texts. The skill `release-notes` is 3,200 tokens, `db-migrations` 2,400 and `pdf-forms` 4,000, so 9,600 in all.
2. Count the catalogue. Each line is about 30 tokens, so the list is about 120 tokens with its framing.
3. The user asks for release notes. The model reads the catalogue and calls `skill` with `release-notes`.
4. The tool result holds 3,200 tokens. They enter the history once, and the other 6,400 never do.

```inkling
title "Everything at once, or on request"
layout compare
columns "All texts in every request", "Catalogue and one tool"
row "Tokens before the task": "9,600", "about 120"!
row "Full steps when needed": yes, yes
row "Unused texts in history": yes, no
steps auto
```

> **Key idea:** A skill is a SKILL.md file of task instructions; the model sees a short catalogue and loads one skill's full text with the skill tool.

## How dsh does it

```inkling
title "The skill service and its parts"
layout mindmap
- ctx.skills
  - skill-filesystem
  - skill-office
  - tool-skill
steps auto
```

`packages/skill/skill` defines `ctx.skills`, which merges the lists of its providers. `packages/skill/skill-filesystem` reads skills from `.dsh/skills` and `.agents/skills` in the project and from the user's home folders (`src/index.ts`, lines 256-264). It ignores a file whose YAML lacks a `name` or a `description` (lines 829-831). `packages/skill/tool-skill/src/index.ts` registers the `skill` tool (line 84). Its `agent/pre-step` listener (line 217) adds a catalogue inside `<available_skills>` tags, with each description cut to 500 characters (line 28). The listener republishes the catalogue only when its digest changes. A person can also type `/release-notes` to load a skill directly.

## What you have now

The model can now reach built-in tools, outside tools and long instructions without filling every request. Each tool call still costs one full step: the model asks, the harness runs it, and the result goes back before the next ask. A task such as "read 40 files and count the lines in each" takes 40 steps. Could the model ask for all of that at once?
