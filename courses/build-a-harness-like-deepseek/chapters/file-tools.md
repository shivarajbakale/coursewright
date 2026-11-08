# File tools: reading and changing files safely

With defineTool you can write any tool, and the pipeline checks every call. The tools an agent uses most are three that work on files. The tool `read` shows a file, `write` replaces a whole file, and `edit` replaces one piece of text in it.

These three look simple, but the danger is time. The model reads `app.ts`, thinks for a minute, and then edits it. In that minute, you saved your own change to `app.ts` in your editor. If the edit goes ahead, it works on text the model never saw, and your change can be lost. How does an edit know that the file is still the one the model read?

## A shared document with a version number

Think of a shared office document that shows "version 7" at the top. You print version 7 and mark changes on paper. When you go back to type them in, the document says "version 8": someone else saved in between. A careful colleague does not type over version 8. They print it again, look at what changed, and then make their edit.

In a harness, the printout is what `read` returned, and the careful colleague is the edit tool. The version number is a version the file tool stores for each file a session reads. The comparison differs in one way. The colleague notices the new number by looking. The harness checks the number in code, at the moment of the change, and refuses the edit with an error the model can read.

```inkling
title "A stale edit is refused"
layout sequence
model: box "Model"
tool: box "edit tool"
file: db "app.ts"
you: person "You"
model -> tool : "read app.ts"
tool --> model : "text, version v1"
you -> file : "save a change (v2)"
model -> tool : "edit app.ts"
tool -> file : "still v1?"
file --> tool : "no, v2"
tool --> model : "Error: read the file again"
steps auto
```

## The smallest guarded edit

Here is the version check in `src/fs-tools.ts`. A version is the file's last-change time and size. The `read` tool stores it per session and path. The `edit` tool compares it with the file on disk right before it writes.

```ts
const seen = new Map<string, string>()   // `${sessionId}:${path}` -> version

async function versionOf(path: string): Promise<string> {
  const info = await stat(path)
  return `${info.mtimeMs}:${info.size}`
}

async function editFile(sessionId: string, path: string, oldText: string, newText: string): Promise<string> {
  const known = seen.get(`${sessionId}:${path}`)
  if (known === undefined) throw new Error(`edit requires reading "${path}" first`)
  if (known !== await versionOf(path)) throw new Error(`"${path}" changed since it was read; read it again`)
  const text = await readFile(path, 'utf8')
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`old_string must appear exactly once in "${path}", found ${count}`)
  await writeFile(path, text.replace(oldText, newText))
  seen.set(`${sessionId}:${path}`, await versionOf(path))
  return path
}
```

Trace the minute from the opening:

1. Read `app.ts`. The tool returns its text and stores version `v1`.
2. Save your own change in the editor. The file on disk now has version `v2`.
3. Edit `app.ts`. The stored `v1` does not match `v2`, so the tool throws before it writes.
4. Return an error result. The model reads that the file changed and calls `read` again.
5. Read again and edit. The versions now match, the old text appears once, and the edit goes in.

Each rule closes one gap. An edit with no earlier read fails, because the model would be changing text it never saw. An `old_string` that appears twice fails, because the tool cannot know which one the model meant. After a good edit, the tool stores the new version, so the next edit does not need another read.

A **stale edit** is a change based on an older copy of a file than the one now on disk.

> **Key idea:** File tools record a version for each file a session reads, and an edit or write over a changed file is refused.

## How dsh does it

The tools are in `packages/fs/tool-fs`: `read` (`src/read.ts`, line 78), `write` (`src/write.ts`, line 74) and `edit` (`src/edit.ts`, line 86). The `read` tool emits `fs/observed` with the file's version (line 163). Before a change, `edit` asks the `fs/edit-intent` waterfall for a version (line 133). `packages/fs/fs-observation-policy` answers it: an unseen file fails with `FS_NOT_OBSERVED` (line 91), and a seen file supplies its version. The filesystem service then checks that version at the moment of the write and reports `FS_STALE_VERSION` on a mismatch (`packages/fs/fs/src/index.ts`, line 292).

The `read` tool declares itself safe to run in parallel, and `write` and `edit` do not.

```inkling
title "The file packages in dsh"
layout flow
tool: box "tool-fs\nread, write, edit"
policy: box "fs-observation-policy\nversions seen" yellow
fs: box "fs\nctx.fs"
local: db "fs-local\nthe disk"
tool -> policy : "which version?"
tool -> fs : "edit at version"
fs -> local
circle policy
step 1: tool "The tool plugin owns the three model-facing tools"
step 2: policy "A separate plugin remembers what each session read"
step 3: fs, local "The filesystem service checks the version as it writes"
```

## What you have now

The model can now read and change files, and a change over a file it has not seen is refused. Many tasks need more than files: running tests, installing packages, calling git. How does the harness run a command for the model, and what does that command get to see?
