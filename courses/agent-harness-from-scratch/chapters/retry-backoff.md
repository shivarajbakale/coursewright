# Retry with backoff: trying again after a growing wait

The model adapter assumes every request works. Real ones fail. The provider answers `429 Too Many Requests` because you sent too much this minute. It answers `503` because its servers are overloaded. The connection drops halfway through a stream. Today any of these throws out of the agent loop and ends the turn, though a second try a moment later would probably have worked. When should the harness try again, how long should it wait, and what goes in the event log?

## Call back later, and a bit later each time

Think of phoning a busy office. If the line is engaged, redialling every second does not help: you add to the jam. A sensible caller waits, then waits longer after each failure. Now imagine a hundred people were cut off at the same moment. If they all wait exactly one minute, they all ring at once again. If each waits about a minute, give or take a few seconds, the calls spread out.

```inkling
title "Retry with backoff"
layout cycle
center "try again until it works"
attempt: box "Send request" yellow
wait: box "Wait longer each time"
jitter: box "Add random jitter"
success: box "Request succeeds"
giveup: box "Give up after 5 retries"
step 1: attempt "The request fails with a retryable error"
step 2: wait "The wait doubles: 500 ms, 1 s, 2 s, 4 s, 8 s"
step 3: jitter "A random 10 percent either way spreads clients out"
step 5: success "The reply arrives and the turn continues"
step 6: giveup "The wait caps at 10 s and the turn ends"
cycle attempt, wait, jitter
attempt -> success : "reply"
wait -> giveup : "after 5 retries"
circle jitter
```



Those are the three parts. First, decide which failures are worth another try. Second, wait longer after each failure: that is **backoff**. Third, add a small random amount to each wait, called **jitter**, so many clients do not retry in lockstep.

The picture stops holding in one way: an office never says when to call back, but a provider sometimes does. A `Retry-After` header on a `429` says how long to wait; use it.

## Which failures, and how long

The adapter turns each failure into an error with a stable code, so the loop can decide without reading provider text:

```ts
// src/llm.ts
export type ErrorCode = 'RATE_LIMIT' | 'SERVER' | 'TIMEOUT' | 'TRANSPORT' | 'EMPTY_RESPONSE' | 'AUTH' | 'BAD_REQUEST'
export class ModelError extends Error {
  constructor(public code: ErrorCode, message: string, public retryAfterMs?: number) { super(message) }
}
const RETRYABLE = new Set<ErrorCode>(['RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT', 'EMPTY_RESPONSE'])

export function delayFor(retry: number, initialMs = 500, maxMs = 10_000, jitter = 0.1): number {
  const base = Math.min(initialMs * 2 ** (retry - 1), maxMs)
  return base * (1 + (Math.random() * 2 - 1) * jitter)
}
```

The adapter maps `429` to `RATE_LIMIT`, any `5xx` to `SERVER`, a network failure to `TRANSPORT`, a stream that stalls to `TIMEOUT`, and a reply with no content to `EMPTY_RESPONSE`. These may pass on their own. `401` (`AUTH`) and `400` (`BAD_REQUEST`) will not: a wrong key or a malformed request fails the same way every time, so retrying only wastes a minute.

With these numbers, retries 1 to 5 wait about 500, 1000, 2000, 4000 and 8000 milliseconds, each within 10% either way. The cap of 10,000 would only matter from the sixth retry, when the doubling reaches 16,000. Allow at most 5 retries, so the worst case is about 15.5 seconds of waiting before the turn gives up.

The step wraps its model request, and every attempt goes in the log:

```ts
for (let retry = 0; ; retry++) {
  const assembler = new Assembler()
  try {
    for await (const chunk of adapter.stream(request)) assembler.push(chunk)
    return assembler.result()
  } catch (err) {
    session.append('assistant/attempt', { turn, step, error: String(err),
                                          partial: assembler.result().message })
    if (!(err instanceof ModelError) || !RETRYABLE.has(err.code) || retry >= 5) throw err
    await sleep(Math.min(err.retryAfterMs ?? delayFor(retry + 1), 10_000))
  }
}
```

Each failed try is appended as `assistant/attempt`, with the error and whatever text had streamed before it broke. Derived history ignores that type, so the model never sees a failed half-reply. But you do: when a turn was slow, the log shows three `RATE_LIMIT` attempts before the one that worked.

Notice that the retry lives here, in one place. Many HTTP libraries can retry on their own. If a library also retried 5 times, each of your 6 attempts could become 6 requests, 36 in all, and the library's attempts would never reach your log.

> **Key idea:** Retry with backoff means trying a failed model request again only for failures that can pass on their own, waiting a growing, slightly random time between tries, and recording every failed attempt in the event log.

**In DeepSeek Harness:** the default policy is in `packages/llm/llm/src/retry-policy.ts`: 5 retries for `EMPTY_RESPONSE`, `RATE_LIMIT`, `SERVER`, `TIMEOUT` and `TRANSPORT`, starting at 500 ms and capped at 10 s, with 10% jitter, honouring `Retry-After`. An optional package, `packages/llm/llm-retry`, carries it out and appends `llm/retry` events. Failed tries are logged as `assistant/attempt`. Library retries are switched off because they "would multiply attempts and omit intermediate failures from the session log". A watchdog turns a stalled stream into a `TIMEOUT`.

## What you have now

Failed model requests now come back by themselves when the failure is temporary, with each attempt visible in the event log and hidden from the model. One kind of ending is still missing: the person at the keyboard pressing Ctrl+C because the agent is going the wrong way. How do you stop a request and a running tool cleanly, and keep what was already shown?
