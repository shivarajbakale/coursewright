# Session resume: continuing a conversation after a restart

The event log is now a JSONL file that survives the process. Tomorrow you run `minidsh` again with the same file and type a new question. The new run should know everything said before, number its events after the old ones, and cope with the case where the last run died halfway through a turn. What does the program have to do when it opens an existing file?

## The clean case: read, derive, carry on

Because the model is a stateless model, there is no hidden state to restore. Everything it saw was rebuilt from the log by derived history, so the same log rebuilds the same messages. Resuming is three small things:

```ts
// src/session.ts
export function openSession(path: string): Session {
  const events = fs.existsSync(path) ? loadEvents(path) : []
  const session = new Session(path, events)       // nextSeq = last seq + 1
  appendBatch(path, closeOpenTurn(events))         // empty when the last turn finished
  return session
}
```

Load the events. Continue numbering from the last `seq`, and the next turn number from the last `turn/start`. Derive messages from all of it on the next step, as always. If the file ends with `turn/end`, that is the whole job: the next question becomes turn 2, and the model receives turn 1's messages in front of it.

## The crash case: close the turn the old run left open

Think of a club whose meeting is cut short by a power cut. At the next meeting, the secretary does not go back and rewrite the old minutes to look finished. They add a line: "the previous meeting ended without a close at item 4". The record stays honest, and the new meeting starts from a clean point.

Here is a log that ends mid-turn. The old run got a tool result, started step 2, and was killed while the model was replying:

```text
1  turn/start         { turn: 1 }
2  step/start         { turn: 1, step: 1 }
3  user/message       How many lines in notes.txt?
4  assistant/message  (tool call call_1: count_lines)
5  tool/call          call_1
6  tool/result        42 (for call_1)
7  step/end           { turn: 1, step: 1 }
8  step/start         { turn: 1, step: 2 }
```

Turn 1 has a start and no end. Step 2 has a start and no end. If you start turn 2 on top of this, every later reader sees a turn inside a turn. So before anything else, append the missing ends, newest structure first:

```text
9   step/end   { turn: 1, step: 2 }
10  turn/end   { turn: 1, reason: 'interrupted' }
```

The `reason` records honestly that this turn did not finish normally. `closeOpenTurn` finds the open turn and step by walking the events once:

```ts
export function closeOpenTurn(events: SessionEvent[]): SessionEvent[] {
  let turn: number | null = null, step: number | null = null
  for (const e of events) {
    const d = e.data as { turn: number; step: number }
    if (e.type === 'turn/start') { turn = d.turn; step = null }
    if (e.type === 'step/start') step = d.step
    if (e.type === 'step/end') step = null
    if (e.type === 'turn/end') { turn = null; step = null }
  }
  const last = events.at(-1)
  if (turn === null || !last) return []
  let seq = last.seq
  const closers: SessionEvent[] = []
  if (step !== null) closers.push({ seq: ++seq, time: last.time, type: 'step/end', data: { turn, step } })
  closers.push({ seq: ++seq, time: last.time, type: 'turn/end', data: { turn, reason: 'interrupted' } })
  return closers
}
```

The closers reuse the last real event's `time`. They record when the old run stopped, not when you noticed.

The meeting picture stops holding here: a secretary can say a word about what was lost, but your closers can only state facts. The model's half-finished reply in step 2 was never logged, so it is gone, and the derived messages end with the tool result `42`. When you type "please continue" as turn 2, the model sees the question, its own tool call, the result and your new message, and answers from there.

> **Key idea:** Session resume means loading the event log from its file, continuing its numbering, and, if the last turn never ended, appending closing events marked interrupted before any new work, so history is rebuilt exactly and never rewritten.

**In DeepSeek Harness:** resume opens the log for writing, reads it, and appends interrupted-turn closers for a mid-turn crash. The closers come from `openTurnClosers` in `packages/core/session/src/repair.ts`, which closes an open step before its turn, ends the turn with reason `interrupted`, continues the sequence numbers and reuses the last real timestamp. The first model request after resuming logs a `request/header` event with reason `resume`.

## What you have now

`minidsh` can stop at any moment and pick up later: the JSONL file is loaded, an unfinished turn is closed with interrupted markers, and derived history rebuilds the conversation for the next request. This example crashed at a convenient moment, after the tool result was logged. What if the crash came after the model asked for a tool but before its result was recorded?
