# MCP tools: outside tools as ordinary tools

With an MCP client, the harness can list a server's tools and call them. But the model does not call the client. The model calls tools from the tool registry, and every call passes the pre-execute decision, approval, the around-execute wrapper and post-execute. If server tools went around that path, an outside program would get fewer checks than a built-in tool. How does a server tool join the same path?

## A guest badge at the office

Think of an office that lets visitors work for a day. Each visitor gets a badge printed with "Visitor, from Acme". The badge opens the same doors as a staff badge, and the same guards check it. Because the company name is on it, the guards can make one rule for all visitors from Acme.

In the harness, the badge is a tool name, the doors are the tool pipeline, and the company is the server. Each server tool is registered in the tool registry under the name `mcp__<server>__<tool>`. The comparison differs in one way: two visitors can never share a badge number. When two raw names would print the same badge, the harness adds a short code that keeps them apart.

## Naming and registering

In mini-dsh, `src/mcp.ts` gets two functions:

```ts
import { createHash } from 'node:crypto'

export function publicToolName(server: string, raw: string): string {
  const joined = `mcp__${server}__${raw}`
  const normalized = joined.replace(/[^A-Za-z0-9_-]/g, '_')
  if (normalized === joined && normalized.length <= 64) return normalized
  const hash = createHash('sha256').update(`${server}\0${raw}`).digest('hex').slice(0, 12)
  return `${normalized.slice(0, 51)}_${hash}`
}

export async function syncTools(ctx: Context, client: McpClient, server: string, previous: Disposer[]) {
  const { tools } = await client.request('tools/list', {})
  const definitions = tools.map((tool) => ({
    name: publicToolName(server, tool.name),
    description: tool.description ?? '',
    parameters: tool.inputSchema,
    async execute(args: object) {
      const result = await client.request('tools/call', { name: tool.name, arguments: args })
      const text = result.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
      if (result.isError) throw new Error(text)
      return text
    },
  }))
  for (const dispose of previous) await dispose()
  const disposers: Disposer[] = []
  try {
    for (const definition of definitions) disposers.push(ctx.get<ToolsService>('tools')!.register(definition))
  } catch (error) {
    for (const dispose of disposers) await dispose()
    throw error
  }
  return disposers
}
```

DeepSeek accepts a function name of at most 64 characters, made only of letters, digits, `_` and `-`. That is why the name is cleaned and checked. Work two names:

1. Name the server `weather` and the tool `get_forecast`. The result is `mcp__weather__get_forecast`, 26 characters, unchanged.
2. Name the server `docs` and the tool `search.pages`. The dot is not allowed, so it becomes `_`. A tool named `search_pages` would print the same name. So the harness adds 12 characters of the SHA-256 hash: `mcp__docs__search_pages_23d16669848f`.

The raw name `get_forecast` goes only to the server. The model sees only the public name.

A failed server tool throws. As you saw with the tool error result, the pipeline turns a throw into an error result that the model can read. If one registration fails, the loop undoes the ones before it. So the model sees all of a server's tools or none.

```inkling
title "A server tool passes every check"
layout sequence
model: box "Model"
pipe: box "tools/pre-execute"
ask: person "ctx.approval"
client: box "mcp-client"
server: cloud "weather server"
model -> pipe : "mcp__weather__get_forecast"
pipe -> ask : "ask: any mcp__ tool"
ask --> pipe : "allow once"
pipe -> client : "execute"
client -> server : "tools/call get_forecast"
server --> client : "Rain, 14 °C"
client --> model : "tool result"
steps auto
```

> **Key idea:** Each server tool is registered under the name mcp__server__tool, so it passes the same checks as any built-in tool.

## How dsh does it

`publicToolName()` is in `packages/mcp/mcp-client/src/tools.ts` (lines 91-97). It cleans the name to `[A-Za-z0-9_-]` and appends a 12-character hash when the name changed or is longer than 64 characters. `syncTools()` (lines 126-188) builds the full list first. It throws if the server lists one raw name twice. Then it disposes the old tools and registers the new ones on `ctx.tools` (line 177). A registration conflict rolls back the partial set, so the model sees none of that server's tools. The executor throws on an MCP `isError` result (lines 323-325), so the pipeline records an error result.

## What you have now

Outside tools now join the registry with clear names and the same policies. Each tool adds a schema to every request, so many servers make a long tool list. Some help is not a tool at all, but a long set of instructions, for example how to write a release note. Must every request carry all of those instructions?
