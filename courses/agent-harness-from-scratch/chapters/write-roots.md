# Write roots: the folders a fenced command may change

A sandbox in `workspace-write` mode lets a command change files in the working folder and nowhere else. But "the working folder" is not quite enough. A compiler writes scratch files to a temporary folder. A test runner may need a second project folder you configured. Allow too little and ordinary tools break. Allow too much and the fence means nothing. Which folders, exactly, should stay writable, and how do you check a path against them?

## A key card with a short list of rooms

Think of the key card again, this time with a printed list of rooms it opens: your office, the shared print room, the kitchen. The guard does not judge each visit. They read the room number and look for it on the list.

```inkling
title "Write roots and the check"
layout down
work: box "Working folder" yellow
extra: box "Extra folders"
tmp: box "/tmp"
otmp: box "os.tmpdir()"
roots: box "Real, resolved roots"
target: box "Target path"
rel: box "Relative path"
outside: box "Outside every root"
step 1: work, extra, tmp, otmp "The four kinds of folder that may stay writable"
step 2: roots "Each one is resolved to its real name"
step 3: target "The path someone wants to write"
step 4: rel "How to get from a root to the target"
step 5: outside "Climbing out with .. means refuse"
work -> roots : "resolve"
extra -> roots : "resolve"
tmp -> roots : "resolve"
otmp -> roots : "resolve"
roots -> target : "resolve the target"
target -> rel : "relative(root, target)"
rel -> outside : "starts with .. or is absolute"
circle rel
note roots "one real name per folder"
```

The picture stops holding at the room numbers. In a building every room has one number. On a computer one folder can have several names. On macOS, `/tmp` is a link to `/private/tmp`, so the same folder answers to both. The kernel compares the real, resolved name. A list written with the other spelling matches nothing.

## Building and checking the list

`minidsh` allows four kinds of folder: the session's working folder, any extra folders you configure, `/tmp`, and the user's own temporary folder that Node reports as `os.tmpdir()`. Add this to `src/sandbox.ts`:

```ts
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'

function real(p: string): string {
  try { return realpathSync.native(p) } catch { return p }
}

export function writableRoots(policy: SandboxPolicy, extra: string[] = []): string[] {
  if (policy.mode !== 'workspace-write') return []
  return [...new Set([real(policy.workspaceRoot), ...extra.map(real), real('/tmp'), real(tmpdir())])]
}

export function canWrite(path: string, roots: string[]): boolean {
  const target = join(real(dirname(path)), basename(path)) // the file may not exist yet
  return roots.some(root => {
    const rel = relative(root, target)
    return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
  })
}
```

Trace it on a Mac, with the session working in `/work/app`:

```text
roots = ['/work/app', '/private/tmp', '/var/folders/xy/T']   (last one shortened)

canWrite('/work/app/src/a.ts')       relative = 'src/a.ts'            -> true
canWrite('/work/app-secrets/key')    relative = '../app-secrets/key'  -> false
canWrite('/tmp/out.txt')             /tmp resolves to /private/tmp    -> true
```

The second line is the trap worth remembering. A plain text check, `'/work/app-secrets/key'.startsWith('/work/app')`, returns true. Asking how to get from the root to the target, and refusing any answer that starts by climbing out with `..`, gets it right. Under `read-only` the list is empty, so `canWrite` refuses everything.

```inkling
title "Two ways to test one path"
layout compare
columns "String check", "Relative check"
target: box "/work/app-secrets/key"
row "Test": "startsWith('/work/app')", "relative(root, target)"
row "Result": "true (wrong)", "false (right)"
row "Sibling folder": "allowed by mistake", "refused"
circle relative-check
step 1: target "One sibling folder, outside the root"
step 2: string-check "String check says it is inside"
step 3: relative-check "Relative check says it is outside"
```

## Fence the file tools too

The kernel fence applies to commands your harness starts as separate programs. Your write and edit tools are different: they run inside the harness's own Node process, which is not fenced. Without a check, the model could be refused by the shell and then write the same file with the write tool. So the file tools call `canWrite` with the same list before every change. One function feeds both, so the two can never disagree.

> **Key idea:** Write roots are the short list of real, resolved folders a fenced command may still change; every write, from a command or a file tool, is checked against the same list.

**In DeepSeek Harness:** `writableRoots` in `packages/sandbox/sandbox/src/roots.ts` returns the workspace root, `additionalWritableRoots`, `/tmp` and `os.tmpdir()`, each resolved with `realpathSync.native`. An extra folder that is missing, not a directory, or reached through a symlink is rejected with `SANDBOX_INVALID_ROOT`. The macOS profile and the in-process file fence in `packages/fs/fs-sandbox` both read this one helper, which fails with `FS_SANDBOX_DENIED`, so that "the write tool cannot write /tmp but bash can" asymmetries cannot arise. The Linux backends spell temp access their own way, for example a fresh empty `/tmp`.

## What you have now

You have the list of writable folders and a check that resolves real paths and refuses anything outside, shared by commands and file tools. This builds on the sandbox modes and on safe file edits. The open question is enforcement: how do you hand this list to the operating system so the kernel itself refuses the write?
