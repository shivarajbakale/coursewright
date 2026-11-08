# Project instructions: the AGENTS.md file the model reads

With runtime context, the harness adds changing facts as logged user messages. One more source of instructions remains: the people who own the project. They know that tests run with `npm test`, or that one folder must not change. They write this down in the project, and they can change it while the agent works. How does the harness give that file to the model, and keep it current?

## House rules on the door

Think of a holiday flat. On the inside of the front door hangs a sheet of house rules: "Take the bins out on Tuesday." A guest reads it on arrival. If the owner pins a new sheet during the stay, the guest must read the new sheet, or the guest follows old rules.

In the harness, the flat is the project folder, the sheet is a Markdown file named **AGENTS.md**, and the guest is the model. The harness reads the file before the first request, and reads it again when a tool changes it. The comparison differs in one way: the model can also edit the sheet itself, with the write and edit tools. So the harness must watch its own agent's edits, not only the owner's.

## The smallest version

In mini-dsh, `src/instructions.ts` keeps the text the model last saw, and uses two listeners.

```ts
const seen = new Map<string, string>()   // file path -> text the model last saw
const touched = new Set<string>()

ctx.on('tools/result', (exec, result) => {
  if (!result.isError && ['read', 'write', 'edit'].includes(exec.name)) touched.add(exec.input.path)
})

ctx.on('agent/pre-step', async ({ turn, step }, next) => {
  const decision = await next()
  const notes = []
  if (turn === 1 && step === 1) {
    const text = await readIfExists(join(root, 'AGENTS.md'))
    if (text !== undefined) {
      seen.set(join(root, 'AGENTS.md'), text)
      notes.push(userNote(`The following workspace instructions may be relevant to your work.\n\n${text}`))
    }
  }
  for (const path of touched) {
    if (basename(path) !== 'AGENTS.md') continue
    const text = await readIfExists(path)
    if (text !== undefined && text !== seen.get(path)) {
      seen.set(path, text)
      notes.push(userNote(`Updated instructions from: ${path}\n\nUse the following content instead.\n\n${text}`))
    }
  }
  touched.clear()
  return { messages: [...decision.messages, ...notes] }
})
```

`userNote()` builds a user message with `source: 'agent-instructions'`, and the loop logs it like the time note. Trace one session:

1. Step 1 runs, and AGENTS.md says "Run tests with npm test." The listener adds the first note.
2. Let the model call `edit` to change the line. The new line is "Run tests with pnpm test." The edit succeeds, so the path goes into `touched`.
3. Step 2 runs. The text differs from what the model saw, so the listener adds an "Updated instructions" note.
4. Step 3 runs. Nothing touched AGENTS.md, so no note is added.

The file arrives as a user message, for the same reason as the time note: a changing system prompt would lose the cache. The opening sentence also says how much the file counts. The notes are guidance, and they do not overrule the system prompt or the person.

> **Key idea:** AGENTS.md is a project file of instructions; the harness adds it before the first request and adds it again after a tool changes it.

```inkling
title "Keeping AGENTS.md current"
layout down
file: icon file "AGENTS.md"
first: box "First note, step 1"
edit: box "edit tool succeeds"
result: box "tools/result"
pre: box "agent/pre-step"
update: box "Updated note"
file -> first
edit -> result : "path touched"
result -> pre : "at the next step"
pre -> update : "text changed"
step 1: file, first "The harness reads the file before the first request"
step 2: edit, result "A successful edit records the file it touched"
step 3: pre, update "The next step adds the new text as a note"
```

## How dsh does it

The plugin is `packages/context/agent-instructions`. `src/config.ts` (line 12) looks for both `AGENTS.md` and `CLAUDE.md`, and for `AGENTS.local.md` overlays. It finds the project root by walking up to a `.git` folder. The base bundle caps each set of files at 65,536 bytes (`packages/bundle/base/cordis.patch.yml`, line 310). In `src/index.ts`, a `tools/result` listener (line 358) collects paths from successful `read`, `write` and `edit` calls. An `agent/pre-step` listener (line 330) then adds the changed text. `src/render.ts` (lines 257-270) writes "Updated instructions from:" or "Instructions removed:".

## What you have now

The model's view now holds the system prompt, the history, time notes and the project's instructions, and every piece adds tokens. As you saw with the context window, a request has a fixed limit. How does the harness know how close the next request is to that limit, before it sends it?
