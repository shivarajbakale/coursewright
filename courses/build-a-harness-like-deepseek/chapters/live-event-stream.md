# Live event stream: watching the agent while it works

With the agent registry, a program can create an agent, give it a message and wait until it is idle. A person who waits for 20 seconds and sees nothing thinks the program has stopped. A screen must show the answer as it grows, and the tools as they run. But the record only gets a new event when a fact is complete. How can a screen show work that is not finished yet?

## A scoreboard and a commentator

Think of a football match on the radio. The scoreboard changes only when a goal counts: "goal 3, minute 71". The commentator talks the whole time: "he runs, he shoots". If you join late, the scoreboard tells you the true state, but the commentary you missed is gone. If the referee cancels a goal, the commentator's words stay said, but the scoreboard never shows that goal.

In the harness, the session record is the scoreboard and the stream chunks are the commentary. The comparison differs in one way: the harness tells the screen exactly when the commentary for one model request ends, and which record event, if any, holds its final result.

## Two channels

A screen listens on two channels:

1. **Session events.** Each event is a committed fact, which means it is written to the record. It has a sequence number, so a screen can see a gap and ask for the missing events.
2. **Live frames.** A frame is a small notice that carries one stream chunk while the model writes. Frames exist only inside the running process. They have no sequence number in the record, and they are not saved.

Each model request opens with a `start` frame, sends one `chunk` frame per stream chunk, and closes with an `end` frame. The `end` frame names the record event that holds the finished message. When a request fails and the harness retries it, the `end` frame names no committed message, so the screen drops its draft.

```inkling
title "Session events and live frames"
layout compare
columns "Session events", "Live frames"
row "Written to the record": yes, no
row "Has a sequence number": yes, no
row "Arrives": "when a fact is complete", "once per chunk"
row "After a restart": yes, no
steps auto
```

In mini-dsh, the loop in `src/loop.ts` sends a frame for each chunk it reads, before it appends the finished message:

```ts
ctx.emit('agent/assistant-stream', { agent, frame: { type: 'start', attempt, turn, step } })
let index = 0
for await (const chunk of ctx.llm.stream(request)) {
  ctx.emit('agent/assistant-stream', { agent, frame: { type: 'chunk', attempt, index: index++, chunk } })
  assembler.push(chunk)
}
const event = session.append('assistant/message', { turn, step, content: assembler.blocks() })
ctx.emit('agent/assistant-stream', { agent, frame: { type: 'end', attempt, index, seq: event.seq } })
```

A screen in `src/watch.ts` listens on both channels:

```ts
export function watch(ctx: Context, agent: Agent, show: (line: string) => void): () => void {
  let draft = ''
  const stopFrames = ctx.on('agent/assistant-stream', ({ agent: subject, frame }) => {
    if (subject !== agent) return
    if (frame.type === 'start') draft = ''
    if (frame.type === 'chunk' && frame.chunk.type === 'text-delta') {
      draft += frame.chunk.text
      show(`typing: ${draft}`)
    }
  })
  const stopEvents = ctx.on('session/event', (session, event) => {
    if (session === agent.session) show(`#${event.seq} ${event.type}`)
  })
  return () => { stopFrames(); stopEvents() }
}
```

Trace the question "How many lines are in notes.txt?" after the tool already ran:

1. The record gets `#9 step/start`. The screen shows it.
2. A `start` frame arrives. The screen clears its draft.
3. Two `chunk` frames bring `"notes.txt has "` and `"42 lines."`. The screen shows the text grow.
4. The record gets `#10 assistant/message`. The finished text is now a fact.
5. An `end` frame names seq 10. The draft and the fact match, so the screen keeps the fact.
6. The record gets `#11 step/end` and `#12 turn/end`. The screen shows the turn is done.

> **Key idea:** A live event stream joins committed session events, which can be read again, with live frames, which show unfinished work and then disappear.

## How dsh does it

dsh has the same two channels. `packages/core/session/src/index.ts` (line 76) declares the `session/event` notification for every appended event. `packages/core/agent-loop/src/assistant-stream.ts` wraps one model request in an `AssistantStreamAttempt`, which emits `agent/assistant-stream` frames of type `start`, `chunk` and `end` (`agent.ts` line 486). The `end` frame's outcome names the committed `assistant/message` or `assistant/attempt` event, or says that no event was committed (`packages/core/agent/src/runtime-types.ts`, line 155).

```inkling
title "Where dsh's live stream comes from"
loop: box "packages/core/agent-loop"
session: db "packages/core/session"
screen: box "A screen" yellow
loop -> screen : "agent/assistant-stream frames"
loop -> session : "append assistant/message"
session -> screen : "session/event"
circle screen
step 1: loop "The loop reads chunks from the model"
step 2: screen "Each chunk goes out as a frame"
step 3: session "The finished message is appended"
```

## What you have now

The agent registry gives you live agents, and stream chunks give you the pieces of a reply. Now any screen can follow an agent through two channels: facts from the record and frames for unfinished text. The simplest screen does not need to stay open at all. What does a program need to run one task and then stop?
