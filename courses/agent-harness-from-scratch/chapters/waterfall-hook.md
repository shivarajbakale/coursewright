# Waterfall hook: plugins wrapping one decision in turn

A listener can only watch. Suppose one plugin wants to stop a tool called `delete_file` from ever running. Another wants to time every tool. A third wants to give up on any tool that takes longer than 30 seconds. Each of these needs to stand around the tool call, act before it, maybe prevent it, and see what came out. How do several plugins each get a say over one action?

## Layers around one action

Think of a parcel passing through several checkpoints before it reaches the person who opens it. Each checkpoint can inspect it, wrap it in extra padding, note the time, or refuse it outright, and a refused parcel goes no further. When the reply comes back, it passes the same checkpoints in reverse. The picture stops holding in one detail: a real checkpoint hands the parcel forward and forgets it, while here each layer waits for everything inside it to finish, then sees the result on the way back.

That is a waterfall hook. Listeners wrap one decision in turn. Each listener receives the event's arguments plus a next function, a function that hands control to the next layer and returns what came back. A listener that calls `next()` passes the decision on. A listener that returns without calling it decides on its own, and the layers inside it never run.

```ts
// src/plugins.ts (addition)
waterfall<T>(name: string, ...argsThenInner: unknown[]): Promise<T> {
  const inner = argsThenInner.pop() as () => Promise<T>
  const list = [...(this.root.listeners.get(name) ?? [])]
  const run = (i: number): Promise<T> => {
    if (i === list.length) return inner()
    let called = false
    const next = () => {
      if (called) throw new Error(`next() called twice in ${name}`)
      called = true
      return run(i + 1)
    }
    return Promise.resolve(list[i](...argsThenInner, next) as T)
  }
  return run(0)
}
```

The last argument is the innermost action, the thing being wrapped. `run(0)` calls the first listener with a `next` that calls `run(1)`, and so on. When every listener has passed it on, the real action runs. Calling `next` twice would run the action twice, so it throws.

Two plugins wrapping the same action:

```ts
const timer: Plugin = (ctx) => {
  ctx.on('tools/execute', async (call: ToolCall, next: () => Promise<string>) => {
    const start = Date.now()
    const out = await next()
    console.log(`${call.name} took ${Date.now() - start} ms`)
    return out
  })
}
const blocker: Plugin = (ctx) => {
  ctx.on('tools/execute', async (call: ToolCall, next: () => Promise<string>) =>
    call.name === 'delete_file' ? 'Error: delete_file is disabled' : next())
}

const out = await ctx.waterfall('tools/execute', call, () => tool.execute(args, signal))
```

Trace a `read_file` call that takes 12 milliseconds. `timer` notes the start and calls `next`. `blocker` sees `read_file` and calls `next`. The real tool runs and returns the contents. `blocker` returns them unchanged; `timer` prints `read_file took 12 ms` and returns them. Now trace `delete_file`. `timer` calls `next`; `blocker` returns the error text without calling `next`, so the tool never runs. `timer` still prints a time, a few milliseconds, because it wraps everything inside it.

> **Key idea:** A waterfall hook runs listeners as nested layers around one action; each gets the arguments and a next function, and may pass the decision inward, change what comes back, or decide alone by not calling next.

The common bug is forgetting `next` in a listener that only meant to log. It silently blocks the action for everyone after it.

**In DeepSeek Harness:** Cordis `waterfall` treats the last argument as the innermost next; each listener gets `(...args, next)`, not calling next is a veto, and calling it twice throws (`vendor/cordis/src/events.ts`). A real observing listener in `packages/jobs/tool-jobs/src/index.ts` records an output limit on `tools/pre-execute`, then `return next()`, registered with `{ prepend: true }` so it runs outermost. The research notes quote the warning directly: "Forgetting next() in a logging listener silently swallows the default behavior for everyone downstream."

## What you have now

The kernel can now let several plugins wrap one action, building on event hooks: the same listener list, dispatched as nested layers instead of a flat list. You have every kernel piece: plugins, disposers, services, injection, events and waterfalls. What remains is how a whole application is described: which plugins to mount, with what config, and how to change that without editing code.
