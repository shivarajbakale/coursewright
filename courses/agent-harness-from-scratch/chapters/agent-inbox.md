# Agent inbox: messages waiting for an agent to pick up

Until now a turn starts because your code calls the loop with the person's message. But people do not wait politely. They type a correction while a tool is still running, or a second request before the first answer is done. Other parts of your program will soon want to hand the agent a message too. Where does a message go when the agent is busy, and when does the model get to read it?

## Two trays on a desk

Picture a desk with two trays. One says "next meeting": requests that should start a fresh piece of work once the current one is finished. The other says "pass me a note now": short notes you want read at the very next pause, inside the work already going on. When the desk is empty and someone drops a request in, the person at the desk gets up and starts.

```inkling
title "The agent inbox: two trays feeding the loop"
layout down
inbox: db "Inbox" blue
nextturn: box "Next-turn tray\nfollowup" yellow
nextstep: box "Next-step tray\nsteer, inject"
agent: box "Agent loop" green
loop: circle "runTurn"
model: box "Model request"
log: db "Event log\nuser/message"
nextturn -> loop : "claims one, starts a turn"
nextstep -> loop : "joins the next step"
loop -> model : "history + claimed messages"
model -> log : "appended as user/message"
loop -> agent : "turn ends"
agent -> loop : "next turn if tray not empty"
circle loop
note nextstep "a note joins the current turn, not a side chat"
step 1: nextturn "A followup waits for a fresh turn"
step 2: nextstep "A steer waits for the next step"
step 3: loop "The loop claims one next-turn message"
step 4: model "The model request carries history and claimed notes"
step 5: log "Each claimed message is logged as a user message"
```

The picture stops holding in one place. A note in the second tray is not a side conversation. It becomes part of the record, exactly like anything the person typed, and the model reads it as a user message.

Here is the smallest version for `minidsh`, in `src/agents.ts`:

```ts
import type { Message } from './types.ts'
import { runTurn } from './loop.ts'

export class Inbox {
  nextTurn: Message[] = []   // each one starts a new turn
  nextStep: Message[] = []   // all of them join the next model request

  claim(kind: 'next-turn' | 'next-step'): Message[] {
    const taken = this.nextStep.splice(0)
    if (kind === 'next-turn') {
      const first = this.nextTurn.shift()
      if (first) taken.push(first)
    }
    return taken
  }
  get empty() { return this.nextTurn.length === 0 && this.nextStep.length === 0 }
}

export class Agent {
  inbox = new Inbox()
  running = false
  followup(m: Message) { this.inbox.nextTurn.push(m); void this.wake() }
  steer(m: Message)    { this.inbox.nextStep.push(m); void this.wake() }
  inject(m: Message)   { this.inbox.nextStep.push(m) }   // no wake

  private async wake() {
    if (this.running) return          // the running loop will claim it
    this.running = true
    while (!this.inbox.empty) await runTurn(this)
    this.running = false
  }
}
```

`runTurn` from the turn lesson changes shape: it now takes the agent instead of the person's text, and reads its input from the inbox. At the start of a turn it calls `claim('next-turn')`. Before every later step it calls `claim('next-step')`. Each claimed message is appended to the event log as a `user/message` event, so the derived history picks it up like any other message. And a turn may only end when the model answered in plain text and the next-step tray is empty; otherwise it takes one more step.

## A short trace

1. The agent is idle. You send a followup: "list the files". `wake` starts a turn, which claims it.
2. Step 1: the model asks for the `ls` tool. While it runs, you steer: "only `.ts` files".
3. Before step 2, `claim('next-step')` takes your note. It is logged, and the model sees it in the request.
4. Meanwhile you send another followup: "then count their lines". It waits in the next-turn tray.
5. Turn 1 ends. The `while` loop sees the inbox is not empty and starts turn 2 with that request.

`inject` is the quiet one. It adds a note without waking anything, so it rides along with whatever request happens next.

> **Key idea:** An agent inbox is a pair of queues in front of the loop: a **followup** waits to start the next turn, a **steer** joins the very next step of the current turn, and both are logged as user messages when claimed.

**In DeepSeek Harness:** the inbox lives in `packages/core/agent-loop/src/inbox.ts`, with the two queues `nextTurn` and `nextStep`. `followup`, `steer` and `inject` are methods on the agent in `packages/core/agent-loop/src/agent.ts` (around lines 179-187). Claiming for a new turn takes every next-step message plus one next-turn message, the same rule as above. Of `inject` the code says "it lands in the next admitted request". Cancelling a turn clears the inbox unless the caller asks to keep it.

## What you have now

The agent no longer needs to be called directly. It reacts to whatever lands in its inbox, and each claimed message flows through the turn and the event log from earlier lessons, so a correction mid-turn never escapes the record. That raises a new possibility: what if the agent itself wants to hand one self-contained piece of work to a fresh helper with an empty context?
