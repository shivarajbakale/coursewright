# Session resume: continuing after the program stops

JSONL storage keeps every flushed event on disk. Suppose the program dies while it waits for the model in step 2 of turn 1. The file ends with a `step/start` and has no `step/end` or `turn/end`. When you start the program again with the same session, it must read the file, rebuild the session and carry on. But the record says a turn is open, and no program runs it. What should the new program do with that open turn?

## A night shift taking over

Think of a hospital night shift. The day nurse goes home sick in the middle of a task. The night nurse reads the chart, which shows "dressing change started" and nothing after it. She does not tear the page out, because the start happened. She writes a new line: "task interrupted at shift change". Then she starts her own work below it.

The comparison differs in one way. The night nurse can walk to the patient and look. The program has only the file, so the line it writes must say plainly that it does not know how the task ended.

The program does the same. It keeps every stored event and appends new events that close what was left open.

## Reading the file and closing the turn

`src/store.ts` reads the file back. `Session` now also takes the stored events, as a seed, in its constructor, and does not send them to `onAppend` again.

```ts
export async function loadEvents(path: string) {
  const lines = (await readFile(path, 'utf8')).split('\n')
  const header = JSON.parse(lines[0])
  const events: SessionEvent[] = []
  for (const line of lines.slice(1)) {
    if (line === '') continue
    try {
      events.push(JSON.parse(line))
    } catch (error) {
      if (line === lines.at(-1)) break // a cut-off last line from a crash
      throw error
    }
  }
  return { header, events }
}

export function closersFor(events: readonly SessionEvent[]) {
  let openTurn: number | null = null
  let openStep: number | null = null
  for (const e of events) {
    const d = e.data as any
    if (e.type === 'turn/start') { openTurn = d.turn; openStep = null }
    if (e.type === 'turn/end') { openTurn = null; openStep = null }
    if (e.type === 'step/start') openStep = d.step
    if (e.type === 'step/end') openStep = null
  }
  const closers: { type: EventType; data: unknown }[] = []
  if (openTurn === null) return closers
  if (openStep !== null) closers.push({ type: 'step/end', data: { turn: openTurn, step: openStep } })
  closers.push({ type: 'turn/end', data: { turn: openTurn, reason: 'interrupted' } })
  return closers
}
```

A cut-off line can only be the last one, because each flush adds whole lines at the end. A bad line anywhere else means the file is damaged, so `loadEvents` throws. When it drops a cut-off line, the store writes the file again without it before the next flush.

Follow the crash above. The file holds a header and events 0 to 8; event 8 is the `step/start` of step 2.

1. Read the 9 events into a new `Session` as its seed.
2. Run `closersFor`. Turn 1 and step 2 are open, so it returns two closers.
3. Append them. `step/end` gets seq 9, and `turn/end` with reason `interrupted` gets seq 10.
4. Flush, so the closers are on disk before any new work.
5. Send the next prompt as turn 2, starting at seq 11.

`messagesFrom` still gives the question, the assistant's `tool_use` and the tool result from turn 1. The new user message joins the tool result into one user message. The model sees what was done before the crash, and the request is valid.

The loop itself never writes `interrupted`. Because of this, a reader who finds that reason knows that a crash ended the turn.

```inkling
title "Resume in four moves"
layout down
read: box "Read the file"
check: diamond "Turn left open?"
close: box "Append closers\nseq 9 and 10" yellow
go: box "Start turn 2\nat seq 11" green
read -> check
check -> close : "yes"
check -> go : "no"
close -> go
step 1: read "Read every complete line back into a session"
step 2: check "Look for a turn/start with no turn/end"
step 3: close "Close the open step and turn with new events"
step 4: go "Continue with the next turn"
```

> **Key idea:** Resume reads the stored events back and appends closers for any turn left open, never deleting what was stored.

A **closer** is an event the program appends after the fact to end a step or turn that the record left open.

## How dsh does it

Resume lives in `packages/core/agent-loop/src/index.ts`. It opens the session for writing first (line 788), so a second program cannot resume the same session at the same moment. It reads every stored event (line 797), computes `interruptedTurnClosers` (line 800) and appends them as one batch (line 801). `openTurnClosers` in `packages/core/session/src/repair.ts` (line 53) builds them. It gives each closer the last real event's time instead of inventing a new one. `docs/subsystems/persistence.md` explains why storage keeps the open turn: one long turn can hold a great deal of real work.

## What you have now

A stopped program can now continue: the stored events come back, and closers balance the open turn. The crash above happened while the program waited for the model. If it happened while a tool ran, the record would hold a `tool_use` with no `tool_result`. Can the model's next request contain that?
