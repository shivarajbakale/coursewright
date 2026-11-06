# JSONL file: a file with one JSON record per line

Your event log lives in memory. When the process exits or crashes, the whole conversation is gone. You need to write it to disk. The obvious way is `JSON.stringify(events)` into one file after every event. But that rewrites the entire file each time, and if the process dies halfway through a write, you are left with a file that is not valid JSON at all. One crash, and every earlier event is unreadable.

## One line per event, written in ink

Picture a paper logbook kept in pen. You write one entry per line and never go back. If someone knocks your arm while you write, only the line you were writing is spoiled. Every line above it is finished and safe.

A **JSONL file** (JSON Lines) is that logbook. Each line holds one complete JSON value, followed by a newline. Adding an event means adding bytes to the end of the file. Nothing already written is touched. `minidsh` starts the file with a header line naming the format and its version, so a future `minidsh` that changes the format can tell old files apart:

```text
{"type":"session","version":1}
{"seq":1,"time":"2026-11-06T10:00:00.000Z","type":"turn/start","data":{"turn":1}}
{"seq":2,"time":"2026-11-06T10:00:00.001Z","type":"step/start","data":{"turn":1,"step":1}}
```

The pen picture stops holding in one important way. When your program writes to a file, the operating system usually keeps the bytes in memory for a while and puts them on the disk later. If the power goes, "written" bytes that were still in memory are lost. To be sure, you call **fsync**: a system call that returns only once the file's data is on the disk. It is slow, often a few milliseconds, so you do not want one per event. Instead you write a **batch**: all the events produced together, such as a step's tool results, in one write followed by one fsync.

```ts
// src/session.ts
import fs from 'node:fs'

export function appendBatch(path: string, events: SessionEvent[]): void {
  const text = events.map(e => JSON.stringify(e) + '\n').join('')
  const fd = fs.openSync(path, 'a')        // 'a' = append to the end
  try {
    fs.writeSync(fd, text)
    fs.fsyncSync(fd)                        // on disk before we return
  } finally {
    fs.closeSync(fd)
  }
}
```

## Reading back a file with a torn last line

Every line ends with `\n`, and a line and its newline go out in one write. So if a crash cuts a write short, the damage can only be at the very end: some bytes after the last newline. That is the **torn tail**. When loading, trust everything up to the last newline and drop what follows:

```ts
export function loadEvents(path: string): SessionEvent[] {
  const text = fs.readFileSync(path, 'utf8')
  const complete = text.slice(0, text.lastIndexOf('\n') + 1)
  if (complete.length < text.length) fs.truncateSync(path, Buffer.byteLength(complete))
  const [header, ...rows] = complete.split('\n').filter(line => line !== '')
  if (JSON.parse(header).version !== 1) throw new Error('unknown session format')
  return rows.map(line => JSON.parse(line))
}
```

Walk through a crash. The file holds a header and events 1 to 7, each with its newline. The program is writing event 8 and dies after 30 bytes: `{"seq":8,"time":"2026-11-06T1`. There is no newline after it. `loadEvents` keeps the header and events 1 to 7, and truncates the file back to the end of line 7. The truncate matters: without it, the next append would be glued onto the broken bytes, and that line would never parse. A line in the middle that fails to parse is different. That is real damage, and `JSON.parse` throws rather than guessing.

Dropping event 8 loses nothing that was promised: its batch never finished its fsync, so no one was told it was saved.

> **Key idea:** A JSONL file stores the event log as one JSON event per line, appended in batches that are each made durable with fsync, so a crash can only damage the unfinished last line, which loading drops.

**In DeepSeek Harness:** `packages/session/session-persistence-jsonl` stores sessions this way. The first line is a `{type:'session'}` header, then one row per event. Files are named `session.vN.jsonl`, and by default they are compressed with zstd, one compressed frame per append batch. Each batch is fsynced, committed events are never rewritten, and a torn final piece is cut off before the next append (`truncateTornTail` in `src/storage.ts`). The current format version is 4. Upgrades are a chain of small packages such as `packages/session/session-format-v3-to-v4`, each converting one version to the next.

## What you have now

The event log now survives the process: each batch of session events is a few lines appended to a file and forced to disk, and a crash costs at most one unfinished line. Having the file is only half the job. When `minidsh` starts again, how does it pick up the conversation where it stopped?
