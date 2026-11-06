# Disposer: a function that undoes what a plugin set up

The heartbeat plugin started an interval, and nothing could stop it. If plugins are to be removed, reloaded with new settings or swapped out while the program runs, the host must be able to undo everything a plugin did. How does it learn what to undo?

## Every setup comes with its own undo

Think of checking into a hotel. Each time you borrow something at the desk, a key card, a towel, an umbrella, the clerk writes it on your slip. At checkout the clerk reads the slip and collects each item. You never have to remember what you borrowed. The picture stops holding in one detail: the hotel collects items in any order, while the host undoes things in reverse order, last borrowed first returned, because later setup often leans on earlier setup.

In code, the slip is a list of functions. Every time a plugin sets something up, it hands the host a function that undoes it. That function is a disposer. When the plugin unloads, the host runs every disposer it collected.

```inkling
title "Effects collect undo functions"
layout flow
setup: box "Setup runs" yellow
disposer: box "Disposer returned"
host: box "Host keeps disposer"
unload: box "Plugin unloads"
step 1: setup "The plugin sets something up"
step 2: disposer "It hands back a function that undoes it"
step 3: host "The host keeps the disposer on a list"
step 4: unload "On unload the host runs the disposers in reverse order"
setup -> disposer : "hands back undo"
disposer -> host : "kept on list"
host -> unload : "runs in reverse"
unload -> disposer : "undoes setup"
circle disposer
```

The setup step that comes with a disposer is called an effect: you run some code now and receive a way to reverse it later. Here is the kernel with effects:

```ts
// src/plugins.ts
export type Disposer = () => void
export type Plugin<C = unknown> = (ctx: Context, config: C) => void

export class Context {
  private disposers: Disposer[] = []

  effect(setup: () => Disposer): Disposer {
    const undo = setup()
    let done = false
    const once: Disposer = () => {
      if (done) return
      done = true
      this.disposers = this.disposers.filter((d) => d !== once)
      undo()
    }
    this.disposers.push(once)
    return once
  }

  plugin<C>(fn: Plugin<C>, config: C): Disposer {
    return this.effect(() => {
      const child = new Context()
      fn(child, config)
      return () => child.dispose()
    })
  }

  dispose(): void {
    for (const d of [...this.disposers].reverse()) d()
  }
}
```

Three things are going on. First, `effect` runs the setup now and keeps its undo on the list. The `done` flag makes the disposer safe to call twice: the second call does nothing. Second, each plugin gets its own child context, so its disposers stay separate from everyone else's. Third, mounting a plugin is itself an effect on the parent. Unloading a parent therefore unloads every child it mounted, all the way down.

Now the heartbeat can be stopped:

```inkling
title "Stopping the heartbeat"
layout timeline
- 1: Interval starts
- 2: It prints at 1,000 ms
- 3: It prints at 2,000 ms
- 4: It prints at 3,000 ms
- 5: Disposer clears interval
span 2..4 "three beats"
step 1: 1 "The interval starts"
step 2: 2 "It prints at 1,000 ms"
step 3: 3 "It prints at 2,000 ms"
step 4: 4 "It prints at 3,000 ms"
step 5: 5 "The disposer clears the interval"
```

```ts
const heartbeat: Plugin<{ everyMs: number }> = (ctx, config) => {
  ctx.effect(() => {
    const id = setInterval(() => console.log('still alive'), config.everyMs)
    return () => clearInterval(id)
  })
}

const app = new Context()
const stop = app.plugin(heartbeat, { everyMs: 1000 })
setTimeout(stop, 3500)
```

Trace it. The interval prints at 1,000, 2,000 and 3,000 milliseconds. At 3,500, `stop` runs the child's `dispose`, which calls `clearInterval`. The output is three lines of `still alive`, then silence, and the program exits because no timer is left.

> **Key idea:** A disposer is the undo function every registration returns; the host keeps them per plugin and runs them in reverse order when that plugin unloads, so removing a plugin leaves nothing behind.

This matters more than it looks. A plugin can unload because its config changed, because a developer edited its file, or because something it needed went away. If one registration forgets its disposer, every reload leaks another copy: two intervals, then three.

**In DeepSeek Harness:** `ctx.effect(fn)` runs `fn` now, and the returned disposers run in reverse order when the fiber unloads; calling a disposer twice is harmless (`docs/cordis-api/fiber.md`). Registering a listener, mounting a child plugin and registering a tool are all effects. One subtlety from the docs: "multiple async disposers run concurrently. If teardown steps must run in sequence, keep them in one disposer."

## What you have now

Plugins can now be loaded and unloaded cleanly, because every setup step returns a disposer kept on the plugin's own child context. This is the plugin idea plus a reliable undo. But plugins still cannot share anything: how does the plugin that owns the tools hand them to the plugin that runs the agent loop?
