# Agent Client Protocol: an editor driving the agent

With JSON-RPC over stdio, a program can keep a dsh agent alive and send it prompts. But those methods are dsh's own. A code editor that supports ten different agents cannot learn ten different sets of methods. Each agent would need its own plugin in each editor. How can one client drive many different agents?

## One plug for every lamp

Think of the wall sockets in one country. Every lamp has the same plug, and every socket has the same holes. A lamp maker does not ask which house the lamp is for. In the field, the editor is the socket, each agent is a lamp, and the shared plug shape is the protocol.

The comparison differs in one way. A plug either fits or does not. An agent can tell the client which optional features it has, for example image prompts.

## The protocol

**ACP**, the Agent Client Protocol, is a public standard for this plug. It uses the same JSON-RPC lines over a child process's standard input and output. Every ACP agent answers the same fixed method names. Here they are.

- `initialize` returns the protocol version and the agent's capabilities.
- `session/new` takes a working folder and returns a session id.
- `session/prompt` sends prompt blocks. Its response comes only when the turn ends, and it carries a `stopReason`.
- `session/update` is a notification from the agent. It carries pieces such as `agent_message_chunk`, `agent_thought_chunk`, `tool_call` and `tool_call_update`.
- `session/cancel` is a notification from the client that stops the current turn.

The important difference from dsh's own methods is the prompt response. dsh's `session/prompt` answers at once with a message id. ACP's `session/prompt` stays open until the turn is over. Because of this, a session has at most one prompt open at a time.

In mini-dsh, `src/acp.ts` maps ACP onto the agent registry with the same `LineTransport` from `src/rpc.ts`:

```ts
async function prompt(params: { sessionId: string; prompt: ContentBlock[] }) {
  const agent = ctx.agents.get(params.sessionId)
  if (agent === undefined) throw new Error('unknown session')
  if (inFlight.has(agent.id)) throw new Error('a prompt is already in flight for this session')
  inFlight.add(agent.id)
  const firstSeq = agent.session.all().length
  agent.followup(params.prompt)
  await agent.whenIdle()
  inFlight.delete(agent.id)
  const end = agent.session.all().slice(firstSeq).findLast((e) => e.type === 'turn/end')
  return { stopReason: toStopReason(end?.data.reason) }
}

function toStopReason(reason?: TurnEndReason): 'end_turn' | 'max_tokens' | 'cancelled' {
  if (reason?.kind === 'max-tokens') return 'max_tokens'
  if (reason?.kind === 'interrupted') return 'cancelled'
  return 'end_turn'
}
```

A `session/event` listener turns each committed event into an update. An `assistant/message` becomes `agent_message_chunk` updates. A `tool/call` becomes `tool_call`, and a `tool/result` becomes `tool_call_update`.

Trace one prompt from an editor:

1. Send `session/new` with folder `/work`. The agent registry creates an agent, and the response carries id `s1`.
2. Send `session/prompt` with id 5 and the text "How many lines are in notes.txt?". The bridge calls `followup` and waits.
3. Read a `tool_call` update for `count_lines`. Then read a `tool_call_update` with the result `42`.
4. Read an `agent_message_chunk` with "notes.txt has 42 lines.". Then the record gets `turn/end` with reason `completed`.
5. Read response 5. It carries `{"stopReason":"end_turn"}`, so the editor knows this prompt is done.

> **Key idea:** ACP is a public JSON-RPC protocol, so any client can create sessions, send prompts and read updates from any agent that speaks it.

```inkling
title "Two protocols on one pipe"
layout compare
columns "dsh SDK methods", "ACP"
row "Who defines them": "dsh", "a public standard"
row "Prompt response": "message id at once", "stop reason at turn end"
row "Prompts open per session": "many queued", "one"
row "Live news": "every session event", "updates for clients"
steps auto
```

## How dsh does it

The file `packages/acp/acp/src/index.ts` builds the ACP side with the official `@agentclientprotocol/sdk` library. It connects that side to standard input and output with `ndJsonStream` (line 374). `src/session.ts` refuses a second prompt that is already in flight (line 225) and calls `this.agent.followup` (line 275). `src/updates.ts` derives every update from committed session events, not from live frames. `src/codec.ts` maps `completed` to `end_turn`, `max-tokens` to `max_tokens` and `interrupted` to `cancelled`. Its README says dsh's ACP server targets programs such as test runners and dsh's own ACP subagent provider, and it leaves out dsh-specific screen data.

## What you have now

ACP puts a public set of methods on the JSON-RPC line transport, so dsh agents work with clients that dsh did not write. Both need a client that starts a child process, and a browser page cannot. How does a browser drive the agent?
