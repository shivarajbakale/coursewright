# JSON-RPC over stdio: the SDK talking to the harness

The headless runner takes one task and exits. A Python script that reviews 50 pull requests wants one agent that stays alive. It sends a prompt, watches the events, sends the next prompt, and stops the agent at the end. Starting a new process for each prompt loses the live agent each time. How can another program hold one agent open and talk to it?

## A walkie-talkie with numbered messages

Think of two people with walkie-talkies on one channel. A question carries a number: "question 7, what is the time?" The answer carries the same number: "answer 7, ten past four". Because of this, two questions can be open at once, and neither person mixes up the answers. Some messages need no answer: "the truck has arrived". In the harness, the client program is one person, the harness is the other, and the channel is the pipe between them. The comparison differs in one way: a walkie-talkie lets one person talk at a time, but both pipes carry messages at the same moment.

## The pieces

The client starts the harness as a **child process**, a program it launched and whose input and output it controls. **Stdio** means a process's standard input and standard output. The client writes to the harness's standard input and reads its standard output.

**JSON-RPC** is a small standard for those messages. Each message is one JSON object on one line, so a reader splits the stream at each newline. There are three shapes:

- A request has an `id`, a `method` and `params`. It wants an answer.
- A response has the same `id` and either a `result` or an `error` with a numeric `code`.
- A notification has a `method` and `params` but no `id`. Nobody answers it.

The transport in `src/rpc.ts` reads lines and sorts them by shape:

```ts
export class LineTransport {
  private buffer = ''
  constructor(private input: Readable, private output: Writable,
              private onRequest: (method: string, params: any) => Promise<unknown>) {
    input.on('data', (chunk) => { this.buffer += chunk; this.drain() })
  }
  private drain() {
    let newline
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (line) void this.handle(JSON.parse(line))
    }
  }
  private async handle(frame: any) {
    if (frame.id === undefined || frame.method === undefined) return
    try {
      this.write({ jsonrpc: '2.0', id: frame.id, result: await this.onRequest(frame.method, frame.params) })
    } catch (error) {
      this.write({ jsonrpc: '2.0', id: frame.id, error: { code: -32603, message: String(error) } })
    }
  }
  notify(method: string, params: object) { this.write({ jsonrpc: '2.0', method, params }) }
  private write(message: object) { this.output.write(JSON.stringify(message) + '\n') }
}
```

`src/sdk-server.ts` connects it to the agent registry. It forwards every `session/event` as a `session.event` notification, and it answers `session/prompt` by creating the agent if needed and calling `followup`. Because standard output carries the protocol, nothing else may print there; logs go to standard error.

A short exchange, one line each:

```
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"cwd":"/work","provider":"deepseek","model":"deepseek-flash"}}
← {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"mini-dsh","version":"0.1.0"}}}
→ {"jsonrpc":"2.0","id":2,"method":"session/prompt","params":{"sessionId":"s1","contentBlocks":[{"type":"text","text":"How many lines are in notes.txt?"}]}}
← {"jsonrpc":"2.0","id":2,"result":{"messageId":"m1"}}
← {"jsonrpc":"2.0","method":"session.event","params":{"sessionId":"s1","event":{"type":"turn/start","seq":2}}}
```

1. Send `initialize` with id 1. The server records the working folder and the model.
2. Read response 1. The handshake is done.
3. Send `session/prompt` with id 2. Session `s1` does not exist, so the server creates it.
4. Read response 2 at once. It only says the message is queued; the turn has not ended.
5. Read `session.event` notifications. They carry each event of the turn, and the client calls `session/wait` to know when the agent is idle.

> **Key idea:** JSON-RPC over stdio sends numbered requests, matching responses and unanswered notifications as one JSON object per line through a child process's input and output.

## How dsh does it

`packages/sdk/protocol/src/transport.ts` is the line transport. It ignores a line that is not valid JSON and answers a failed handler with `-32603`. `protocol/src/types.ts` (lines 194-219) lists the methods: `initialize`, `session/prompt`, `session/query`, `session/resume`, `session/wait`, `shutdown`, and notifications such as `session.event` and `session.status`. `packages/sdk/server/src/server.ts` forwards every session event (line 171) and turns a prompt into `followup` (line 279). `packages/sdk/client/src/launch.ts` starts dsh with `--profile sdk`.

```inkling
title "dsh's SDK packages"
client: box "packages/sdk/client"
protocol: box "packages/sdk/protocol"
server: box "packages/sdk/server"
agents: box "ctx.agents"
client -> server : "requests on stdin"
server --> client : "responses, notifications on stdout"
client -> protocol : "shared types"
server -> protocol : "shared types"
server -> agents : "create, followup"
step 1: client "The SDK client starts dsh with the sdk profile"
step 2: server "The server reads requests from standard input"
step 3: protocol "Both sides use one set of message types"
step 4: agents "Prompts become followups on a live agent"
```

## What you have now

The headless runner showed the harness as one command. Now the same agents and live event stream reach another program through a long-lived child process. dsh designed these methods for its own SDK. How does a program that already speaks a shared, public agent protocol drive dsh?
