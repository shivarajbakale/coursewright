# Service: a shared ability plugins can wait for

The agent loop plugin reads `llm` from the context as soon as it starts. If you mount the loop before the adapter, `ctx.get('llm')` returns `undefined` and the first request fails. If you dispose the adapter while the loop runs, the loop keeps a dead reference. Should you mount plugins in a careful order and hope nobody changes it?

## A kitchen that waits for gas

Think of a restaurant kitchen. The chef does not start cooking until the gas is on. If the gas goes off in the middle of service, the chef stops, puts the pans down and waits. When the gas comes back, the chef starts again. Nobody writes "turn on the gas before the chef arrives" on a schedule. The chef watches the gas.

In mini-dsh, the gas is a **service**: an ability one plugin puts in the context under a name, for others to use. A plugin lists the service names it needs in an **inject** list. Its fiber stays `pending` until every name in that list exists, and goes back to `pending` when one disappears. The comparison differs in one way. The chef watches the gas. A plugin watches nothing: the kernel tells each fiber whenever the store changes.

## Waiting in the kernel

A plugin declares its needs beside its function:

```ts
export type Plugin =
  | (PluginFn & { inject?: string[] })
  | { name?: string; inject?: string[]; apply: PluginFn }

export const loopPlugin = {
  name: 'agent-loop',
  inject: ['llm', 'tools'],
  apply(ctx: Context) {
    ctx.provide('agent', createAgent(ctx.get('llm')!, ctx.get('tools')!))
  },
}
```

The root keeps a set of every fiber. Each fiber can say if it is ready:

```ts
// in class Fiber
ready(): boolean {
  return (this.plugin.inject ?? []).every(name => this.ctx.store.has(name))
}

async refresh() {
  if (this.state === 'pending' && this.ready()) {
    await this.start()
  } else if (this.state === 'active' && !this.ready()) {
    await this.unload()          // run the disposers in reverse, as before
    this.state = 'pending'
  }
}
```

`start` now begins only from `refresh`. `provide` and its disposer both end with `this.refresh()`, which calls `refresh` on every fiber in the root's set.

Trace the loop and two adapters:

1. Mount the loop first. It needs `llm` and `tools`, and the store has `tools` only, so its fiber stays `pending`.
2. Mount the DeepSeek adapter. Its `provide('llm', …)` adds `llm` and refreshes every fiber. The loop is now ready, so it loads and becomes `active`.
3. Dispose the DeepSeek adapter. Its disposer removes `llm` and refreshes. The loop is no longer ready, so it unloads and its `agent` service leaves too. It is `pending` again.
4. Mount a fake adapter, written for tests, that provides `llm`. The loop loads again, with the fake one.

The mount order no longer matters: step 1 could come last and the result is the same. The loop never checks for `undefined`, because its function runs only while every name in `inject` exists.

> **Key idea:** A service is an ability stored under a name; a plugin lists names in inject and runs only while they all exist.

```inkling
title "Pending until the service exists"
layout sequence
loop: box "Loop fiber"
kernel: box "Kernel"
adapter: box "Adapter plugin"
loop -> kernel : "inject llm, tools"
kernel --> loop : "stay pending"
adapter -> kernel : "provide llm"
kernel -> loop : "refresh: start"
adapter -> kernel : "dispose: remove llm"
kernel -> loop : "refresh: unload"
steps auto
```

## How dsh does it

A Cordis service is often a class: `super(ctx, 'tools')` in a `Service` subclass calls `ctx.reflect.provide` (`vendor/cordis/src/service.ts:42-58`). A plugin's `inject` keeps its fiber pending (`fiber.ts:617`, `_refresh`), and `reflect.notify` refreshes the fibers that inject a changed name (`reflect.ts:335`). When a provider unloads, Cordis first waits for its dependents to unload (`fiber.ts:712-718`), so they can still use the service in their own teardown. The real agent loop waits for six services:

```inkling
title "What the dsh agent loop injects"
layout flow
loop: box "core/agent-loop\nctx.agentLoop" blue
llm: box "ctx.llm"
tools: box "ctx.tools"
sp: box "ctx.systemPrompt"
sessions: box "ctx.sessions"
agents: box "ctx.agents"
loop -> llm
loop -> tools
loop -> sp
loop -> sessions
loop -> agents
tools -> sp : "tools injects it too"
step 1: loop "agent-loop lists its needs in inject"
step 2: llm, tools, sessions, agents "It stays pending until these exist"
step 3: sp "core/tools waits for systemPrompt as well"
```

The list is `static inject` in `packages/core/agent-loop/src/index.ts:291` (it also names `sessionProjections`); `packages/core/tools/src/index.ts:100` injects `systemPrompt`.

## What you have now

Plugins now share abilities through named services, and each one starts and stops with the services it needs, in any mount order. Services answer direct calls. But some news has many readers that the sender does not know, such as "a tool just finished". How does one plugin tell every interested plugin that something happened?
