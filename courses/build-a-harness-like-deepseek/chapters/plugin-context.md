# Context: a shared object that holds services

Your first agent works, but every part knows every other part. The file `loop.ts` imports the DeepSeek adapter from `llm.ts` and the tool list from `tools.ts` by name. To try a second adapter, or to give a test a fake one, you must edit the loop. How can the loop use an adapter without knowing which file it came from?

## A noticeboard in a shared office

Think of an office with one noticeboard. A team that offers a service pins a card on it: "Printing: room 4". Anyone who needs printing reads the board. They do not need to know which team does the printing this month. A new team member gets a desk with a small board of their own. It shows the office board below it, and any card they pin covers the office card with the same name, for their desk only.

In a harness, the board is called a **context**: one object that every part receives and reads shared abilities from. Each shared ability on it, such as "the model adapter", is a **service**, stored under a name such as `llm` or `tools`. The comparison differs in one way. A desk board copies nothing. A child context holds only its own cards and looks up everything else in its parent at the moment it is read.

JavaScript has this lookup built in. Every object can have a **prototype**: another object it asks when it does not have a property itself. `Object.create(parent)` makes a new, empty object whose prototype is `parent`.

## The smallest context

Create `src/kernel.ts`:

```ts
export class Context {
  readonly store = new Map<string, unknown>()   // name -> service, one per program

  get<T>(name: string): T | undefined {
    return this.store.get(name) as T | undefined
  }

  provide(name: string, value: unknown): void {
    if (this.store.has(name)) throw new Error(`service "${name}" already exists`)
    this.store.set(name, value)
  }

  extend<T extends object>(meta: T): this & T {
    return Object.assign(Object.create(this), meta)
  }
}
```

Trace it with 2 contexts:

1. Create the root: `const root = new Context()`. The root owns the one `store`.
2. Provide the adapter: `root.provide('llm', deepseekAdapter)`. The store has 1 service.
3. Make a child: `const child = root.extend({ label: 'loop' })`. The child has 1 own property, `label`.
4. Read through the child: `child.get('llm')`. The child has no `store`, so JavaScript reads `root.store` through the prototype, and the call returns the DeepSeek adapter.
5. Read the label from the root: `root.label` is `undefined`. The child's own property never reaches its parent.

Now the loop asks for `ctx.get('llm')` and never imports `llm.ts`. Whoever builds the context decides which adapter that name means.

Why does the store stay at the root and the labels go on children? A service exists once for the whole program, so every part sees the same one. A label describes one part only, so it must not leak upward.

> **Key idea:** A context is an object every part receives; it holds named services, and a child context inherits from its parent.

```inkling
title "One context, many readers"
layout down
root: box "Root context" blue
store: db "store\nllm, tools"
child: box "Child context\nlabel: loop"
loop: box "loop.ts"
root -> store : "owns"
child -> root : "prototype"
loop -> child : "get('llm')"
circle store
step 1: root, store "The root owns one store of named services"
step 2: child "A child adds its own properties and asks the root for the rest"
step 3: loop "The loop reads llm by name and imports no adapter file"
```

## How dsh does it

DeepSeek Harness builds on Cordis, a plugin framework kept in `vendor/cordis`. Its `Context` class is at `vendor/cordis/src/context.ts:42`. Its `extend(meta)` method at line 99 does what yours does: `Object.create` on the parent, then the own properties of `meta`. The services live in one store at `vendor/cordis/src/reflect.ts:222`. A second `provide` under a taken name throws "service has been registered" (reflect.ts:304). The harness parts are services on that context:

```inkling
title "Services on the dsh context"
layout mindmap
steps auto
- Context
  - ctx.llm (llm/llm)
  - ctx.tools (core/tools)
  - ctx.sessions (core/session)
  - ctx.systemPrompt (core/system-prompt)
```

That table of names and packages is in `docs/architecture.md`.

## What you have now

You have one object that holds the adapter and the tools by name. The agent loop asks for an ability instead of importing a file. But nothing yet says when a part starts using the context or when it stops. How does a part join the program, and how does it leave?
