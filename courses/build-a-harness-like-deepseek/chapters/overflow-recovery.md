# Overflow recovery: shortening and trying again after a too-large request

With surface replacement, the harness shortens the history before a step when the token meter crosses the threshold. But the meter guesses 4 characters per token. Dense code or text in another language can use more tokens than the guess. Then the request goes out, and the provider answers with an error: the input is larger than the context window. What should the harness do now?

## A parcel that is too big

Think of a parcel counter at the post office. You give the clerk a box, and the clerk says it is over the size limit. Waiting a minute and giving the same box again does not help. You must take something out first, and then try once more. If it is still too big after that, you stop and ask for help.

In the harness, the box is the request, the clerk is the provider, and taking something out is a summary that replaces old messages. The comparison differs in one way. As you saw with retry with backoff, many failures pass when you wait. This failure does not: the same request fails the same way every time. So a retry only makes sense when the surface became smaller.

## The recovery rule

The adapter turns the provider's error text, such as "maximum context length", into one fixed code: `CONTEXT_WINDOW_EXCEEDED`. The loop logs the failed attempt and runs a waterfall hook named `agent/request-error`. A listener may answer `{ kind: 'retry' }`, and the loop runs the step again. With no answer, the turn ends with the error.

In mini-dsh, `src/compaction.ts` adds one more listener:

```ts
const retries = new Map<Session, number>()

ctx.on('agent/request-error', async ({ session, failure }, next) => {
  if (failure.code !== 'CONTEXT_WINDOW_EXCEEDED') return next()
  if ((retries.get(session) ?? 0) >= 1) return next()
  const before = session.replaceCount
  const range = selectRange(priced(session), 0)
  if (range !== null) await compactRange(session, range.start, range.end)
  if (session.replaceCount <= before) return next()
  retries.set(session, (retries.get(session) ?? 0) + 1)
  return { kind: 'retry' }
})

ctx.on('session/event', (session, event) => {
  if (event.type === 'assistant/message') retries.delete(session)
})
```

`replaceCount` goes up by 1 each time a replace lands in the surface. Trace a surface `[0, 10, 4, 5, 6, 7]` in a window of 10,000 tokens. The meter said 6,708, but the real request is 10,300:

1. The provider rejects the request, and the code is `CONTEXT_WINDOW_EXCEEDED`. No retry was used yet, so the listener continues.
2. The listener selects a range with 0 tokens to keep. Normal policy keeps 1,440; here only the newest call and its result stay, messages 6 and 7.
3. A summary replaces seqs 10, 4 and 5. The surface becomes `[0, 15, 6, 7]`, and `replaceCount` goes from 1 to 2.
4. The count rose, so the listener answers retry. The step runs again with the smaller request.
5. If that request also fails, the listener sees 1 retry already and calls `next()`. The turn ends with the error.

Why compare `replaceCount`? If no safe range exists, nothing changed, and the same request would fail again. When the reply arrives, the `assistant/message` listener sets the count of retries back to 0.

> **Key idea:** Overflow recovery shortens the surface after the provider rejects a request as too large, and retries the step only when the surface changed.

```inkling
title "One rejected request, one retry"
layout sequence
adapter: box "llm-deepseek"
loop: box "agent-loop"
basic: box "compaction-basic"
adapter -> loop : "CONTEXT_WINDOW_EXCEEDED"
loop -> basic : "agent/request-error"
basic -> basic : "summarise, keep 0"
basic --> loop : "retry"
loop -> adapter : "smaller request"
steps auto
```

## How dsh does it

`packages/llm/llm-deepseek/src/transport.ts` (line 32) maps the provider's text to `CONTEXT_WINDOW_EXCEEDED`, using `isContextWindowExceededError()` in `packages/llm/llm/src/error.ts` (line 83). `packages/core/agent-loop/src/agent.ts` logs an `assistant/attempt` and runs `agent/request-error` (lines 543-563). The listener is in `packages/compaction/compaction-basic/src/index.ts` (lines 213-257). It stops after `maxOverflowRetries`, which defaults to 1 (`config.ts`, line 106). It keeps 0 tokens (line 305), and it answers retry only when `surface.replaceGeneration` rose (lines 251-256). An `assistant/message` resets the count (lines 207-211).

## What you have now

The harness now manages the whole context: ordered prompt sections, runtime notes, project instructions, a meter, a safe cut, a summary that replaces old messages, and a last defence when the guess is wrong. Every tool so far lives inside the harness. What if a useful tool lives in another program, written by someone else?
