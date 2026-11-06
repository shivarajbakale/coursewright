# MCP client: using tools another program provides

Every tool in `minidsh` so far is code you wrote. But useful tools already exist elsewhere: an issue tracker's search, a database browser, a browser driver. Their authors would rather not write a plugin for every harness, and you would rather not rewrite their tools. Is there a common plug that lets any harness use any tool program?

## One standard plug

Think of USB. A keyboard maker does not build a version for each laptop. They build to one standard, and any laptop with the port can use it.

The Model Context Protocol, MCP for short, is that standard for tools. An MCP server is a separate program that offers tools. An MCP client is the part of a harness that connects to it, asks for its list of tools, and calls them. The most common connection is standard input and output: the client starts the server as a child program and they exchange JSON messages through its input and output streams. Servers can also be reached over HTTP.

```inkling
title "The MCP client and one server"
layout sequence
client: box "MCP client"
srv: icon gear "MCP server"
client -> srv : "connect, exchange a greeting"
srv --> client : "server name and version"
client -> srv : "listTools"
srv --> client : "tool names and input schemas"
client -> srv : "callTool(name, arguments)"
srv --> client : "content, isError"
steps auto
```

The picture stops holding at trust. A keyboard mostly sends keystrokes. An MCP server is a running program with your user's permissions. The sandbox you built fences the commands your shell tool runs. It does not fence a server you started yourself. Adding a server is like installing any program: read what it does first.

## Mounting a server's tools

The official TypeScript package, `@modelcontextprotocol/sdk`, handles the connection. Your job is to turn each server tool into a `minidsh` tool. Add `src/mcp.ts`:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export async function mountMcpServer(server: string, command: string, args: string[], tools: ToolRegistry) {
  const client = new Client({ name: 'minidsh', version: '0.1.0' })
  await client.connect(new StdioClientTransport({ command, args }))
  const { tools: listed } = await client.listTools()
  const disposers = listed.map(t => tools.register({
    name: `mcp__${server}__${t.name}`,
    description: t.description ?? '',
    parameters: t.inputSchema,
    async execute(input, signal) {
      const res = await client.callTool({ name: t.name, arguments: input as Record<string, unknown> }, undefined, { signal })
      const text = (res.content as { type: string; text?: string }[])
        .filter(c => c.type === 'text').map(c => c.text).join('\n')
      if (res.isError) throw new Error(text)
      return text
    },
  }))
  return async () => { disposers.forEach(d => d()); await client.close() }
}
```

Trace one call to an issue-tracker server mounted as `tracker`:

```text
connect    start the server program, exchange a greeting
list       [{ name: 'search_issues', description: 'Search issues by text', inputSchema: {...} }]
register   mcp__tracker__search_issues
model  ->  mcp__tracker__search_issues {"query": "login bug"}
client ->  callTool({ name: 'search_issues', arguments: { query: 'login bug' } })
server ->  { content: [{ type: 'text', text: '#41 Login fails on Safari' }], isError: false }
result     "#41 Login fails on Safari"
```

Three choices matter. The name gets a prefix, because two servers may both offer `search`, and the model and the person should see which server a call goes to. The tool sends back the server's `inputSchema` as it is, because the server owns its own arguments. A server reply marked `isError` is thrown, so your tool pipeline turns it into a tool error result like any other failure. And since these are ordinary registered tools, the same pipeline still logs every call, asks for approval where your hooks say so, and spills huge output.

```inkling
title "One call to a mounted tool"
layout flow
model: box "Model"
tool: box "mcp__tracker__search_issues"
srv: icon gear "Tracker server"
err: box "Tool error"
step 1: model, tool "The model calls the prefixed tool with a query"
step 2: tool, srv "The tool forwards the call to the tracker server"
step 3: err "A reply marked isError becomes a tool error"
model -> tool : "query: login bug"
tool -> srv : "callTool search_issues"
srv --> tool : "content, isError"
tool --> model : "text of the issue"
tool -> err : "thrown when isError is true"
circle tool
note tool "name carries the server prefix"
```

The returned function unregisters every tool and closes the connection, so a plugin can hand it to `ctx.effect`. Mount servers when the session starts. Changing the tool list mid-session changes the start of every later request.

> **Key idea:** An MCP client connects to an external tool server through the Model Context Protocol, lists its tools, and registers each one under a server-prefixed name whose execution forwards the call to that server.

**In DeepSeek Harness:** `packages/mcp/mcp-client` mounts one plugin instance per server, under names `mcp__<serverName>__<rawName>` adjusted to DeepSeek's function-name rules. Disposing the plugin disconnects and unregisters everything. A refresh builds the complete new tool set, swaps it in, and rolls back if registration fails partway. A server's notice that its tool list changed triggers that refresh, and a failed refresh keeps the previous set. It supports standard input and output and Streamable HTTP connections. Server descriptions get their own prompt section, `MCP_SERVERS`, at order 3100.

## What you have now

You can mount another program's tools beside your own, through the same tool registry, pipeline and disposers. With prompt sections, project instructions, prompt caching, the token budget, compaction, surface replacement and skills, `minidsh` now manages what its one model sees. The next question is about more than one agent: where do messages wait when an agent is busy?
