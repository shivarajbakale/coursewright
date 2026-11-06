# Service: a named capability one plugin shares with others

Plugins can now load and unload cleanly. But each one lives alone in its own child context. The plugin that runs the agent loop needs the event log, and the event log belongs to another plugin. If the loop imports the log's file directly, you are back to parts welded together. How does one plugin hand something to another without either knowing where the other came from?

## A shared shelf with name tags

Picture a shared kitchen shelf. Anyone may put a jar on it, but every jar gets a name tag, and only one jar per name. Anyone may take the jar labelled "salt" without knowing who brought it. When the person who brought it moves out, their jars leave with them. The picture stops holding in one way: a real shelf cannot tell you who placed a jar, while the kernel always remembers the owner, which is how the jar leaves at the right moment.

```inkling
title "A service on the shared shelf"
layout flow
owner: person "memoryLog"
capability: box "session service" green
shelf: box "Root services shelf"
greeter: person "greeter"
gone: box "Entry removed" gray
step 1: owner, capability "The owner provides a named capability"
step 2: shelf "The root shelf keeps it under one name"
step 3: greeter, shelf "Another plugin looks up the name"
step 4: owner, gone "Unloading the owner removes the entry"
circle capability
```

That jar is a service: a named object one plugin provides for others to use, removed when its plugin unloads. All contexts share one shelf, kept on the root context, the first one you created.

```ts
// src/plugins.ts (changes)
export class Context {
  readonly root: Context
  readonly services = new Map<string, unknown>()
  private disposers: Disposer[] = []

  constructor(readonly parent?: Context) {
    this.root = parent ? parent.root : this
  }

  provide(name: string, value: unknown): Disposer {
    return this.effect(() => {
      const shelf = this.root.services
      if (shelf.has(name)) throw new Error(`service "${name}" is already provided`)
      shelf.set(name, value)
      return () => shelf.delete(name)
    })
  }

  get<T>(name: string): T | undefined {
    return this.root.services.get(name) as T | undefined
  }
  // effect, plugin and dispose as before; plugin now makes `new Context(this)`
}
```

`provide` is an effect, so its disposer removes the entry. Because the effect is recorded on the providing plugin's own context, the entry disappears exactly when that plugin unloads. A second plugin claiming the same name is refused, so two plugins never fight over one name without anyone noticing.

Here is a tiny event-log service and its user:

```ts
type Session = { append(type: string, data: unknown): void }

const memoryLog: Plugin = (ctx) => {
  const events: unknown[] = []
  ctx.provide('session', { append: (type, data) => events.push({ type, data }) } satisfies Session)
}

const greeter: Plugin = (ctx) => {
  const session = ctx.get<Session>('session')
  session?.append('user/message', { content: 'hi' })
}

const app = new Context()
const unloadLog = app.plugin(memoryLog, {})
app.plugin(greeter, {})
unloadLog()
console.log(app.get('session')) // undefined
```

Trace it. `memoryLog` puts an object under the name `session`. `greeter` asks for `session`, finds it and appends one event. It never imported `memoryLog`, so you could swap in a log that writes a JSON Lines file and `greeter` would not change. After `unloadLog()`, the shelf no longer holds `session`, and `get` returns `undefined`.

The question mark in `session?.append` matters. With `get`, a service is optional: the user must cope with it being absent.

> **Key idea:** A service is a named value one plugin provides on a shared shelf for others to look up by name; providing it is an effect, so the entry is removed when the providing plugin unloads.

**In DeepSeek Harness:** a Cordis context "is a repository of services. A service claims a stable `ctx.<key>`" (`docs/cordis-primer.md`). A service is usually a class extending `Service`, whose constructor calls `ctx.reflect.provide(name, this)` "so the service is unregistered automatically when the owning fiber unloads" (`vendor/cordis/src/service.ts`). Providing a taken name throws (`vendor/cordis/src/reflect.ts`). TypeScript learns the type through declaration merging, for example `interface Context { otel: OTel }` in `packages/telemetry/otel/src/index.ts`, so code writes `ctx.otel` instead of `ctx.get('otel')`.

## What you have now

Plugins can now share named capabilities through the root's shelf, and each entry leaves with its owner because providing is an effect with a disposer. That lets the agent loop find the event log without importing it. But mount `greeter` before `memoryLog` and it finds nothing. How can a plugin wait until the services it needs exist?
