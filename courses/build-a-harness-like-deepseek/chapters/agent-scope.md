# Agent scope: registrations that apply to one agent

One mini-dsh program can run two agents at once: a coder that changes code and a reviewer that only reads it. A plugin for the coder adds a `apply_edit` tool and a listener that counts the coder's tool calls. Today both land in the shared tables. The reviewer sees `apply_edit`, and the counter also counts the reviewer's calls. An isolate realm does not help, because the agents share the same `tools` service. How can one registration apply to one agent only?

## Name tags at a conference

Think of a conference with one shared hall. Some notices on the wall have no name on them: "lunch at 12:30" is for everyone. Others carry a name: "Dr Okafor, your taxi is at gate 2". A notice with a name is read by that person only, even though everyone walks past the same wall.

In mini-dsh, the name on the notice is a scope tag. An **agent scope** is a child context tagged with one agent's identity. Tools and listeners registered through that context apply to that agent only, while untagged registrations still apply to every agent. The comparison differs in one way. A person at a conference reads every notice and ignores most. Here the kernel filters before delivery, so a tagged listener is never called for another agent at all.

## Tags in the kernel

A scope is a small plugin of its own, so its registrations disappear when the agent stops. Its context carries the tag:

```ts
export function createScope(ctx: Context, key: object) {
  const fiber = ctx.plugin(function scope() {})
  return { ctx: fiber.ctx.extend({ scope: key }), dispose: () => fiber.dispose() }
}

// in class Context: send an event about one agent
emitFor(key: object, name: string, ...args: unknown[]): void {
  for (const hook of this.hooks.get(name) ?? []) {
    const tag = hook.ctx.scope
    if (tag === undefined || tag === key) hook.callback(...args)
  }
}
```

The tools service applies the same rule. `register` stores a tool in the table of the calling context's tag, or in the shared table when there is no tag. `list(key)` returns the shared tools plus that agent's own, and an agent's tool shadows a shared one with the same name.

Trace two agents:

1. Create the agents. Each gets a scope: `coder.ctx` is tagged `coder`, `reviewer.ctx` is tagged `reviewer`.
2. Register `search_code` on the root context. It has no tag, so it goes in the shared table.
3. Register `apply_edit` through `coder.ctx`. It goes in the coder's table.
4. List tools. `tools.list(coder)` gives 2 tools. `tools.list(reviewer)` gives 1, `search_code`.
5. Add a counter through `coder.ctx.on('tool/finished', …)`, and a logger on the root.
6. Each agent finishes one tool call. The loop sends `ctx.emitFor(coder, 'tool/finished', …)` and then the same for the reviewer.
7. The logger has no tag, so it runs 2 times. The counter's tag is `coder`, so it runs 1 time.

When the coder stops, its scope fiber is disposed. `apply_edit` and the counter leave, and the reviewer does not notice.

> **Key idea:** An agent scope is a child context tagged with one agent; tools and listeners registered through it reach that agent only.

```inkling
title "Shared and tagged registrations"
layout down
shared: box "Root: search_code, logger"
coder: box "coder.ctx\napply_edit, counter" blue
reviewer: box "reviewer.ctx\nno own tools" green
cagent: person "Coder agent"
ragent: person "Reviewer agent"
shared -> cagent
shared -> ragent
coder -> cagent
step 1: shared "Untagged registrations reach every agent"
step 2: coder, cagent "The coder's tags reach the coder only"
step 3: reviewer, ragent "The reviewer sees the shared table and nothing else"
```

## How dsh does it

In `packages/core/agent-loop/src/agent.ts:147`, every `Agent` calls `createScope(loopCtx, this)` from `packages/core/scope/src/index.ts:137`, and `agent.ctx` is that scoped context. Tool calls send their events through `scopeTarget(this.tools, exec.agent)` (`packages/core/tools/src/pipeline.ts:409`). That carrier admits untagged listeners and listeners tagged with the agent or an enclosing scope. A tag below the agent stays excluded, so events flow up, never down (scope/src/index.ts:170-185). `ctx.tools.register` stores a tool in the calling scope, where it shadows a shared tool of the same name (`packages/core/tools/src/index.ts:120`).

```inkling
title "Who uses the scope in dsh"
layout mindmap
steps auto
- core/scope
  - core/agent-loop: one scope per agent
  - core/tools: tools by scope
  - tools pipeline: events for one agent
```

## What you have now

The kernel now has every mechanism the harness needs: services, effects, events, realms and scopes. But a program is still a `main.ts` that calls `ctx.plugin` again and again, and changing an adapter means editing code. How can the list of plugins and their settings become data you can read, change and share?
