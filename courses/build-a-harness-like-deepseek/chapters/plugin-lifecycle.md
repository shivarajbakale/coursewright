# Plugin lifecycle: how a plugin starts and stops

With a context, the agent loop reads the adapter by name. But something must put the adapter there, at the right moment, and take it away again when you change your mind. When does a part start, and how do you tell whether it started at all?

## A shop that opens and closes

Think of a stall at a weekend market. Before the market opens, the stall is set up but closed. Then the owner unpacks. Then it is open and selling. At the end of the day the owner packs up, and then the stall is gone. Sometimes a table breaks during unpacking, and the stall never opens.

A visitor can look at a stall and say which of these it is in.

In mini-dsh, each part you add to the program is a **plugin**: a function that receives a context and puts its abilities on it. Mounting a plugin creates a **fiber**, a small record that holds the plugin's own child context and the state it is in. The comparison differs in one way. A market stall closes every evening and opens again the next day. A fiber that reached the end state never runs again; to run the plugin again you mount it again and get a new fiber.

## Six states

A fiber is in one of six states:

```ts
export type State = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'disposed'
export type PluginFn = (ctx: Context, config?: unknown) => void | Promise<void>
export type Plugin = PluginFn | { name?: string; apply: PluginFn }

export class Fiber {
  state: State = 'pending'
  error?: unknown
  readonly ctx: Context & { fiber: Fiber }

  constructor(parent: Context, readonly plugin: Plugin, readonly config?: unknown) {
    this.ctx = parent.extend({ fiber: this })
  }

  async start() {
    this.state = 'loading'
    try {
      const apply = typeof this.plugin === 'function' ? this.plugin : this.plugin.apply
      await apply(this.ctx, this.config)
      this.state = 'active'
    } catch (error) {
      this.error = error
      this.state = 'failed'
    }
  }

  async dispose() {
    this.state = 'unloading'
    this.state = 'disposed'
  }
}
```

Add one method to `Context` that mounts a plugin:

```ts
plugin(plugin: Plugin, config?: unknown): Fiber {
  const fiber = new Fiber(this, plugin, config)
  void fiber.start()
  return fiber
}
```

A plugin can be a plain function or an object with an `apply` method. Both shapes end in the same call. Trace two plugins:

1. Mount the adapter: `const a = root.plugin(ctx => ctx.provide('llm', deepseekAdapter))`. The fiber starts in `pending`.
2. Watch it load. `start` sets `loading`, runs the function, and sets `active`. The store now holds `llm`.
3. Mount a broken plugin: `const b = root.plugin(() => { throw new Error('no key') })`. It goes `pending`, then `loading`, then `failed`, and `b.error` holds the error.
4. Read the states. `a.state` is `active` and `b.state` is `failed`, so you know which part did not start.
5. Stop the adapter: `await a.dispose()`. It goes `unloading`, then `disposed`.

Why keep a `pending` state if the plugin leaves it at once? A plugin can need something before it may run. In this lesson nothing makes it wait, so it moves on immediately. The state still exists, so a caller can tell "not started yet" from "started and failed".

Step 5 has a gap. The fiber says `disposed`, but `llm` is still in the store. Nothing undid what the plugin did.

> **Key idea:** A fiber records one mounted plugin's state: pending, loading, active or failed, then unloading and disposed, and a disposed fiber never restarts.

```inkling
title "The states of one fiber"
layout down
pending: round "pending"
loading: round "loading"
active: round "active" green
failed: round "failed" red
unloading: round "unloading"
disposed: round "disposed" gray
pending -> loading -> active -> unloading -> disposed
loading -> failed : "apply threw"
highlight active
step 1: pending "Mounting creates a fiber in pending"
step 2: loading, active "The plugin function runs, then the fiber is active"
step 3: failed "If the function throws, the fiber stops in failed"
step 4: unloading, disposed "Disposing unloads it, and a disposed fiber stays disposed"
```

## How dsh does it

Cordis keeps the same states in `vendor/cordis/src/fiber.ts:147` (`FiberState`: PENDING, LOADING, ACTIVE, FAILED, DISPOSED, UNLOADING). `ctx.plugin()` in `vendor/cordis/src/registry.ts:316` accepts a function, a class or an object with `apply`, and returns the `Fiber` (fiber.ts:184). Like yours, the fiber's context is `parent.extend({ fiber: this })` (fiber.ts:240). The returned fiber can also be awaited: `await ctx.plugin(p)` waits until loading settles and throws the plugin's error if it failed (registry.ts:332, fiber.ts:754).

## What you have now

A plugin is a function that receives a context, and its fiber tells you whether it is waiting, running, broken or gone. But disposing it changed only a word: the service it put in the store is still there. How does a plugin undo its own work when it stops?
