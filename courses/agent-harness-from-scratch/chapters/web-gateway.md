# Web gateway: a browser talking to the harness

A person in a browser wants to type a prompt and watch the answer arrive word by word, along with every tool call and helper. Browsers talk to servers over HTTP, where the browser asks and the server answers once. That fits a command such as "here is my prompt". It does not fit progress: hundreds of small updates the server must push over several minutes, without the browser asking for each one. How do you give the browser both?

## A counter and a phone line

Think of ordering at a shop counter: you hand over your order and get a ticket back. That is an HTTP request. Now imagine the shop also keeps a phone line open to you for as long as you stay, and calls out each step: "grinding", "brewing", "ready". That open line is a **WebSocket**: a connection that starts as an ordinary HTTP request, then stays open so either side can send a message at any time.

```inkling
title "Ticket back or a phone line"
layout compare
columns "HTTP request", "WebSocket"
row "Who speaks": "browser asks, server answers once", "either side sends any time"
row "Shape": "one answer, then closed", "stays open for the whole visit"
row "Progress": "server must wait for the whole reply", "server pushes each step as it happens"
row "Reconnect": "ask again", "resume from the last sequence number"
steps auto
```

The picture stops holding in one way. If the line drops and you call back, you do not want to hear everything again from the start, only what you missed. The event log's sequence numbers make that possible.

Here is `src/server.ts`. Node has no built-in WebSocket server, so install the small `ws` package with `npm install ws`.

```ts
import http from 'node:http'
import { WebSocketServer } from 'ws'

const agent = createAgent()

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/prompt') {
    let body = ''
    for await (const part of req) body += part
    agent.followup({ role: 'user', content: JSON.parse(body).text })
    res.writeHead(202).end()          // accepted; progress comes on the socket
    return
  }
  res.writeHead(404).end()
})

const wss = new WebSocketServer({ server, path: '/events' })
wss.on('connection', (socket, req) => {
  const after = Number(new URL(req.url!, 'http://x').searchParams.get('after') ?? 0)
  const send = (frame: object) => socket.send(JSON.stringify(frame))
  send({ kind: 'snapshot', events: agent.session.events.filter(e => e.seq > after) })
  const offEvent = ctx.on('session/event', (s, event) => {
    if (s === agent.session) send({ kind: 'event', event })
  })
  const offDelta = ctx.on('agent/assistant-stream', (a, chunk) => {
    if (a === agent) send({ kind: 'delta', chunk })
  })
  socket.on('close', () => { offEvent(); offDelta() })
})

server.listen(3000, '127.0.0.1')
```

## One visit to the page

1. The page opens `ws://127.0.0.1:3000/events`. The log holds 12 events, so the first frame is a snapshot of seq 1 to 12.
2. The person submits a prompt. The page sends `POST /prompt` with `{"text": "add a test"}` and gets `202` back at once.
3. Frames arrive: an event with seq 13, the `user/message`, then delta frames as the model writes, then seq 14, the finished `assistant/message`.
4. The laptop sleeps and the socket closes. The two listeners are removed by their disposers.
5. The page reconnects with `?after=14` and receives only the events after 14.

Two details matter. The snapshot is sent and both listeners are registered in the same synchronous block, so no event can slip in between. And the server listens on `127.0.0.1` only, because anyone who can reach `/prompt` can make the agent run commands.

> **Key idea:** A web gateway lets a browser drive the harness with plain HTTP requests for commands and follow it on one WebSocket that sends a snapshot of the log first, then every new event and stream chunk, resuming from the last sequence number after a reconnect.

**In DeepSeek Harness:** host methods are marked `@Remote`, and a build step generates typed client stubs from them. A one-shot call is `POST /api/<namespace>/<method>` with `{args}`. Streaming methods share one multiplexed WebSocket at `/api/remote.mux` (`packages/api/gateway/src/stream-protocol.ts`), so many streams use a single connection. The session controller's `follow` (`packages/api/session-controller/src/index.ts`) gives the opening snapshot, then gap-free events and cursorless stream frames. The browser app lives under `packages/client`.

## What you have now

A browser can now drive `minidsh` through the same inbox and watch it through the same live event stream as the terminal. But an editor or another program does not want to be a web page. How can a program start the harness itself and talk to it directly over its input and output?
