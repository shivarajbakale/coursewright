# Tool registry: the list of tools a step can use

With defineTool, one tool is one object that carries its schema, its argument check and its body. The first agent kept its tools in a fixed array in the loop file. In a harness built from plugins, one plugin adds tools that read and write files, and another adds a tool that runs commands. When a plugin stops, its tools must stop too, or the model can ask for a tool whose code has gone. Where do the tools live, so that plugins can add them and take them away?

## A notice board

Think of a notice board in a shared kitchen. Anyone can pin a card that offers a service: "I fix bikes, room 12". When that person moves out, they take their card down. A visitor reads the board as it is today, so they never knock on an empty room.

In a harness, the board is a shared service and each card is a tool definition. The visitor is the agent loop at the start of each step. The comparison differs in one way. People forget to take their cards down. In a plugin harness, the plugin system runs a disposer when a plugin stops. That disposer removes the card, so a tool cannot stay behind.

```inkling
title "Where tools live in dsh"
layout flow
fs: box "tool-fs\nread, write, edit"
bash: box "tool-bash\nbash"
tools: db "dsh-tools\nctx.tools" yellow
loop: box "agent-loop\neach step"
exec: box "tool-executor-native\nruns the calls"
fs -> tools : "register"
bash -> tools : "register"
loop -> tools : "read schemas"
tools -> exec : "dispatch"
circle tools
step 1: fs, bash "Plugins each add their own tools"
step 2: tools "One shared service holds them all"
step 3: loop "Each step reads the tools that exist now"
step 4: exec "Calls go to a separate plugin that runs them"
```

## The smallest tool service

Here is the service in `src/tools.ts`. It is a service, so plugins name `tools` in their `inject` list and wait for it.

```ts
export class ToolsService {
  private readonly tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): Disposer {
    if (this.tools.has(tool.name)) throw new Error(`tool "${tool.name}" is already registered`)
    this.tools.set(tool.name, tool)
    return () => { this.tools.delete(tool.name) }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  schemas(): ToolSchema[] {
    return [...this.tools.values()].map(t => ({ name: t.name, description: t.description, parameters: t.parameters }))
  }
}
```

A plugin registers inside an effect, so its disposer runs when the plugin stops:

```ts
export const countLinesPlugin = {
  name: 'count-lines',
  inject: ['tools'],
  apply(ctx: Context) {
    const tools = ctx.get<ToolsService>('tools')!
    ctx.effect(() => tools.register(countLines))
  },
}
```

Follow one plugin through two steps:

1. Start the plugin. `register` adds `count_lines`, and `schemas()` returns 1 schema.
2. Run a step. The loop sends that 1 schema, and the model may call `count_lines`.
3. Stop the plugin. The plugin system runs its disposer, which deletes `count_lines` from the map.
4. Run the next step. `schemas()` returns 0 schemas, so the model no longer sees the tool.
5. Send an old reply that still asks for `count_lines`. The lookup `get` returns `undefined`, and the loop answers with an error result that says the tool is unknown.

`schemas()` copies only three fields. The body, the render function and every other callback stay inside the harness. The model sees what a tool takes, never how it runs. A second plugin that registers the same name fails at once, so two tools cannot hide each other by accident.

> **Key idea:** A tool registry is a shared service where plugins register tools, each registration returns a disposer, and every step reads what is registered now.

## How dsh does it

In dsh, the registry is `ToolsService`, mounted as `ctx.tools`, in `packages/core/tools/src/index.ts` (line 99). Its `register` method (line 128) binds the registration to the calling plugin's lifetime. It returns "the exact disposer that unregisters the tool". It refuses a duplicate name in one layer and the reserved name `run_code`.

The `schemas()` method (line 316) keeps only the model-facing fields through `projectToolSchema` (`schema.ts`, line 641). Before each step, `packages/core/agent-loop/src/agent.ts` (line 292) calls `ctx.tools.resolve()`, which takes the set of tools for that step once. A tool may also pass a `when` condition at registration, which can leave it out of a step.

## What you have now

Tools now live in one service that plugins add to and remove from through disposers, and each step reads the current list. One model reply can hold three tool calls at once. Should the harness run them one after another, or all at the same time?
