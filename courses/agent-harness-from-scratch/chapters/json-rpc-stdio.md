# JSON-RPC over stdio: driving the harness from another program

A code editor wants an agent panel. A test suite wants to drive `minidsh` step by step. Neither wants to open a browser or scrape text from a terminal. The simplest channel between two programs on one machine is already there: one program starts the other as a child process and talks over its standard input and output, the "stdio" streams every process has. But raw text on a pipe is not enough. The caller sends several requests, the agent's events arrive in between, and each answer must be matched to the request that asked for it. What format makes that work?

## Numbered tickets

Picture a deli counter that hands out numbered tickets. You ask for something and get ticket 7. Whatever comes back later is labelled 7, so you know it is yours even if other orders were served first. The counter also calls out announcements with no number, like "fresh bread out now", which need no reply.

That is **JSON-RPC 2.0**, a small standard for messages written as JSON. A request has `"jsonrpc": "2.0"`, an `id`, a `method` name and `params`. The response carries the same `id` and either a `result` or an `error`. A message with a `method` but no `id` is a notification: nobody replies to it. Over stdio, each message is one line of JSON, so a newline marks where one ends.

The picture stops holding in one place. At a deli, other noises in the room do not matter. Here, standard output is the protocol, so nothing else may write to it. Every log line must go to standard error, or the caller will fail to parse it.

Add a `--stdio` mode to `src/cli.ts`:

```ts
import readline from 'node:readline'

const send = (msg: object) =>
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n')

ctx.on('session/event', (s, event) => send({ method: 'session/event', params: event }))

readline.createInterface({ input: process.stdin }).on('line', async line => {
  const req = JSON.parse(line)
  try {
    if (req.method === 'initialize')
      return send({ id: req.id, result: { name: 'minidsh', protocolVersion: 1 } })
    if (req.method === 'session/prompt') {
      agent.followup({ role: 'user', content: req.params.text })
      return send({ id: req.id, result: {} })
    }
    if (req.method === 'session/wait') {
      await agent.whenIdle()
      return send({ id: req.id, result: { text: agent.lastAssistantText() } })
    }
    send({ id: req.id, error: { code: -32601, message: 'Method not found' } })
  } catch (e) {
    send({ id: req.id, error: { code: -32603, message: String(e) } })
  }
})
```

The codes `-32601` (method not found) and `-32603` (internal error) are fixed by the JSON-RPC standard, so any client library understands them.

## One exchange

The editor runs `npx tsx src/cli.ts --stdio` and writes, one line each:

1. `{"jsonrpc":"2.0","id":1,"method":"initialize"}`. It reads back a line with `"id":1` and the server name.
2. `{"jsonrpc":"2.0","id":2,"method":"session/prompt","params":{"text":"add a test"}}`. It gets `"id":2` with an empty result at once.
3. `{"jsonrpc":"2.0","id":3,"method":"session/wait"}`. No answer yet.
4. Meanwhile, notification lines arrive with `"method":"session/event"`, one per logged event, with no `id`.
5. When the agent goes idle, a line with `"id":3` arrives, holding the final text.

The response to request 3 came after several notifications, and the editor still matched it by `id`.

> **Key idea:** JSON-RPC over stdio lets another program drive the harness by starting it as a child process and exchanging one JSON message per line on its standard input and output: requests and responses matched by `id`, and events sent as notifications without one.

**In DeepSeek Harness:** the SDK protocol (`packages/sdk/protocol/src/types.ts`) defines methods including `initialize`, `session/prompt`, `session/query`, `session/resume` and `session/wait`. `packages/sdk/server` answers them and `packages/sdk/client` spawns `dsh` and talks to it. Editors use the Agent Client Protocol, another JSON-RPC protocol over stdio, in `packages/acp/acp`; `updates.ts` maps events to updates such as `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update` and `usage_update`. The protocols work in both directions: `subagent-dsh-sdk` and `subagent-acp` let dsh run another agent as a helper over the same protocols.

## What you have now

`minidsh` now has three front ends, a script runner, a browser page and a protocol for other programs, all built on the same inbox and live event stream. Every part of the system is in place. What does one request look like as it travels through all of them, from the moment it is typed?
