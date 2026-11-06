# Live event stream: sending progress to a screen as it happens

Everything `minidsh` does now happens inside one process. A model reply streams in, tools run, helpers start, jobs finish, and the person sees none of it until the end. You could add `console.log` calls inside the loop. But soon there will be more than one screen: a terminal, a browser page, another program. If the loop prints for each of them, the core has to know about every screen, and adding a new one means editing the loop. How can the core report progress without knowing who is watching?

## The scoreboard and the commentary

Think of a football match. The scoreboard shows the official facts: goals, cards, the clock. Anyone arriving late reads the scoreboard and knows where things stand. Alongside it, a radio commentator describes every pass as it happens. The commentary is lively, but nobody keeps it; if you missed it, the scoreboard still tells you the score.

```inkling
title "Two channels of progress"
layout compare
columns "Event log", "Stream chunks"
row "What arrives": "recorded facts", "live pieces"
row "Kept": "yes", "no"
row "Use for": "replay and catch-up", "immediate display"
row "Has sequence": "yes", "no"
step 1: event-log, what-arrives "Facts are recorded"
step 2: stream-chunks, what-arrives "Pieces arrive live"
```

`minidsh` has both already. The scoreboard is the event log: every `user/message`, `tool/call` and `tool/result` is a recorded fact. The commentary is the stream chunks: the `text-delta` pieces that arrive before the message assembler builds the finished `assistant/message`. The deltas are never logged, because the finished message is.

The picture stops holding in one place. Nobody owns the stadium speakers. The core does not send to anyone. It announces on the plugin kernel's event hooks, and each screen subscribes.

```inkling
title "How screens receive progress"
layout flow
core: box "Core loop"
hook: round "Event hooks"
screen: box "Screen plugin"
core -> hook : "emit facts and chunks"
hook -> screen : "subscribed events"
note core "no screen names inside"
circle hook
step 1: core "The core records and streams"
step 2: hook "It announces through event hooks"
step 3: screen "Each screen subscribes"
```

```ts
// src/session.ts: announce every fact right after it is appended
append(type: string, data: unknown) {
  const event = { seq: ++this.seq, time: new Date().toISOString(), type, data }
  this.events.push(event)
  this.ctx.emit('session/event', this, event)
  return event
}

// src/loop.ts: announce each piece while streaming
for await (const chunk of adapter.stream(request)) {
  assembler.push(chunk)
  ctx.emit('agent/assistant-stream', agent, chunk)
}

// a terminal screen, written as a plugin
ctx.on('agent/assistant-stream', (agent, chunk) => {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.text)
})
ctx.on('session/event', (session, event) => {
  if (event.type === 'tool/call') console.log(`\n[tool] ${event.data.name}`)
})
```

## One reply, both channels

The person asks "what is in src?". Here is what a subscriber sees, in order:

1. `session/event` with `user/message`, seq 1.
2. `agent/assistant-stream` chunks: a `tool-call-delta` or two, then `finish`.
3. `session/event` with `assistant/message`, seq 2, holding the finished tool call.
4. `session/event` with `tool/call`, seq 3, then `tool/result`, seq 4.
5. More `text-delta` chunks: "src has", " three files", "...".
6. `session/event` with `assistant/message`, seq 5, holding the whole text.

A screen that drops a delta loses nothing important: step 6 repeats the full text. A screen that opens halfway through first reads the log so far, a **snapshot**, then listens for events with a higher `seq`. The `seq` acts as a cursor. Deltas have no `seq`, since they are not facts.

> **Key idea:** A live event stream is the core announcing two things for any screen to subscribe to: every recorded event, with its sequence number, right after it is appended, and every stream chunk as it arrives, which is shown live but never recorded.

**In DeepSeek Harness:** screens subscribe to the same kernel events: `session/event`, `agent/assistant-stream` (`packages/core/agent-loop/src/assistant-stream.ts`), `agent/status` and `agent/error`. The design rule is quoted in the project's notes: "a durable, replayable fact is a SessionEvent; a live interception or a transient/live-object signal is an agent/tools Cordis event." The session controller's `follow` method (`packages/api/session-controller/src/index.ts`) returns "a complete opening snapshot followed by gap-free durable event frames and optional cursorless assistant-stream frames", and a client that reconnects passes its last cursor.

## What you have now

The core now reports everything through event hooks: facts from the event log, and stream chunks as they arrive. Any screen is a plugin that listens. The first screen to build has no screen at all: how do you run one task from a script, print the answer, and know when every agent is truly finished?
