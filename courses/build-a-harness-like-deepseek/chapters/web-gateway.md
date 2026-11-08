# Web gateway: the browser talking to the harness

JSON-RPC over stdio and ACP both need a client that starts the harness as a child process. A web page cannot start a process. It can only make HTTP requests and open sockets to a server. Yet the browser screen wants the same things: list sessions, send a prompt, cancel a turn and follow events. How does a browser reach agents that live in a Node process?

## A hotel front desk

Think of a hotel guest who wants towels, a taxi or a late checkout. The guest does not walk into the laundry room. They call the front desk, say the room number and the request, and the desk sends it to the right team. The desk also says no to a request the guest may not make. In the harness, the browser is the guest, the gateway is the front desk, and services such as the session controller are the teams. The comparison differs in one way: a hotel desk accepts any sentence, but the gateway accepts only methods that were listed in advance, with checked argument shapes.

## Routes and remote methods

An **HTTP route** is a rule that sends requests for one path to one handler function. The gateway in `src/web.ts` owns one route, `/api/`. A request `POST /api/session/prompt` names a namespace (`session`) and a method (`prompt`). Its body is `{ "args": { ... } }`. Only methods that a service marks as remote can be called.

```ts
const remotes = new Map<string, (args: any) => Promise<unknown>>()

export function remote(namespace: string, method: string, handler: (args: any) => Promise<unknown>) {
  remotes.set(`${namespace}/${method}`, handler)
  return () => remotes.delete(`${namespace}/${method}`)
}

remote('session', 'prompt', async ({ sessionId, text }) => {
  const agent = ctx.agents.get(sessionId) ?? (await ctx.agents.resume({ sessionId })).agent
  agent.followup(text)
  return { accepted: true }
})

http.createServer(async (req, res) => {
  const handler = remotes.get(req.url!.replace(/^\/api\//, ''))
  if (req.method !== 'POST' || handler === undefined) { res.writeHead(404).end(); return }
  const { args } = JSON.parse(await readBody(req))
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(await handler(args)))
}).listen(4100)
```

The browser should not write fetch calls by hand. A build step reads the list of remote methods and writes a client stub, a small function for each method:

```ts
export const session = {
  prompt: (args: { sessionId: string; text: string }) =>
    fetch('/api/session/prompt', { method: 'POST', body: JSON.stringify({ args }) }).then((r) => r.json()),
}
```

To follow a session, mini-dsh adds `GET /api/session/follow?sessionId=s1`, which answers with server-sent events. It sends the events already in the record first, then each new session event and live frame.

Trace one prompt from the page:

1. The page calls `session.prompt({ sessionId: 's1', text: 'How many lines are in notes.txt?' })`. The stub sends `POST /api/session/prompt`.
2. The server finds the handler under `session/prompt`. Any other path gets 404.
3. The handler finds agent `s1`, or resumes it from its file, and calls `followup`.
4. The response `{ "accepted": true }` returns at once. The turn is still running.
5. The open follow stream brings `turn/start`, the text frames and `turn/end`. The page draws them.

> **Key idea:** A web gateway maps HTTP routes to listed remote methods on harness services, and generated stubs let a page call them as plain functions.

## How dsh does it

`docs/api-gateway.md` (line 166) names the layers: `remotes → gateway → connection → webserver`.

```inkling
title "dsh's web layers"
layout stack
- Browser page
- packages/api/remotes
- packages/api/gateway
- packages/client/connection
- packages/host/webserver
brace browser-page..packages-api-remotes "in the browser"
note packages-api-gateway "calls session-controller"
steps auto
```

A service marks a method with `@Remote`. The build reads its TypeScript signature and writes the client stub and argument checks. A call becomes `POST /api/<namespace>/<method>` with an `args` object (`docs/api-gateway.md`, line 126). Stream methods use a WebSocket at `/api/remote.mux`. The session controller (`packages/api/session-controller/src/index.ts`) marks `prompt` at line 467, and `src/commands.ts` calls `steer` or `followup` (line 374). Its `follow` stream (line 609) opens with a complete snapshot of the record, then sends events without gaps plus live assistant frames. `packages/host/webserver` matches exact routes first, then the longest prefix, then one fallback that serves the web app.

## What you have now

The agent registry, the live event stream and the line protocols showed how programs drive an agent. The web gateway gives the browser the same agents through HTTP routes and generated stubs. Every surface in this module is a thin layer over one agent loop. How do you prove that loop works, without paying for a real model in every test?
