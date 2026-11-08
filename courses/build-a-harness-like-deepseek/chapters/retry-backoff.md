# Retry with backoff: trying again after a short wait

A provider can be busy, refuse a request for a moment or drop the connection. With the adapter seam, every such failure reaches the loop as a `finish` piece with kind `error` and a code. Right now the loop stops the turn on the first failure. Many failures pass in a second, though. Should the loop try again at once, try again later, or give up?

## Calling a busy shop

Think of calling a shop and hearing the busy tone. You wait half a minute and call again. If it is still busy, you wait a minute, then two minutes. You give up after five tries. If the line says "call back in ten minutes", you wait the ten minutes.

Here the call is one model request, the busy tone is a failure code, and the growing waits keep you from blocking the line. The picture differs in one way. A person's waits vary by chance, but the program adds a small random part on purpose. Then many programs that failed together do not all call again at the same moment.

**Backoff** is a wait before the next attempt that grows after each failure. A **retry** is one more attempt at the same request after a failure.

```inkling
title "Retry with backoff"
layout cycle
center "at most 5 retries"
send: circle "Send the request"
fail: circle "It fails with a code"
write: circle "Write llm/retry"
wait: circle "Wait, then double"
cycle send, fail, write, wait
step 1: send "The program sends the request"
step 2: fail "A failure code that may pass, such as RATE_LIMIT"
step 3: write "The retry goes into the record before the wait"
step 4: wait "The next wait is twice as long"
```

## Which failures, and how long

Not every code is worth a retry. A wrong API key fails the same way every time, so the program stops. mini-dsh retries five codes, the same default list dsh uses: `EMPTY_RESPONSE`, `RATE_LIMIT` (HTTP 429), `SERVER` (HTTP 500 and above), `TIMEOUT` and `TRANSPORT`. The DeepSeek adapter now sets these codes from the HTTP status, and reads a `retry-after` header into `retryAfterMs`.

`src/retry.ts` computes the wait:

```ts
export const policy = { maxRetries: 5, initialDelayMs: 500, maxDelayMs: 10_000, jitterRatio: 0.1 }
export const RETRYABLE = ['EMPTY_RESPONSE', 'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT']

export function delayFor(retry: number, random = Math.random): number {
  const exponential = Math.min(policy.initialDelayMs * 2 ** (retry - 1), policy.maxDelayMs)
  const jitter = 1 - policy.jitterRatio + 2 * policy.jitterRatio * random()
  return Math.min(exponential * jitter, policy.maxDelayMs)
}
```

Without the random part, the waits for retries 1 to 5 are 500, 1,000, 2,000, 4,000 and 8,000 milliseconds. A retry 6 would be 16,000, so the cap of 10,000 stops it. The random part moves each wait by up to 10 percent: retry 1 waits between 450 and 550 milliseconds.

## The retry goes into the record

The loop in `src/loop.ts` now repeats one step's request:

```ts
while (true) {
  const asm = new BlockAssembler()
  for await (const chunk of stream(request)) asm.push(chunk)
  const finish = asm.finish
  if (finish.kind !== 'error') break
  session.append('assistant/attempt', { failure: finish.failure })
  const retry = retriesThisStep(session) + 1
  if (!RETRYABLE.includes(finish.failure.code) || retry > policy.maxRetries) throw new Error(finish.failure.message)
  const delayMs = finish.failure.retryAfterMs ?? delayFor(retry)
  session.append('llm/retry', { retry, delayMs, failure: finish.failure })
  await new Promise(resolve => setTimeout(resolve, delayMs))
}
```

`retriesThisStep` reads `session.all()` and counts the `llm/retry` events after the last `step/start`. `EventType` in `src/session.ts` gains `'assistant/attempt'` and `'llm/retry'`. Trace a busy provider:

1. Send the request. DeepSeek answers HTTP 429 with no `retry-after`, so the code is `RATE_LIMIT`.
2. Write the failed attempt. The record shows the request was tried, but no assistant message joins the history.
3. Count earlier retries. There are none, so this is retry 1, and the wait is about 500 milliseconds.
4. Write `llm/retry` before the wait. If the program stops during the wait, the record still says a retry was due.
5. Send again. This time the reply streams and the loop leaves the `while`.

The count comes from the record, not from a variable. Because of this, a program that restarts reads the same count, and a step never gets more than five retries.

> **Key idea:** Retry with backoff tries a failed request again after a wait that doubles each time, and writes every retry to the record first.

## How dsh does it

```inkling
title "A retry in dsh"
layout sequence
loop: box "agent-loop"
retry: box "llm-retry"
log: db "Session record"
loop -> log : "assistant/attempt"
loop -> retry : "agent/request-error"
retry -> log : "llm/retry"
retry -> log : "llm/retry-started"
retry --> loop : "kind retry"
steps auto
```

- `packages/core/agent-loop/src/agent.ts` writes the failed `assistant/attempt` (line 545) and offers the failure to `agent/request-error` (line 549). A `{ kind: 'retry' }` answer makes the step send again.
- `packages/llm/llm-retry/src/index.ts` computes the wait in `localDelay` (lines 59-64). It uses the provider's `retry-after` only up to `maxDelayMs`, and in normal mode gives up when the request asks for more (lines 224-235).
- The same file writes `llm/retry` before the wait (line 184) and `llm/retry-started` after it (line 186). It counts retries by reading the record, and the count resets at `step/start` and `turn/end` (line 128).
- The defaults of five retries, 500 and 10,000 milliseconds and 10 percent are in `packages/llm/llm/src/retry-policy.ts` (lines 14-24).

## What you have now

The loop now survives short failures, and the record explains every wait. During a wait of 8 seconds, or a long reply, the user may decide the answer is no longer wanted. How does the program stop a request part way through, and what does it keep?
