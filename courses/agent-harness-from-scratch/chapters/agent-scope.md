# Agent scope: registrations that belong to one agent only

So far every listener lands on one shared list. That is fine with one agent. Now picture two agents in the same program: a main one, and a second one started for a narrow research job. The research agent gets a listener that stops it after five minutes. With one shared list, that listener also fires for the main agent's turns. And when the research agent finishes, who removes its registrations? How can registrations belong to one agent only?

## A badge on every registration

Think of a conference with name badges. Announcements over the main speakers reach everyone. Notes left in a room for "team blue" are read only by people wearing blue badges. When team blue leaves, their room is cleared. The picture stops holding at the badge itself: a person can borrow a badge, while here the badge is fixed by which context made the registration, and cannot be changed afterwards.

An agent scope gives each agent its own child context with a tag, its key. Anything registered through that context carries the tag. When an announcement is made for that agent, untagged listeners run (they are global) plus listeners carrying that agent's tag. Other agents' listeners are skipped. Disposing the scope's context runs its disposers, so everything the agent registered goes with it.

```ts
// src/plugins.ts (changes)
scope?: string
readonly listeners = new Map<string, { fn: Listener; scope?: string }[]>()

on(name: string, fn: Listener): Disposer {
  const entry = { fn, scope: this.scope }
  return this.effect(() => {
    const map = this.root.listeners
    map.set(name, [...(map.get(name) ?? []), entry])
    return () => map.set(name, map.get(name)!.filter((l) => l !== entry))
  })
}

private listenersFor(name: string): Listener[] {
  return (this.root.listeners.get(name) ?? [])
    .filter((l) => l.scope === undefined || l.scope === this.scope)
    .map((l) => l.fn)
}
// emit, serial and waterfall now loop over this.listenersFor(name)

export function createScope(parent: Context, key: string) {
  const ctx = new Context(parent)
  ctx.scope = key
  const dispose = parent.effect(() => () => ctx.dispose())
  return { ctx, dispose }
}
```

Each agent announces through its own context, so the filter uses that agent's key. Trace it with two agents:

```ts
app.on('agent/turn-end', () => console.log('global: turn ended'))
const main = createScope(app, 'main')
const research = createScope(app, 'research')
research.ctx.on('agent/turn-end', () => console.log('research: check the clock'))

main.ctx.emit('agent/turn-end')      // global: turn ended
research.ctx.emit('agent/turn-end')  // global: turn ended / research: check the clock
research.dispose()
main.ctx.emit('agent/turn-end')      // global: turn ended
```

The first announcement comes from `main`, so only the untagged listener runs. The second comes from `research`: the untagged listener and the `research` one both run, two lines. Then `research.dispose()` runs the scope's disposers and its listener is gone. Other agents never saw it, and nothing leaks.

The same idea extends to anything that keeps a list, such as tools or system prompt text. Keep a global layer plus one layer per scope; when an agent looks something up, a same-named entry in its own layer shadows the global one, so the most specific wins.

> **Key idea:** An agent scope is a tagged child context for one agent: what it registers is visible only to that agent plus global code, and disposing the scope removes all of it.

One caution. A scope decides visibility and cleanup. It is not a security boundary: code in one scope can still reach the shared shelf.

**In DeepSeek Harness:** `packages/core/scope` provides `createScope(ctx, key)`, which mounts a no-op child plugin, a fresh fiber, and returns `fiber.ctx.extend({ [kScope]: key })`. The agent loop calls `this.scope = createScope(loopCtx, this)` and then uses `this.scope.ctx` (`packages/core/agent-loop/src/agent.ts`). Events are filtered by passing a carrier as the first argument of a dispatch, whose filter admits untagged listeners plus those tagged with the key (`vendor/cordis/src/events.ts`). The design rule reads: "The registration context determines both visibility and ownership." And plainly: "Scope is not a sandbox or an authority boundary."

## What you have now

The plugin kernel is complete: plugins, disposers, services, injection, event and waterfall hooks, config rows, and per-agent scopes built from a tagged child context. Every part of the agent can now be a plugin. Next you apply it to the most important plugin of all: where do the tools live, and how does the model see them without seeing their code?
