# Project instructions: a repository's own notes for the agent

Every repository has habits. This one runs tests with `pnpm test`. That one forbids editing generated files. A person new to the project reads a note before starting. The agent should too. Many repositories now keep such notes in a file called `AGENTS.md` at the top folder, and some use `CLAUDE.md`. Where should that file's text go: into a prompt section, or somewhere else?

## A note on the workshop door

Picture a carpenter arriving at a workshop. A note on the door says "Tests: pnpm test. Never edit files in gen/." The carpenter reads it once on arrival, and a photocopy goes into the job folder. If the note is rewritten next week, the job folder still shows what the carpenter actually read.

That is the design. The harness reads the file once, at the start of the session, and records its text as an event in the log. It is not a prompt section. Three reasons:

- The system prompt describes the harness and its tools. The file is content from the repository, written by whoever owns it, perhaps a stranger. It should arrive with the authority of a message, not of the harness's own rules.
- Recorded in the log, the text survives a restart. Session resume replays exactly what the model saw, even if someone edits the file later.
- The system prompt stays identical across repositories. A later lesson shows why that matters.

The picture stops holding at length. A carpenter reads the whole note. A model has a context window, so the harness keeps at most a fixed number of bytes and marks the rest as cut.

## Loading and recording the file

Add this to `src/context.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function loadProjectInstructions(cwd: string, maxBytes = 32_000) {
  const parts: string[] = []
  let used = 0
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    let bytes: Buffer
    try { bytes = await readFile(join(cwd, name)) } catch { continue } // no such file
    const room = maxBytes - used
    if (room <= 0) break
    const text = bytes.length > room ? bytes.subarray(0, room).toString('utf8') + '\n[truncated]' : bytes.toString('utf8')
    used += Math.min(bytes.length, room)
    parts.push(`<project-instructions file="${name}">\n${text}\n</project-instructions>`)
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined
}
```

Before the first step of the first turn, the loop checks the log. If no instructions event exists yet, it appends one:

```ts
await session.append('user/message', { content: text, source: 'project-instructions' })
```

Trace a repository with a 1,200-byte `AGENTS.md` and no `CLAUDE.md`:

```text
seq 0  system/message   the rendered prompt sections
seq 1  user/message     <project-instructions file="AGENTS.md"> ... </project-instructions>
seq 2  user/message     "fix the failing test"
```

The file fits in 32,000 bytes, so nothing is cut. Derived history now sends the instructions right after the system prompt and before your request. On resume, the loop finds the event at seq 1 and does not add a second copy. The `source` field lets your code, and a front end, tell this message apart from something the person typed.

> **Key idea:** Project instructions are a repository's own instruction files, read once, trimmed to a byte budget and recorded as a user-role message in the log, rather than mixed into the harness's system prompt.

**In DeepSeek Harness:** the loader is `packages/context/agent-instructions`. It looks for `AGENTS.md` and `CLAUDE.md` by default, and its `maxBytes` setting is required configuration, not a fixed default. The baseline files enter the log as one durable user message before the first request. An `AGENTS.md` in a deeper folder arrives later, once a read or edit tool reaches that folder, and changed or removed files produce new messages too.

## What you have now

You have the repository's notes in the log, right after the system prompt, built from prompt sections and derived history. Twice now, a design choice has kept the start of the request unchanged. The next lesson answers why: what does the provider do with a request whose beginning it has seen before?
