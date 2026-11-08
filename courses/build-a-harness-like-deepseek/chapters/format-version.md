# Format versions: changing the file layout without breaking old files

Resume reads a session file back and continues it. That works while every file has the layout the program expects. Now you change mini-dsh. A `tool/result` event will hold its content as a list of blocks, `[{ type: 'text', text: '42' }]`, instead of the plain string `'42'`. Then a result can later carry more than text.

Old session files still hold strings. The new program must read them correctly, and it must not damage them. How does a program read files that an older version of itself wrote?

## A recipe card

Think of a family recipe card written in cups and ounces. A cook who works in grams does not cross out the old card. She copies it onto a new card in grams and keeps the old one in the box. If she made an error while copying, the old card is still there to check. Each card says on top which units it uses, so nobody guesses.

The comparison differs in one way. The cook converts the whole card in one go. A program that is several layouts behind converts in small steps, one layout at a time.

## Versions in code

The header line already has `version: 1`. Each version also gets its own file name. `src/format.ts` holds the rules:

```ts
export const FORMAT_VERSION = 2
export const logName = (version: number) => `session.v${version}.jsonl`

type Migration = { from: number; to: number; event(e: SessionEvent): SessionEvent }

const migrations: Migration[] = [
  {
    from: 1, to: 2,
    event: (e) => e.type === 'tool/result' && typeof (e.data as any).content === 'string'
      ? { ...e, data: { ...(e.data as any), content: [{ type: 'text', text: (e.data as any).content }] } }
      : e,
  },
]

export function upgrade(version: number, events: SessionEvent[]): SessionEvent[] {
  if (version > FORMAT_VERSION) {
    throw new Error(`session format v${version} is newer than v${FORMAT_VERSION}: upgrade mini-dsh`)
  }
  for (let v = version; v < FORMAT_VERSION; v++) {
    const step = migrations.find(m => m.from === v)
    if (!step) throw new Error(`no migration from v${v} to v${v + 1}`)
    events = events.map(step.event)
  }
  return events
}
```

Follow version 2 of mini-dsh as it opens a session folder. The folder holds only `session.v1.jsonl`, with the 11 events of the notes.txt turn:

1. Find the file with the highest version. It is `session.v1.jsonl`, and its header says version 1.
2. Run `upgrade(1, events)`. The 1-to-2 step turns event 5's content from `'42'` into `[{ type: 'text', text: '42' }]`. The other 10 events pass through unchanged.
3. Write a new file, `session.v2.jsonl`, with a version 2 header and the 11 converted events.
4. Append all new events to `session.v2.jsonl` only. `session.v1.jsonl` keeps every byte it had.

If the folder held a `session.v3.jsonl`, `upgrade` would throw at once. A newer layout may mean things this program cannot know, so it asks for an upgrade instead of guessing.

Each step converts only to the next version. With five versions, you write four small steps, each one when its change is made. You do not write a converter for every pair of versions.

```inkling
title "Opening a session file"
layout down
open: box "Read the header version"
check: diamond "Compared with v2?"
older: box "Run each step\n1 to 2" yellow
same: box "Use it as it is" green
newer: box "Refuse: upgrade\nmini-dsh" red
write: icon file "Write session.v2.jsonl"
open -> check
check -> older : "older"
check -> same : "same"
check -> newer : "newer"
older -> write
step 1: open "Every file says which layout it uses"
step 2: check "Compare it with the program's own version"
step 3: older, write "An older file is converted into a new file"
step 4: same, newer "A current file is used and a newer one refused"
```

> **Key idea:** Each file layout has a version. Small steps convert one version to the next into a new file and never change the old file.

A **migration** is one step that converts events from one layout version to the next.

## How dsh does it

`SESSION_FORMAT_VERSION` is 4 in `packages/core/session/src/types.ts` (line 90). The file `packages/session/session-format/src/filename.ts` names version 0 `session.jsonl` and every later version `session.vN.jsonl` (lines 14-17). In `chain.ts`, a migration that does not go to exactly the next version throws an error (lines 29-31). The chain also refuses to build if any step is missing. `docs/subsystems/persistence.md` says that opening an old file leaves "every source path, byte, and inode unchanged". A log from a newer dsh gets a message that ends "upgrade the harness to open it" (`packages/session/session-persistence/src/errors.ts`, line 135).

```inkling
title "The dsh migration chain"
layout down
v0: icon file "session.jsonl (v0)"
a: box "session-format-v0-to-v1"
b: box "session-format-v1-to-v2"
c: box "session-format-v2-to-v3"
d: box "session-format-v3-to-v4"
v4: icon file "session.v4.jsonl" green
v0 -> a -> b -> c -> d -> v4
step 1: v0 "The oldest files have no version in their name"
step 2: a, b "Each package converts one version to the next"
step 3: c, d "Later steps, such as logging the system prompt as a message"
step 4: v4 "The result is written as a new version 4 file"
```

## What you have now

You have the whole session module. It has typed events, a rule that the model sees only what is logged, and a projection that builds every request. It also has a JSONL file flushed at the right moments, resume with closers and made-up results, and versions that keep old files readable. The next question is how a reply from DeepSeek arrives in small pieces and becomes the `assistant/message` the session stores.
