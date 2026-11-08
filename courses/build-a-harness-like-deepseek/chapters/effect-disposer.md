# Disposer: work that undoes itself

Disposing the adapter's fiber set its state to `disposed`, but `llm` stayed in the store. A plugin can also start a timer, add a listener or mount another plugin. If the program forgets any one of these when the plugin stops, an old adapter keeps answering. How can stopping a plugin undo everything it did, without the plugin keeping a list by hand?

## Hiring a hall

Think of hiring a village hall for a party. Each time you set something up, you write one line on a card, such as "heater on, so turn the heater off". At the end of the evening you read the card from the bottom up. The last thing you set up is the first thing you take down. Because of this, nothing is removed while something else still needs it.

In mini-dsh, the line on the card is a **disposer**: a function, returned by the code that made a registration, that undoes exactly that registration. An **effect** is a registration made together with its disposer. The comparison differs in one way. You write the card yourself, and you can forget a line. Here every registration method returns its disposer and puts it on the fiber's card for you.

## Effects in the kernel

Give `Fiber` a list of disposers, and run them in reverse when it stops:

```ts
export type Disposer = () => void | Promise<void>

// in class Fiber
readonly disposers: Disposer[] = []

async dispose() {
  this.state = 'unloading'
  for (const undo of this.disposers.splice(0).reverse()) await undo()
  this.state = 'disposed'
}
```

Add `effect` to `Context`. Every other registration goes through it:

```ts
// in class Context
effect(setup: () => Disposer): Disposer {
  const fiber = this.fiber
  if (fiber.state === 'unloading' || fiber.state === 'disposed') {
    throw new Error('cannot create effect on inactive context')
  }
  const undo = setup()
  let done = false
  const dispose = async () => {
    if (done) return
    done = true
    fiber.disposers.splice(fiber.disposers.indexOf(dispose), 1)
    await undo()
  }
  fiber.disposers.push(dispose)
  return dispose
}

provide(name: string, value: unknown): Disposer {
  return this.effect(() => {
    if (this.store.has(name)) throw new Error(`service "${name}" already exists`)
    this.store.set(name, value)
    return () => { this.store.delete(name) }
  })
}

plugin(plugin: Plugin, config?: unknown): Fiber {
  const fiber = new Fiber(this, plugin, config)
  this.effect(() => () => fiber.dispose())   // the child stops with its parent
  void fiber.start()
  return fiber
}
```

The root context also needs a fiber, so the constructor makes one and marks it `active`. Now trace one plugin that makes 3 effects:

1. Provide the adapter: `ctx.provide('llm', adapter)`. The card has 1 disposer.
2. Start a timer: `ctx.effect(() => { const t = setInterval(ping, 1000); return () => clearInterval(t) })`. The card has 2.
3. Mount a child plugin that reads `llm`. The card has 3.
4. Dispose the fiber. The child stops first, then the timer is cleared, then `llm` leaves the store.

Why reverse? Step 3 used `llm`, and step 2's timer calls the adapter. If `llm` left the store first, a timer tick could find no adapter. Undoing in reverse order removes each user before the thing it uses.

The `done` flag makes a disposer safe to call twice. A plugin can also call one early, for example to remove one listener, and it then leaves the card.

> **Key idea:** Every registration returns a disposer that undoes it; the fiber runs them in reverse order when the plugin stops.

```inkling
title "Set up in order, undo in reverse"
layout timeline
- 1: provide llm
- 2: start the timer
- 3: mount the child
- 4: stop the child
- 5: clear the timer
- 6: remove llm
span 1..3 "plugin loads"
span 4..6 "plugin stops"
steps auto
```

## How dsh does it

Cordis puts this in `ctx.effect()` (`vendor/cordis/src/fiber.ts:424`). It throws `INACTIVE_EFFECT` on a fiber that is unloading (fiber.ts:425-428), and its disposer is single-shot. `ctx.provide` (`reflect.ts:292`) and `ctx.on` (`events.ts:265`) are effects too, so harness registries such as `ctx.tools.register` undo themselves. One difference from yours: at unload, Cordis starts the disposers in reverse order but awaits the async ones together (fiber.ts:720). The Cordis tutorial (`docs/cordis-tutorial/02-lifecycle-and-effects.md`) gives the rule: if teardown steps must run in sequence, keep them in one disposer.

## What you have now

A plugin's fiber now owns every registration the plugin made, and stopping it unwinds them in reverse. But a plugin that reads `llm` still assumes the adapter is there when it starts. What should happen when it starts before the adapter exists, or when the adapter goes away?
