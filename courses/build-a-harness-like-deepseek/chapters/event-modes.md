# Events: telling many listeners that something happened

A service answers a direct call: the loop asks `llm` for a reply and gets one. But some news has readers the sender does not know. When a tool finishes, a logger wants to print it, a counter wants to add 1, and a session plugin wants to record it. The tool runner should not import all three. How does one plugin tell every interested plugin that something happened?

## A station announcement

Think of a railway station. The announcer says "the 9:15 to Leeds leaves from platform 4". Everyone who cares about that train hears it; the announcer does not know who they are. Sometimes the station asks a question instead: "Is there a doctor on the train?" The first person who answers is enough. The others stay seated.

In mini-dsh, the announcement is an **event**: a name, such as `tool/finished`, sent with some arguments. A **listener** is a function a plugin registers for one event name; the kernel calls it each time that event is sent. The comparison differs in one way. In a station, people hear the announcement at the same moment. In a program, the sender chooses how the kernel calls the listeners: all at once, one after another, or until one answers.

## Four ways to send

The root keeps every listener in one table, and `on` is an effect, so a listener leaves when its plugin stops:

```ts
type Listener = (...args: any[]) => any

// in class Context (hooks lives on the root, beside store)
on(name: string, callback: Listener): Disposer {
  return this.effect(() => {
    const list = this.hooks.get(name) ?? []
    list.push({ ctx: this, callback })
    this.hooks.set(name, list)
    return () => { list.splice(list.findIndex(h => h.callback === callback), 1) }
  })
}

private callbacks(name: string): Listener[] {
  return (this.hooks.get(name) ?? []).map(h => h.callback)
}

const answered = (r: unknown) => r !== null && r !== false && r !== undefined

emit(name: string, ...args: unknown[]): void {
  for (const cb of this.callbacks(name)) cb(...args)
}
async parallel(name: string, ...args: unknown[]): Promise<void> {
  await Promise.all(this.callbacks(name).map(async cb => cb(...args)))
}
async serial(name: string, ...args: unknown[]): Promise<unknown> {
  for (const cb of this.callbacks(name)) {
    const r = await cb(...args)
    if (answered(r)) return r
  }
}
bail(name: string, ...args: unknown[]): unknown {
  for (const cb of this.callbacks(name)) {
    const r = cb(...args)
    if (answered(r)) return r
  }
}
```

The four modes differ in two questions. Does the sender wait for the listeners? Does a listener's return value matter?

- `emit` calls every listener in registration order and waits for none. Return values are dropped.
- `parallel` starts every listener at once and waits until all have finished.
- `serial` calls listeners in order and waits for each. The first one that returns a value other than `null`, `false` or `undefined` wins. The rest do not run.
- `bail` is the same as `serial`, but it does not wait: it suits listeners that answer at once.

Trace `serial` with 3 listeners on `turn/stopping`, an event that asks "may the turn end now?":

1. Send it: `await ctx.serial('turn/stopping', { turn: 4 })`.
2. Listener A runs and returns `undefined`. It has no opinion, so the kernel moves on.
3. Listener B runs and returns `'run one more step'`. That is an answer, so `serial` returns it.
4. Listener C never runs.

With `emit`, all 3 would run and the sender would get nothing back. The mode is part of the event's contract. A listener written for `serial` returns an answer. A listener written for `emit` must not count on one.

> **Key idea:** An event is a named message to every listener; the mode decides if the sender waits and if one answer stops the rest.

```inkling
title "Four ways to send one event"
layout compare
columns "emit", "parallel", "serial", "bail"
row "Sender waits": no, yes, yes, no
row "Runs in order": yes, no, yes, yes
row "First answer wins": no, no, yes, yes
step 1: sender-waits "Some modes wait for every listener to finish"
step 2: runs-in-order "Only parallel starts all listeners at once"
step 3: first-answer-wins "serial and bail stop at the first answer"
```

## How dsh does it

These modes are in `vendor/cordis/src/events.ts`. `parallel` at line 191 uses `Promise.allSettled` and throws one `AggregateError` if any listener failed. Then come `emit` (203), `serial` (214) and `bail` (228). `ctx.on` registers through `fiber.effect` (events.ts:265). The agent loop uses both kinds: it sends `agent/status` with `emit` (`packages/core/agent-loop/src/agent.ts:166`) and awaits `agent/turn-stopping` with `serial` (agent.ts:396). `docs/cordis-primer.md` says each harness event documents its mode with an `@mode` tag.

## What you have now

Plugins can now announce news to listeners they never import, and the sender picks whether to wait and whether to take an answer. Each listener here sees the arguments and either answers or stays silent. What if a listener needs to change the work itself, or run code both before and after it?
