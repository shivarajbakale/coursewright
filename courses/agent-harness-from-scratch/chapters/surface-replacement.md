# Surface replacement: hiding summarized events without deleting them

Compaction gave you a shorter history, but you built it by cutting a list of messages. In `minidsh` that list is not stored anywhere. It is derived from the event log every step, and the log only grows. Deleting 56 old events would break the rule that a recorded fact never changes. It would also throw away the full transcript you may need for debugging. How can the model see the summary while the log keeps everything?

## The archive and the exhibition wall

A museum keeps every object in its archive. The exhibition wall shows a selection. When a section of the wall gets crowded, the curator puts up one placard summarizing thirty objects. The objects are still in the archive, and anyone with access can look them up.

Here the archive is the event log and the wall is the surface: the ordered list of model-visible events that derived history turns into messages. The picture stops holding in one way. A curator physically takes objects down. Nothing moves in `minidsh`. The wall is rebuilt from the archive on every step, and the archive itself contains the instruction "show this placard in place of those objects."

## A replace instruction inside the log

Each message event can carry a `surfaceOp` in its data. Most say, in effect, "add me at the end". The summary says "put me in place of the events from `startSeq` to `endSeq`":

```ts
// src/session.ts
type SurfaceOp = { op: 'append' } | { op: 'replace'; startSeq: number; endSeq: number }
const MESSAGE_TYPES = new Set(['system/message', 'user/message', 'assistant/message', 'tool/result'])

export function deriveSurface(events: SessionEvent[]): SessionEvent[] {
  let surface: SessionEvent[] = []
  for (const e of events) {
    if (!MESSAGE_TYPES.has(e.type)) continue // turn markers, compaction records: never shown
    const op = (e.data as { surfaceOp?: SurfaceOp }).surfaceOp
    if (op?.op === 'replace') {
      const i = surface.findIndex(x => x.seq === op.startSeq)
      const j = surface.findIndex(x => x.seq === op.endSeq)
      if (i < 0 || j < i) throw new Error(`bad replace ${op.startSeq}..${op.endSeq}`)
      surface = [...surface.slice(0, i), e, ...surface.slice(j + 1)]
    } else surface.push(e)
  }
  return surface
}
```

Your derived history now maps `deriveSurface(events)` to messages instead of mapping every event. Notice the range is found by position on the current surface, not by counting numbers. After an earlier replace, some sequence numbers inside a range are already hidden, and that is fine.

Compaction writes four events, in this order:

```text
seq 72  compaction/start     a lock: compaction is in progress
seq 73  compaction/summary   { summary, startSeq: 2, endSeq: 57, tokens: 80,500, model }
seq 74  user/message         { content: checkpoint, surfaceOp: { op: 'replace', startSeq: 2, endSeq: 57 } }
seq 75  compaction/end       the lock is released

surface before: 0, 1, 2 ... 57, 58 ... 71
surface after:  0, 1, 74, 58 ... 71
```

Walk through it. Seqs 0 and 1 are the system prompt and project instructions. The summary at seq 74 takes the place of 2 through 57, so it sits right after the instructions and before the newest messages. The two `compaction/*` records and the lock are not message types, so the model never sees them, but they record what was summarized, by which model, and how big it was.

The order protects you from crashes. If the process dies after seq 72, the log holds a start with no end. On resume you can see that compaction never finished, instead of trusting a half-done one.

> **Key idea:** Surface replacement records a summary as a new message carrying a replace instruction, so derived history shows the summary in place of a range of older events while the log keeps every one of them.

**In DeepSeek Harness:** `docs/subsystems/compaction.md` describes the same three log-only events, `compaction/start`, `compaction/summary` and `compaction/end`. The summary rides on a `user/message` with `surfaceOp: { op: 'replace', startSeq, endSeq }`, "the only surface mutation performed by summary compaction." Every surface event must carry a `surfaceOp` (`docs/subsystems/session.md`). Releasing the lock last "turns a crash mid-operation into a detectable orphaned lock."

## What you have now

You can keep long sessions inside the window without breaking the event log: the log stays complete and the surface shows the summary. This joins compaction to the event log, derived history and session resume. Next, a different way to save context: how can the model have many long instruction files available while paying only for the ones it uses?
