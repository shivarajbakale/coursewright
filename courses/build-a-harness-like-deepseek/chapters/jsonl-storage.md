# JSONL storage: one JSON event per line in a file

Every request can now be rebuilt from the session, but the session lives in memory. If the program stops, every event is gone. You could write the whole event list to a file after each change. But a session can hold thousands of events. A crash during the write can leave a half-written file with nothing usable in it. How do you store an append-only record so that adding an event is cheap and a crash damages as little as possible?

## A paper logbook

Think of a ship's logbook. The officer writes one entry per line, at the bottom, in ink. To add an entry, nobody copies the book out again. If the ship rolls while the officer writes, only the last line is smudged, and every line above it is still readable.

The comparison differs in one way. An officer writes each line the moment something happens. The program collects new lines in memory and writes them to the file in groups at chosen moments.

The file format that matches this is **JSONL**, short for JSON Lines: a text file where each line is one complete JSON value.

```inkling
title "One session file"
steps auto
layout stack
- Header: version 1, id, createdAt
- Event seq 0: turn/start
- Event seq 1: step/start
- Event seq 2: system/message
- More events, one per line
brace event-seq-0-turn-start..more-events-one-per-line "one event per line"
```

## The file in code

The first line is a header that describes the file. Each later line is one event, exactly as `append` stored it. Here is the start of one file:

```text
{"type":"session","version":1,"id":"s1","createdAt":1767225600000}
{"type":"turn/start","seq":0,"time":1767225600010,"data":{"turn":1}}
{"type":"step/start","seq":1,"time":1767225600011,"data":{"turn":1,"step":1}}
```

`src/store.ts` writes it. `Session` takes an optional `onAppend` function in its constructor and calls it with each new event, so the store sees every event.

```ts
import { open, writeFile } from 'node:fs/promises'

export class SessionFile {
  private pending: SessionEvent[] = []
  constructor(private readonly path: string) {}

  static async create(path: string, id: string): Promise<SessionFile> {
    const header = { type: 'session', version: 1, id, createdAt: Date.now() }
    await writeFile(path, JSON.stringify(header) + '\n', { flag: 'wx' })
    return new SessionFile(path)
  }

  add(event: SessionEvent): void {
    this.pending.push(event)
  }

  async flush(): Promise<void> {
    if (this.pending.length === 0) return
    const batch = this.pending
    const file = await open(this.path, 'a')
    try {
      await file.appendFile(batch.map(e => JSON.stringify(e) + '\n').join(''))
      await file.sync()
    } finally {
      await file.close()
    }
    this.pending = this.pending.slice(batch.length)
  }
}
```

The `'wx'` flag makes `create` fail if the file exists, so it never overwrites an old session. The call `file.sync()` asks the operating system to put the bytes on the disk, not only in its memory. A batch leaves `pending` only after the write succeeds.

The loop calls `await store.flush()` at two places in `runStep`:

1. Flush before each model call. A model call takes seconds, and the request it sends must be on disk if the program dies during it.
2. Flush before each tool runs. A tool can change files, so the `tool/call` event must be on disk before the change starts.

A crash between flushes loses only the events after the last flush. A crash during a flush can leave a half-written last line. Every line above it is still complete JSON.

> **Key idea:** JSONL storage writes a header line, then one JSON event per line, and flushes new lines before each model call and tool run.

To **flush** means to write the events waiting in memory to the file and wait until the disk holds them.

## How dsh does it

The JSONL format lives in `packages/session/session-persistence-jsonl`, which provides the storage service that `packages/session/session-persistence` defines. In `src/format.ts`, `HeaderLine` (line 83) is the first line, with `type: 'session'`, `version`, `id` and `createdAt`. `eventLine` (line 322) writes one event as one row. By default the rows are compressed with Zstandard into a `.jsonl.zstd` file (`src/index.ts`, line 69). The package `packages/session/session-checkpoint-policy` decides when to flush: before a model stream starts, before a tool runs, and before each step (`src/index.ts`, lines 64-82).

```inkling
title "How dsh stores a session"
layout flow
session: db "dsh-session\nevents in memory"
store: box "session-persistence-jsonl" yellow
policy: box "session-checkpoint-policy"
file: icon file "session file\n.jsonl.zstd"
session -> store : "each new event"
policy -> store : "flush before model call and tool"
store -> file : "one row per event"
step 1: session, store "Each new event goes to the storage package"
step 2: policy "A separate package decides when to flush"
step 3: file "Flushed rows reach the file on disk"
```

## What you have now

The session now survives a stopped program: a header line, then one event per line, flushed at the moments that matter. A file that ends in the middle of a turn holds a `turn/start` with no `turn/end`. What must the program do when it reads that file back and wants to continue?
