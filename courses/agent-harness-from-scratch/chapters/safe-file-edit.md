# Safe file edit: changing exact text after reading the file

The model wants to change one line in `src/config.ts`. The crude way is a write tool that replaces the whole file with whatever the model sends. That goes wrong in three ways. The model may rewrite the file from memory and silently drop lines it forgot. It may be working from a version it read ten minutes ago, before you changed the file in your editor. And if the program dies halfway through writing, the file is left cut in half. How do you let the model edit without any of these?

## Find and replace, with three guards

Think of correcting a printed contract by hand. You do not retype the contract. You find the exact sentence, strike it and write the new one. You only do that with the latest copy on the desk, and if the sentence appears twice you say which one. The picture stops holding at the last step: on paper a half-made correction is visible, while a file write must be all or nothing.

A safe file edit replaces one exact piece of text, only after the file has been read, and writes the result in one indivisible step. An atomic write means writing the new content to a temporary file and then renaming it over the original; a rename either happens completely or not at all, so a reader never sees a half-written file.

```ts
// src/edit.ts
import { readFile, writeFile, rename, stat } from 'node:fs/promises'

const seen = new Map<string, string>()   // path -> version when last read
const version = async (p: string) => { const s = await stat(p); return `${s.size}:${s.mtimeMs}` }

export async function readTool(path: string) {
  const text = await readFile(path, 'utf8')
  seen.set(path, await version(path))
  return text
}

export async function editTool({ path, old_string, new_string, replace_all = false }:
  { path: string; old_string: string; new_string: string; replace_all?: boolean }) {
  if (old_string === '' || old_string === new_string) throw new Error('old_string must be non-empty and differ from new_string')
  if (!seen.has(path)) throw new Error(`edit requires reading ${path} first`)
  if (seen.get(path) !== await version(path)) throw new Error(`${path} changed since it was read; re-read the file, then retry`)
  const raw = await readFile(path, 'utf8')
  const crlf = raw.includes('\r\n')
  const text = raw.replace(/\r\n/g, '\n')
  const count = text.split(old_string).length - 1
  if (count === 0) throw new Error('old_string not found; re-read the file, then retry')
  if (count > 1 && !replace_all) throw new Error(`old_string appears ${count} times; provide a more specific old_string or set replace_all`)
  let out = replace_all ? text.split(old_string).join(new_string) : text.replace(old_string, () => new_string)
  if (crlf) out = out.replace(/\n/g, '\r\n')
  await writeFile(`${path}.tmp`, out)
  await rename(`${path}.tmp`, path)
  seen.set(path, await version(path))
  return `edited ${path}: ${replace_all ? count : 1} replacement(s)`
}
```

Walk through the guards in order. An unread file is refused, so the model cannot edit from memory. A file whose size or modification time changed since the read is refused as stale, with a fix the model can follow. Line endings are made uniform for matching and restored afterwards, so a Windows-style file still matches. Zero matches is an error; two or more matches without `replace_all` is an error, because guessing which one is how the wrong line changes. The replacement uses a function so a `$` in the new text is not treated as a special pattern. Finally the temp file is renamed over the original, and the stored version is updated so the next edit does not need another read.

Trace it. `config.ts` holds `port = 3000` once and `retries = 3` twice. The model edits `port = 3000` to `port = 8080` without reading: refused. It reads, then edits: one match, replaced. It tries `retries = 3` to `retries = 5`: `old_string appears 2 times`. It resends with the surrounding line included, one match, done. Meanwhile you save the file in your editor; its next edit is refused as changed, and it re-reads.

> **Key idea:** A safe file edit replaces one exact, unique piece of text, only in a file the model has read and that has not changed since, and writes the result atomically through a temporary file and a rename.

**In DeepSeek Harness:** the edit tool is in `packages/fs/tool-fs/src/edit.ts`, with parameters `file_path`, `old_string`, `new_string` and `replace_all`. Line endings are normalized to LF for matching and restored on write; zero matches is `FS_EDIT_NOT_FOUND`, several without `replace_all` is `FS_AMBIGUOUS_EDIT`. Reading emits `fs/observed` with a version built from `dev:ino:size:mtimeNs:ctimeNs`; `packages/fs/fs-observation-policy` throws `FS_NOT_OBSERVED` for an unread file, and a per-file lock with a version comparison gives `FS_STALE_VERSION`. Writes go to a temp file and are renamed. Errors carry fixes such as "re-read the file, then retry", and the system prompt says "Read a file before editing it".

## What you have now

The tool system is complete: a registry, validation, a pipeline with hooks, approvals, safe concurrency, bounded results, and edits that cannot silently clobber a file. Each guard turns a mistake into a tool error result the model can fix. But every guard so far lives inside your program. A command run through the shell can still change any file the user can. What stops that?
