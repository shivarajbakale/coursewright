# Tool registry: one place that holds every tool

With the plugin kernel, a tool can now be a plugin. The file tools might live in one plugin, a web fetch tool in another, a project's own tool in a third. But the agent loop must build one `tools` list for each model request, and find the right `execute` function when a tool call arrives. If every tool plugin talks to the loop directly, you are back to welded parts. Where do the tools go so the loop can find them?

## One desk that knows every tool

Think of the front desk at a library. Every department registers its services with the desk. A visitor sees the printed list of what is offered, a name and a line of description each, never the staff rotas or the keys. When a visitor asks for something by name, the desk passes the request to the right department. The picture stops holding in one way: a library rarely changes its list, while plugins load and unload tools at any moment, and the list must follow.

A tool registry is a service that holds every tool and gives the model only their schemas. Plugins register tools into it; the agent loop asks it for schemas when building a request and for a tool by name when a call comes back.

```ts
// src/tools.ts
import type { Tool, ToolSchema } from './types.ts'

export class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): () => void {
    if (this.tools.has(tool.name)) throw new Error(`tool "${tool.name}" is already registered`)
    this.tools.set(tool.name, tool)
    return () => this.tools.delete(tool.name)
  }

  schemas(): ToolSchema[] {
    return [...this.tools.values()].map(({ name, description, parameters }) => ({ name, description, parameters }))
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }
}

export const toolsPlugin: Plugin = (ctx) => ctx.provide('tools', new ToolRegistry())
```

`register` returns a disposer, so a tool plugin wraps it in an effect. The tool then disappears when its plugin unloads:

```ts
const clockTool: Plugin<undefined> = (ctx) => {
  const tools = ctx.get<ToolRegistry>('tools')!
  ctx.effect(() => tools.register({
    name: 'current_time',
    description: 'Return the current time as an ISO string.',
    parameters: { type: 'object', properties: {} },
    async execute() { return new Date().toISOString() },
  }))
}
app.inject(['tools'], clockTool)
```

Now `schemas()` is what goes into the request. Note what it leaves out. It copies three fields and drops `execute`. That is deliberate: the request body is sent as JSON, and functions or other host-only fields have no business there. If a tool later grows extra parts, such as a time limit or a display formatter, `schemas()` still sends only those three fields.

When the model replies with a tool call, the loop looks it up:

```ts
const tool = registry.get(call.name)
if (!tool) return { role: 'tool', toolCallId: call.id, content: `Error: unknown tool "${call.name}"` }
```

Trace it. Suppose the model asks for `current_tme`, a typo. `get` returns `undefined`, and the model receives a tool error result naming the tool it asked for. It can correct itself on the next step. The loop does not crash.

One cost is easy to miss. Every schema is sent with every request, so each registered tool costs tokens on every step, even when unused. Ten tools with long descriptions can take a noticeable slice of the context window.

To give each agent its own tools, apply the agent scope idea: keep one global map plus one map per scope, and let a scoped entry shadow a global one with the same name. The simple version above has only the global layer.

> **Key idea:** A tool registry is a service mapping names to tools; plugins register tools with a disposer, the model receives only each tool's name, description and parameters, and calls are dispatched by name.

**In DeepSeek Harness:** a tool definition holds the model-facing schema plus host-only parts such as an output renderer, `execute(args, exec)`, an optional `timeoutMs` and `isConcurrencySafe(args)` (`docs/subsystems/tools.md`). Registration is tied to the plugin's lifetime, and `ToolsService.schemas()` projects only `name`, `description`, `parameters` and a `deferLoading` flag "so callbacks never leak". Each agent can have allow and deny lists. Changing the registered tools also changes the start of every later request, which providers notice; a later module explains why that costs money. An unknown name produces `unknown tool "x"` (`packages/core/tools/src/contracts.ts`).

## What you have now

Tools now live in one registry service, registered by plugins with disposers, and shown to the model only as schemas. This joins tool schemas to services. But the model can send arguments that do not match the schema at all: a missing field, or a number where text was expected. What should happen before `execute` sees them?
