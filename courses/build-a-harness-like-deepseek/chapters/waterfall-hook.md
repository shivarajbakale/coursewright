# Waterfall hook: middleware that calls the next listener

With `serial`, a listener can answer a question, and with `emit` it can watch. But you also want plugins that change the work itself. A timing plugin wants to note the time before a model request and again after it. A budget plugin wants to refuse a request that asks for too many tokens, so it is never sent. Neither fits a listener that only sees the arguments. How can a listener run code before the work, after it, or instead of it?

## Parcels through a sorting office

Think of a parcel that passes a row of desks before it leaves the building. Each clerk takes the parcel, may add a label, and passes it to the next desk. The last desk sends it. When a receipt comes back, it passes the same desks in reverse, and each clerk can read it or stamp it. A clerk who finds a parcel that is too heavy does not pass it on. That clerk writes "refused" on a receipt, and the desks before it see only that receipt.

In mini-dsh, this is a **waterfall** event. Each listener receives the arguments and a `next` function as its last argument. Calling `next()` runs the rest of the chain and returns its result. A listener that does not call `next()` stops the chain, and its own return value becomes the result. Code arranged like this, where each layer wraps the next, is called **middleware**. 

The comparison differs in one way. A clerk can forget to pass a parcel and someone will notice. A listener that forgets `next()` stops the work silently.

## The kernel's waterfall

The last argument is the inner work, the thing the chain wraps:

```ts
// in class Context
waterfall(name: string, ...args: any[]): any {
  const inner = args.pop() as () => unknown
  const callbacks = this.callbacks(name)   // a fresh copy, in registration order
  const dispatch = (): unknown => {
    const cb = callbacks.shift()
    if (!cb) return inner()
    let called = false
    const next = () => {
      if (called) throw new Error('next() called multiple times')
      called = true
      return dispatch()
    }
    return cb(...args, next)
  }
  return dispatch()
}
```

The loop sends every model request through it: `ctx.waterfall('llm/request', request, () => llm.send(request))`. Two plugins listen:

```ts
ctx.on('llm/request', async (request, next) => {        // timing
  const start = Date.now()
  const reply = await next()
  console.log(`model took ${Date.now() - start} ms`)
  return reply
})

ctx.on('llm/request', async (request, next) => {        // budget
  if (request.max_tokens > 8192) return { error: 'max_tokens over budget' }
  return next()
})
```

Trace two requests:

1. Send a request with `max_tokens: 4096`. Timing runs first and calls `next()`.
2. Budget runs. 4096 is not over 8192, so it calls `next()`.
3. No listener is left, so `inner()` sends the request to DeepSeek. The reply returns to budget, then to timing.
4. Timing prints `model took 900 ms` and returns the reply to the loop.
5. Send a second request with `max_tokens: 16000`. Timing calls `next()`, and budget returns the error without calling `next()`. DeepSeek is never called. Timing still prints its time and returns the error.

The rule that follows: a listener that only watches or adds a label must call `next()` once. Skipping it is a decision to stop the work, and calling it twice throws.

> **Key idea:** A waterfall listener gets the arguments and next; calling next runs the rest of the chain; skipping it replaces the result.

```inkling
title "Each listener wraps the next"
layout sequence
loop: box "Loop"
timing: box "Timing"
budget: box "Budget"
model: box "DeepSeek"
loop -> timing : "request"
timing -> budget : "next()"
budget -> model : "next()"
model --> budget : "reply"
budget --> timing : "reply"
timing --> loop : "reply and time"
steps auto
```

## How dsh does it

Cordis implements this in `vendor/cordis/src/events.ts:246`, with the same "next() called multiple times" error. `docs/cordis-primer.md:31-35` makes "a listener that only annotates or observes must delegate" a repository rule. Every model call in dsh passes the `llm/stream` waterfall (`packages/llm/llm/src/index.ts:1178`), whose inner work is the adapter's stream. The `session-checkpoint-policy` plugin listens on it and writes the session file to disk before it calls `next()` (`packages/session/session-checkpoint-policy/src/index.ts:64-68`):

```inkling
title "One model call through llm/stream"
layout flow
loop: box "core/agent-loop"
llm: box "ctx.llm\nllm/stream"
ckpt: box "session-checkpoint-policy"
adapter: box "llm-deepseek"
api: cloud "DeepSeek API"
loop -> llm : "stream()"
llm -> ckpt : "listener"
ckpt -> adapter : "next()"
adapter -> api : "HTTP"
step 1: loop, llm "The loop asks ctx.llm to stream a reply"
step 2: ckpt "A listener saves the session, then calls next"
step 3: adapter, api "The inner work is the DeepSeek adapter's request"
```

## What you have now

A plugin can now wrap any work that the sender passes through a waterfall. It can change the input, read the output, or stop the work. Every listener so far sees every event, and every plugin sees the same service for each name. What if one part of the program needs a different service under the same name, for example a second `llm` that talks to another model?
