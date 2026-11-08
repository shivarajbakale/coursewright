# Isolate realm: a different service under one context

You want the main agent to use `deepseek-flash`, and a cheap helper part of the program to use a second adapter with other settings. Both parts read `ctx.get('llm')`. But the store holds one service per name, and a second `provide('llm', …)` throws "already exists". Must the helper's code change to read a name such as `llm2`?

## Two floors, one socket name

Think of an office building where every desk lamp plugs into a socket labelled "power". On most floors, "power" means the building's main supply. On the floor with the test lab, the electricians wire the sockets labelled "power" to a separate, safer supply. The lamps do not change and the label does not change. Only the wiring behind the label on that floor is different.

In mini-dsh, the label is the service name, and the wiring is a hidden key. An **isolate realm** is a child context that gives one service name a new key. Everything below it reads and provides that name in a separate slot. The parent and every other part keep the old slot. 

The comparison differs in one way. A floor is a fixed place. A realm is a context, so it covers exactly the plugins mounted under it, wherever they sit in the program.

## Keys instead of names

JavaScript's `Symbol(name)` makes a value that is unique every time, even with the same text. Change the store to use symbols as keys, and add a table from names to symbols. The table is inherited through the prototype, like the context:

```ts
// in class Context
readonly store = new Map<symbol, unknown>()
readonly isolates: Record<string, symbol> = Object.create(null)

keyOf(name: string): symbol {
  return this.isolates[name] ?? (this.root.isolates[name] = Symbol(name))
}

get<T>(name: string): T | undefined {
  return this.store.get(this.keyOf(name)) as T | undefined
}

isolate(name: string): this {
  const isolates = Object.create(this.isolates)
  isolates[name] = Symbol(name)
  return this.extend({ isolates })
}
```

The constructor also sets `this.root = this`, and every child inherits that property. `provide`, its disposer, and the `ready` check of a fiber all change `name` to `this.keyOf(name)`. Nothing else changes.

Trace the main agent and the helper:

1. Mount the flash adapter on the root.
   `keyOf('llm')` makes the root's symbol, here called `llm#root`, and the store has 1 entry.
2. Make a realm: `const helper = root.isolate('llm')`. The helper's table maps `llm` to a new symbol, `llm#helper`.
3. Mount a second adapter on `helper`. Its `provide('llm', …)` writes `llm#helper`. That slot is empty, so nothing throws. The store has 2 entries.
4. Mount a loop plugin on `helper` with `inject: ['llm', 'tools']`. Its `llm` is the second adapter. Its `tools` is the root's, because `tools` was not isolated and still maps to the root's symbol.
5. Read `root.get('llm')`. It is still the flash adapter, because the root's table never changed.

The plugins under `helper` are the same code as everywhere else. Only the context they were mounted on decides which `llm` they see.

> **Key idea:** An isolate realm gives one service name a new key below one context, so that subtree gets its own service.

```inkling
title "One name, two slots"
layout down
root: box "Root context\nllm -> llm#root"
helper: box "helper = isolate('llm')\nllm -> llm#helper" yellow
store: db "Store"
flash: box "llm#root: flash adapter"
second: box "llm#helper: second adapter"
tools: box "tools#root: tools"
helper -> root : "prototype"
root -> store
store -> flash
store -> second
store -> tools
highlight helper
step 1: root, store, flash "The root's llm lives in the root's slot"
step 2: helper "isolate gives llm a new key below helper"
step 3: second "The helper's adapter fills its own slot"
step 4: tools "Names that were not isolated stay shared"
```

## How dsh does it

Cordis has the same method, `isolate(name, label?)`, in `vendor/cordis/src/context.ts:121-125`. It copies the isolation map through `Object.create` and sets `name` to a new symbol. Services are stored by that symbol (`reflect.ts:300-306`). The plugin list file can isolate a name for a group of plugins. `isolate: { shell: true }` makes a private realm. A text label instead of `true` makes a realm shared by every group with that label (`vendor/loader/src/config/isolate.ts:77-89`). dsh's agent presets, named groups of plugins for one kind of agent, depend on it: `mountPreset` throws "Preset services require isolate realms" if a preset's plugins put a service in the root's slot (`packages/preset/agent-preset-registry/src/mount.ts:69`, :213).

## What you have now

A realm lets one part of the program swap a service by name while every other part keeps the original. It changes which service a name means. It does not change who hears an event: a listener mounted for the helper still hears every agent's `tool/finished`. How can a listener or a tool apply to one agent only?
