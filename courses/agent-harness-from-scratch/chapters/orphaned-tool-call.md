# Orphaned tool call: a request that never got its result

Session resume closes an unfinished turn with interrupted markers. That was enough when the crash came after the tool result was logged. Now take a worse moment. The model asked for two tools. Your program recorded the request, started the first tool, and the process was killed. The log holds an assistant message with two tool calls and no tool result for either. What happens on the next request?

It fails. Providers reject a history in which a tool call has no tool result with the same id. Closing the turn does not help, because derived history still contains that assistant message. Without a fix, this session can never talk to the model again.

## A result written by your program, saying what is known

Picture a restaurant whose kitchen loses power during service. On reopening, the manager goes through the order pad, and every ticket must end with a note. A ticket that reached the kitchen gets "may or may not have been cooked; check before making it again". A ticket that never left the pad gets "never started; make it if the guest still wants it".

A tool call with no recorded result is an **orphaned tool call**. The fix is to append a **synthetic** result for each one: a tool result your program writes itself, marked as an error, whose text tells the model honestly what is known. The shape is the one the tool error result taught: a result for the call's id, flagged as a failure. The events from the session event lesson tell you which of the two notes to write:

- An assistant message lists the call, and a `tool/call` event was recorded. The tool started, so its outcome is unknown. It may have deleted the file, or it may not.
- An assistant message lists the call, but no `tool/call` was recorded. The tool never started, so running it again is safe.

## Walking through the crash

```text
1  turn/start         { turn: 1 }
2  step/start         { turn: 1, step: 1 }
3  user/message       Delete old.log, then list the folder.
4  assistant/message  call_1 delete_file {"path":"old.log"}, call_2 list_files {}
5  tool/call          call_1 delete_file          <- process killed here
```

Pending after the walk: `call_1` (started) and `call_2` (not started). Resume now appends, in the order the model asked:

```text
6  tool/result  call_1  error: started, outcome unknown
7  tool/result  call_2  error: never started
8  step/end     { turn: 1, step: 1 }
9  turn/end     { turn: 1, reason: 'interrupted' }
```

The results go before `step/end`, because each result belongs to the step that asked for it. Extend the walk in `closeOpenTurn` to collect them:

```ts
const UNKNOWN = 'Interrupted after the tool started; its outcome is unknown. ' +
  'Run it again only if it is read-only or idempotent; otherwise check first or ask the user.'
const NOT_STARTED = 'Interrupted before the tool started. Run it again if it is still needed.'

// during the walk, inside the open step:
//   assistant/message -> pending.set(call.id, { started: false })  for each tool call
//   tool/call         -> pending.get(callId).started = true
//   tool/result       -> pending.delete(toolCallId)
//   step/end, turn/start, turn/end -> pending.clear()
for (const [id, { started }] of pending) {
  closers.push({ seq: ++seq, time: last.time, type: 'tool/result', data: {
    message: { role: 'tool', toolCallId: id, content: started ? UNKNOWN : NOT_STARTED },
    error: true,
  } })
}
```

**Idempotent** means running it twice has the same effect as running it once. Listing a folder is idempotent; sending an email is not. The model knows its tools better than your recovery code does, so the wording leaves the decision to it.

The restaurant picture stops holding at one point: the manager can walk into the kitchen and look. Your program cannot see what a killed tool did, so the honest answer for a started call is "unknown", never a guess.

> **Key idea:** An orphaned tool call is a tool request in the log with no recorded result; before the model is asked again, your program appends a synthetic error result for it, saying whether the tool had started, so the history is valid and the model can decide what to run again.

**In DeepSeek Harness:** `ToolCallRecovery` in `packages/core/session/src/repair.ts` does exactly this, with two error codes: `TOOL_OUTCOME_UNKNOWN` when a `tool/call` was recorded and `TOOL_NOT_STARTED` otherwise. A comment there gives the reason for closing calls before their step: "providers reject dangling assistant calls". The model-visible text for an unknown outcome tells it to repeat the call "only if the operation is read-only or idempotent". The same recovery runs when a live step fails, and when a session is copied from a point in the middle of a turn.

## What you have now

With orphaned calls answered, the event log can be cut at any point by a crash and still produce a history the provider accepts. Resume, interrupted markers and synthetic error results together make a killed session safe to continue. The next question moves to the other side of the request: the reply streams in as provider-specific pieces, and the code reading them is tied to DeepSeek's format. How do you describe those pieces in a form any provider can be translated into?
