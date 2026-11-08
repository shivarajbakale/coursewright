# MCP client: talking to a tool server

Every tool so far lives inside the harness: a plugin calls `defineTool` and registers it. But useful tools are often written by other people, in other languages: a database browser, an issue tracker, a weather service. Copying each one into the harness as a plugin does not scale. How can the harness use a tool that lives in another program?

## A power socket

Think of a power socket in the wall. The lamp maker and the electricity company never meet. They agree on one shape for the plug and one voltage, and any lamp works in any socket.

In the harness, the socket is a protocol: the **Model Context Protocol**, or **MCP**, a public standard for how a program offers tools to an agent. The lamp is a tool server, a separate program that offers tools. The harness is the house wiring, and the part of the harness that plugs a server in is an MCP client. The comparison differs in one way: a socket gives the lamp power, but here the harness asks questions. It asks the server what tools it has, and then asks it to run one.

## Three messages

The client starts the server as a child process, then they exchange JSON messages, one per line, over the child's input and output streams. Each request carries an `id`, and the reply carries the same `id`, so many requests can wait at the same time. Here is a minimal client in mini-dsh, `src/mcp.ts`:

```ts
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'

export class McpClient {
  private nextId = 1
  private waiting = new Map<number, (result: unknown) => void>()
  private child: ChildProcess

  constructor(command: string, args: string[]) {
    this.child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] })
    createInterface({ input: this.child.stdout! }).on('line', (line) => {
      const message = JSON.parse(line)
      const resolve = this.waiting.get(message.id)
      if (resolve === undefined) return            // a notice, not a reply
      this.waiting.delete(message.id)
      resolve(message.result)
    })
  }

  request(method: string, params: object): Promise<any> {
    const id = this.nextId++
    // "jsonrpc": "2.0" is the protocol's fixed version tag on every message
    this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    return new Promise(resolve => this.waiting.set(id, resolve))
  }
}
```

Trace one weather server, started as `node weather.js`:

1. Send `initialize` with id 1. The server replies with its name and what it supports, for example that it has tools.
2. Send `tools/list` with id 2. The reply is a list with one tool: `get_forecast`, a description, and a JSON Schema with one required string, `city`.
3. Send `tools/call` with id 3, the name `get_forecast` and the arguments `{ "city": "Paris" }`. The reply is `{ content: [{ type: "text", text: "Rain, 14 °C" }] }`.
4. If the tool fails, the reply has `isError: true` and text that explains the failure.

```inkling
title "One server, three requests"
layout sequence
harness: box "MCP client"
server: box "Tool server"
harness -> server : "initialize"
server --> harness : "name, can offer tools"
harness -> server : "tools/list"
server --> harness : "get_forecast + schema"
harness -> server : "tools/call Paris"
server --> harness : "Rain, 14 °C"
steps auto
```

The list looks like a tool schema because it is one: a name, a description and a JSON Schema. A server can also send a notice that its list changed, and the client then asks for the list again.

> **Key idea:** An MCP client starts a tool server, asks for its tool list, and sends it calls in the shared Model Context Protocol format.

## How dsh does it

```inkling
title "MCP packages in dsh"
layout down
manager: box "mcp-manager"
client: box "mcp-client, one per server"
sdk: box "@modelcontextprotocol/client"
server: cloud "Tool server"
tools: box "ctx.tools"
manager -> client : "mounts"
client -> sdk -> server
client -> tools : "register"
steps auto
```

`packages/mcp/mcp-client` is one plugin instance per server (`src/index.ts`, lines 1-5). It uses the official `@modelcontextprotocol/client` package. A server is a child process (`transport: 'stdio'`) or a web address (`streamable-http`). Each call has a 60,000 ms timeout by default (line 46). `src/tools.ts` lists tools with `client.listTools()` (line 137) and calls one with `client.callTool()` (line 154). `src/connection.ts` (line 286) asks for the list again when the server says it changed. The server's own instructions become a prompt section named `mcp:<server>` (`src/server-context.ts`, line 33). `packages/mcp/mcp-manager` mounts one client for each configured server.

## What you have now

The harness can now reach a tool in another program and ask what it does. But a list from a server is not yet something the model can call. How does a server's tool become an ordinary tool, with every policy you built for tools before?
