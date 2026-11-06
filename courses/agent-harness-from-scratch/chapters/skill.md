# Skill: instructions the model loads only when needed

Your team writes careful instructions for recurring jobs: how to write release notes, how to add a database migration, how to review a pull request. Each is a few thousand tokens. Twelve of them in the system prompt would cost about 36,000 tokens on every request, even in a session that never touches a migration. Leaving them out means the model never knows they exist. Is there a way to have all twelve on hand while paying only for the ones used?

## A menu, not a buffet

A restaurant does not cook every dish and lay them all out. It hands you a menu: dish names, each with one line of description. The kitchen cooks only what you order.

A skill works the same way. The model sees a short menu of skill names and one-line descriptions. When a job matches, it calls a tool to load that skill's full text. The picture stops holding at the ordering. A diner knows when they are hungry. The model only orders a skill if the description makes clear when it applies. So a good description says what the skill does and when to use it.

```inkling
title "How a skill gets loaded"
catalog: box "Catalog\n12 names, one line each" green
model: circle "Model"
tool: box "skill tool"
body: db "Full body\n~3000 tokens"
job: sticky "A job matches"
catalog -> model : "always in context"
job -> model
model -> tool : "skill(name)"
tool -> body : "loads one"
body -> model : "only this cost"
step 1: catalog "The catalog is always in context, one line per skill"
step 2: job, model "A job arrives that matches one description"
step 3: model, tool "The model calls skill with that name"
step 4: body "The full instructions arrive as a tool result"
step 5: unused "The other eleven skills stay unloaded"
```

## Files, a catalog and a loader tool

Each skill is a folder containing `SKILL.md`. The file starts with frontmatter: a block between two `---` lines holding simple `key: value` fields, here `name` and `description`. The instructions follow.

```markdown
---
name: release-notes
description: Write release notes from merged pull requests. Use when asked for a changelog.
---
1. List pull requests merged since the last tag ...
```

Add discovery and the tool to `src/context.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

function split(text: string) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  const fields: Record<string, string> = {}
  for (const line of m?.[1].split('\n') ?? []) {
    const k = line.indexOf(':')
    if (k > 0) fields[line.slice(0, k).trim()] = line.slice(k + 1).trim()
  }
  return { fields, body: m ? text.slice(m[0].length) : text }
}

export async function discoverSkills(root: string) {
  const skills = new Map<string, { description: string; body: string }>()
  for (const dir of await readdir(root).catch(() => [])) {
    const text = await readFile(join(root, dir, 'SKILL.md'), 'utf8').catch(() => undefined)
    if (text === undefined) continue
    const { fields, body } = split(text)
    if (fields.name && fields.description) skills.set(fields.name, { description: fields.description, body })
  }
  return skills
}
```

This reads only the simplest form of frontmatter, one `key: value` per line, which is enough here. Two pieces use the map. Before the first step, the loop records a catalog as one user message, like the project instructions:

```text
Skills are available. Call the skill tool with a name to load one.
- release-notes: Write release notes from merged pull requests. Use when asked for a changelog.
- add-migration: Add a database migration. Use before changing any table.
```

And a `skill` tool, registered like any other, returns the body:

```ts
const skillTool: Tool = {
  name: 'skill', description: 'Load the full instructions of one skill from the catalog.',
  parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  async execute(args) {
    const s = skills.get((args as { name: string }).name)
    if (!s) throw new Error(`unknown skill "${(args as { name: string }).name}"`)
    return s.body
  },
}
```

Trace it. Twelve skills of about 3,000 tokens each would be 36,000 tokens up front. The catalog costs about 30 tokens per line, around 360 in all. The person asks for a changelog. The model calls `skill({ name: 'release-notes' })`, and 3,000 tokens arrive as a tool result. The other eleven are never sent. Because the catalog is a recorded message, not a prompt section, the system prompt stays the same in every repository.

> **Key idea:** A skill is a named instruction file whose name and description sit in a small catalog the model always sees, while its full body is loaded through a tool only when the model asks for it.

**In DeepSeek Harness:** `packages/skill/skill-filesystem` discovers skills from ranked roots, project folders such as `.dsh/skills` and `.agents/skills`, then custom, user and bundled ones, and watches them for changes. Frontmatter can also set `disable-model-invocation` and `user-invocable`. `packages/skill/tool-skill` publishes the catalog as a durable user message wrapped in a `<system-reminder>` tag, and its `skill` tool returns the body plus a list of extra resource files, each loaded only when asked.

## What you have now

You can offer many long instructions for the price of their names, using prompt sections, project instructions and the tool registry. Skills add instructions, but the tools themselves are still all yours. Next: how can `minidsh` use tools that another program provides?
