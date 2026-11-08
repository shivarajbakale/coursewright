# Model-visible means logged: every request can be rebuilt from the record

The session now holds typed events, but the loop still keeps its own `messages` array and sends that. Suppose a helper adds one more line before each request: `messages.push({ role: 'user', content: 'The time is 10:42.' })`. The model then answers "Good morning". A week later you read the record to learn why. The record has no event about the time, so the answer looks like a mistake. The record and the request disagree, and nothing in the record can tell you what the model saw.

## The court transcript

A court keeps a transcript. A rule goes with it: a statement counts only if it is in the transcript. A judge may not decide on a private note passed across the bench. Because of this rule, anyone can read the transcript later and see everything the decision rested on.

The comparison differs in one way. In court, the clerk writes while people speak. In the agent, the program writes the fact first, and only then can the model see it.

The agent needs the same rule. Anything that reaches the model must first be an event in the session. The request is then built from the session alone.

```inkling
title "Two ways to send the time"
steps auto
layout compare
columns "Added beside the record", "Written to the record first"
row "Request can be rebuilt": no, yes!
row "Record and request can disagree": yes, no
row "Explains a past answer": no, yes
```

## The loop that writes first

Here is one step of the loop in `src/loop.ts`, rewritten so it never keeps a separate array. `messagesFrom(session)` builds the message list from the events; the next lesson writes it.

```ts
async function runStep(session: Session, turn: number, step: number) {
  session.append('step/start', { turn, step })
  const reply = await callModel(messagesFrom(session), tools)
  session.append('assistant/message', {
    turn, step, content: reply.content, stop_reason: reply.stop_reason,
  })
  for (const block of reply.content) {
    if (block.type !== 'tool_use') continue
    session.append('tool/call', { turn, step, callId: block.id, name: block.name, input: block.input })
    const output = await runTool(block.name, block.input)
    session.append('tool/result', { turn, step, callId: block.id, content: output })
  }
  session.append('step/end', { turn, step })
  return reply.stop_reason
}
```

The time line now goes in as an event before the step: `session.append('user/message', { text: 'The time is 10:42.' })`. Follow what changes:

1. Append the time as a `user/message` event. It gets the next sequence number, say 12.
2. Build the request from the session. The time message is in it because event 12 is in the session.
3. Read the session a week later. Event 12 shows the model was told 10:42, so "Good morning" makes sense.

You can test the rule. Save the exact messages each request sent. Later, run `messagesFrom` over the events that existed at that moment. The two lists must be equal, byte for byte. If they differ, some input reached the model without an event.

The rule has a cost. Every new kind of input, such as a file change notice or the current time, needs an event type before the model can see it. That cost is small next to a record you cannot trust.

> **Key idea:** Model-visible means logged: anything the model sees is first written as an event, so every request can be rebuilt from the session alone.

## How dsh does it

`docs/architecture.md` (line 130) states the rule as "Model-visible means logged. Every model request must be reconstructable from the log. New model-visible inputs require session events." In `packages/core/agent-loop/src/agent.ts`, the request settings are first written as a `request/header` event (lines 677-690). The request's messages then come from `session.deriveMessages()` (line 728) and are frozen, so no code can add a message to the request after it was built.

## What you have now

You have a rule that joins the session to every request: the model sees only what the events hold. The loop now depends on `messagesFrom`, which does not exist yet. How do you turn a list of events, including turn and step markers, into the exact messages the model expects?
