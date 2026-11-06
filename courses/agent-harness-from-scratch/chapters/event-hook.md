# Event hook: letting plugins react when something happens

A service lets one plugin call another. But sometimes the direction is backwards. The agent loop finishes a turn, and three different plugins care: one writes a session title, one prints the token count, one saves a summary. If the loop had to call each of them, it would need to know they exist, and adding a fourth would mean editing the loop. How can the loop announce "a turn ended" and let whoever cares respond?

## Announce, and let anyone listening react

Think of a station announcement: "the 9:15 to Leeds is now boarding". The announcer does not know who is waiting. Everyone who cares about that train reacts, and everyone else ignores it. The picture stops holding in one way: on a platform people react at the same moment, while in the simplest kernel the reactions run one after another, in the order they signed up.

```inkling
title "Announce, and let listeners react"
layout flow
loop: box "Agent loop" yellow
map: box "Listener list" gray
title1: box "Title plugin"
counter: box "Step counter"
summary: box "Summary plugin"
disposer: box "Disposer" blue
loop -> map : "serial('agent/turn-end')"
map -> title1 : "listener"
map -> counter : "listener"
map -> summary : "listener"
counter -> loop : "prints step count"
map -> disposer : "removes the listener"
note map "the loop never knows who is here"
step 1: loop "The loop finishes a turn and announces"
step 2: map "Listeners wait in a map by name"
step 3: title1, counter, summary "Each plugin that signed up runs now"
step 4: disposer "Unloading a plugin removes its listener"
```

That is an event hook. Part of the program announces a named event, and plugins register listeners, functions that run when that event is announced. Registering a listener is an effect, so it disappears when its plugin unloads.

```ts
// src/plugins.ts (additions)
type Listener = (...args: any[]) => unknown
readonly listeners = new Map<string, Listener[]>()

on(name: string, fn: Listener): Disposer {
  return this.effect(() => {
    const map = this.root.listeners
    map.set(name, [...(map.get(name) ?? []), fn])
    return () => map.set(name, map.get(name)!.filter((l) => l !== fn))
  })
}

emit(name: string, ...args: unknown[]): void {
  for (const fn of this.root.listeners.get(name) ?? []) {
    try { fn(...args) } catch (err) { console.error(`listener for ${name} failed`, err) }
  }
}

async serial(name: string, ...args: unknown[]): Promise<void> {
  for (const fn of [...(this.root.listeners.get(name) ?? [])]) await fn(...args)
}
```

There are two ways to announce. `emit` is fire and forget: it calls every listener right away and ignores what they return. One failing listener is logged and the rest still run. `serial` is for listeners that do slow work, such as writing a file. It waits for each one to finish before starting the next, so the announcer knows all of them are done when `serial` returns.

Now the loop can announce without knowing its audience:

```ts
// inside the agent loop plugin, after a turn finishes
await ctx.serial('agent/turn-end', { turn: 3, steps: 2 })

// a separate plugin
const stepCounter: Plugin = (ctx) => {
  ctx.on('agent/turn-end', (info: { turn: number; steps: number }) => {
    console.log(`turn ${info.turn} took ${info.steps} steps`)
  })
}
```

Trace it. When `stepCounter` loads, its listener is added to the list for `agent/turn-end`. The loop finishes turn 3 after two steps and calls `serial`. The listener prints `turn 3 took 2 steps`. Unload `stepCounter`, and its disposer removes the listener; the next turn end prints nothing, and the loop never changed.

> **Key idea:** An event hook is a named announcement point: any plugin can register a listener for it, the announcer runs all listeners without knowing who they are, and each listener is removed when its plugin unloads.

Which one should you use? Use `emit` for quick notices where the announcer does not need to wait. Use `serial` when the announcer must not continue until every listener has finished.

**In DeepSeek Harness:** Cordis offers several ways to announce in `vendor/cordis/src/events.ts`. `emit` is synchronous and ignores return values. `parallel` runs every listener at once and waits for all. `serial` awaits each in order and stops at the first listener that returns a real value. `ctx.on(name, fn, { prepend })` registers through an effect, so listeners go away on unload. The agent loop announces `await this.dispatch.serial('agent/turn-stopping', { turn, signal })` in `packages/core/agent-loop/src/agent.ts`. dsh also rewrote `emit` for agent events, because the stock one let one synchronous throw starve later listeners and dropped promises (`packages/core/agent/src/dispatch.ts`). That is why your `emit` catches errors per listener.

## What you have now

The kernel can now announce named events, and plugins can listen and react, with every listener cleaned up by its disposer. Together with services, plugins can now both call each other and respond to each other. But a listener can only watch. What if a plugin needs to change the outcome, for example to block a tool from running or to time it out?
