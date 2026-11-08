# Cancellation: stopping a turn part way through

With retry and backoff, a failed request waits and tries again. A long reply or a wait of 8 seconds can still be unwanted. The user sees the model go the wrong way and presses Ctrl+C. If the program kills itself, the record ends in the middle of a turn, and the text that already arrived is lost. How does the program stop a request cleanly and keep what it can?

## Stopping a delivery van

Think of a shop that sends out a van with a delivery. Halfway along the route the customer calls and cancels. The shop radios the driver, who stops and drives back. The parcels the customer already received stay with the customer. The parcel that was still in the van is not left at the door half unpacked. The shop writes "cancelled by the customer" on the order.

Here the van is the model request, and the radio call is the stop signal. The delivered parcels are the text that already streamed, and the order note is the turn's end reason. The picture differs in one way. A driver hears the radio at once, but the program checks for the signal only between pieces and inside waits.

## One signal for everything

JavaScript has a standard pair for this. An `AbortController` has an `abort()` method. Its **AbortSignal**, `controller.signal`, is an object that every part of the work can check. `fetch` accepts it and closes the connection when it fires. **Cancellation** means to stop a turn through this signal, so that each part ends cleanly.

mini-dsh makes one controller per turn in `src/loop.ts`, and Ctrl+C calls `abort()`:

```ts
const controller = new AbortController()
process.once('SIGINT', () => controller.abort())
const request = { provider: 'deepseek', model: 'deepseek-flash', messages, tools, signal: controller.signal }
```

`GenerateOptions` gains `signal?: AbortSignal`, and the DeepSeek adapter passes it to `fetch`. The shared `stream` function now names the failure by the signal: `kind: options.signal?.aborted ? 'aborted' : 'error'`.

The assembler gains one method. It keeps only text and reasoning with real content:

```ts
interruptedBlocks(): ContentBlock[] {
  return this.order.map(i => this.assemble(this.partials.get(i)!))
    .filter(b => (b.type === 'text' || b.type === 'reasoning') && b.text.trim() !== '')
}
```

After the stream, the loop handles an aborted finish:

```ts
if (asm.finish.kind === 'aborted') {
  const kept = asm.interruptedBlocks()
  if (kept.length > 0) session.append('assistant/message', { content: kept, interrupted: true })
  else session.append('assistant/attempt', { failure: asm.finish.failure })
  session.append('turn/end', { turn, reason: { kind: 'aborted' } })
  return
}
```

The retry wait listens to the same signal, so Ctrl+C during a wait ends it and no retry starts:

```ts
function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  return new Promise(resolve => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(true) }, ms)
    function onAbort() { clearTimeout(timer); resolve(false) }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
```

```inkling
title "What a stopped stream keeps"
layout down
stop: box "Ctrl+C: abort()"
close: box "fetch closes the stream"
fin: box "finish: aborted"
any: diamond "Text arrived?"
msg: box "assistant/message, interrupted"
att: box "assistant/attempt"
end: box "turn/end: aborted" green
stop -> close -> fin -> any
any -> msg : "yes"
any -> att : "no"
msg -> end
att -> end
step 1: stop, close "One signal closes the connection"
step 2: fin, any "The stream ends with an aborted finish"
step 3: msg, att "Real text is kept; otherwise only the attempt"
step 4: end "The turn always ends with a reason"
```

Trace one stop:

1. Ask for a summary of notes.txt. The text "The file has three parts:" streams, and a tool call to `count_lines` starts.
2. Press Ctrl+C. `abort()` fires, `fetch` closes the connection, and the shared `stream` yields `finish` with kind `aborted`.
3. Keep the text. `interruptedBlocks()` returns the text block and drops the half-written tool call.
4. Write the record. An `assistant/message` with `interrupted: true` holds the text, and `turn/end` says `aborted`.

The tool call is dropped for a reason. It never ran. Keeping it would need a tool result that the program would have to make up.

> **Key idea:** Cancellation fires one AbortSignal that stops the stream and any wait; text that arrived is kept, and the turn ends as aborted.

## How dsh does it

```inkling
title "A cancel in dsh"
layout sequence
user: person "User"
loop: box "agent-loop"
ds: box "llm-deepseek"
log: db "Session record"
user -> loop : "cancel(cause)"
loop -> ds : "abort the signal"
ds --> loop : "finish: aborted"
loop -> log : "assistant/message, interrupted"
loop -> log : "turn/end: aborted"
steps auto
```

- The agent loop in `packages/core/agent-loop/src/agent.ts` has `cancel(cause)` (line 191), which aborts the turn's controller. A cause is `user`, `parent`, `hook` or `disposed` (`packages/core/session/src/types.ts`, line 194).
- The loop checks the signal after each piece (line 494). On abort it writes `interruptedBlocks()` as an `assistant/message` with `interrupted: true`, or an `assistant/attempt` when nothing was kept (lines 503-531). The turn ends with `{ kind: 'aborted', reason: cause }` (line 406).
- The method `interruptedBlocks()` in `packages/llm/llm/src/assembler.ts` (line 169) keeps text and reasoning with non-space content and omits tool calls.
- The DeepSeek adapter in `packages/llm/llm-deepseek/src/adapter.ts` joins the caller's signal with its own (line 67) and reports an abort with the code `ABORTED` (line 78). In `packages/llm/llm-retry`, `cancellableDelay` (line 83) ends a wait early.

## What you have now

mini-dsh now has a full provider layer: shared pieces, an assembler, an adapter seam and a DeepSeek adapter with reasoning and signatures. It sends append-only requests, retries with backoff and cancels cleanly, but the loop still creates and connects every part itself. How can a program be built from parts that each start, stop and find each other on their own?
