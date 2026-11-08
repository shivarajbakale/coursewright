# Orphaned tool call: a request that never got its answer

Session resume closes an open step and turn. Now suppose the program dies while a tool runs. The assistant message holds a `tool_use` block for `call_2`, and no `tool/result` for it exists. Resume adds `step/end` and `turn/end`, and the next request then holds a `tool_use` with no matching `tool_result`. DeepSeek refuses that request: every tool call in an assistant message needs its result in the next user message. The session is balanced, but the model can no longer be called.

## A parcel with no final status

Think of a parcel service. Every parcel must end with one final status, such as "delivered" or "returned", before the day's report can close. One van stops with a fault, and a parcel is marked "out for delivery" with nothing after it. The office does not leave it open, and it does not invent "delivered". It writes "status unknown: check with the recipient".

The comparison differs in one way. The office can phone the recipient. The program cannot see what the tool did, so it gives that question to the model in the result text.

## Writing the missing results

A new function in `src/store.ts` finds calls with no result. `closersFor` calls it first and puts its results before the `step/end` closer.

```ts
function missingResults(events: readonly SessionEvent[]) {
  const pending = new Map<string, { turn: number; step: number; started: boolean }>()
  for (const e of events) {
    const d = e.data as any
    if (e.type === 'assistant/message') {
      for (const b of d.content) {
        if (b.type === 'tool_use') pending.set(b.id, { turn: d.turn, step: d.step, started: false })
      }
    }
    if (e.type === 'tool/call' && pending.has(d.callId)) pending.get(d.callId)!.started = true
    if (e.type === 'tool/result') pending.delete(d.callId)
    if (e.type === 'step/end' || e.type === 'turn/end') pending.clear()
  }
  return [...pending].map(([callId, p]) => ({
    type: 'tool/result' as const,
    data: {
      turn: p.turn, step: p.step, callId, isError: true,
      content: p.started
        ? 'The tool call was interrupted after it started. Its outcome is unknown. Check the result before you retry it.'
        : 'The tool call was interrupted before it started. Retry it if it is still needed.',
    },
  }))
}
```

Follow one crash. The model asked to read `notes.txt` and then to write it.

1. Read events 0 to 7 from the file. Event 4 is the assistant message with `call_1` (read) and `call_2` (write).
2. Match the calls. Events 5 and 6 are the `tool/call` and `tool/result` of `call_1`. Event 7 is the `tool/call` of `call_2`, and no result follows it.
3. Append an error `tool/result` for `call_2` at seq 8. Its call was recorded, so its text says the outcome is unknown.
4. Append `step/end` at seq 9 and `turn/end` with reason `interrupted` at seq 10.

Now every `tool_use` has a `tool_result`, so the next request is valid. The model reads that the write may or may not have taken place. It can read `notes.txt` before it writes again.

The two texts depend on the flush before each tool from JSONL storage. A `tool/call` on disk shows the tool may have run. Suppose the crash came before event 7 was flushed. Then `call_2` has no `tool/call`, so the tool never started and a retry is safe.

```inkling
title "Two kinds of missing result"
steps auto
layout compare
columns "tool/call recorded", "No tool/call"
row "Did the tool start": "maybe", no
row "Result text says": "outcome unknown", "not started"
row "Safe to retry at once": no, yes!
```

> **Key idea:** An orphaned tool call gets a made-up error result before its step closes, saying whether the tool started, so every call is answered.

An **orphaned tool call** is a tool call in the session that has no result. The result the program writes for it is marked as an error, because the tool never reported success.

## How dsh does it

`ToolCallRecovery` in `packages/core/session/src/repair.ts` (line 105) tracks unanswered calls. Its results use the codes `TOOL_OUTCOME_UNKNOWN` when a `tool/call` was recorded and `TOOL_NOT_STARTED` when none was (lines 15 and 18). A comment at line 164 gives the reason they come before the step closes: "providers reject dangling assistant calls". The DeepSeek adapter refuses such a request itself with "tool calls need immediate results" (`packages/llm/llm-deepseek/src/serialize.ts`, line 142). The loop in `packages/core/agent-loop/src/agent.ts` uses the same class when a step fails without a crash (lines 363-381).

## What you have now

Resume now leaves a session the model can always continue: open turns are closed and every tool call has a result. All of this assumes the file has the same layout that the program expects. When a later version of mini-dsh changes how events are stored, how does it read the files that older versions wrote?
