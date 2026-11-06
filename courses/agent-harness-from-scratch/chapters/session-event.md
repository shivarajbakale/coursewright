# Session event: one recorded fact such as a message or result

Your event log is an append-only list of `{ type, data }` facts. That is enough to store things, but not enough to rely on. Which fact came first if two were added in the same millisecond? When did a slow tool start? What kinds of fact are there, and what does each one carry? Code that reads the log needs firm answers before it can trust it.

## The same envelope around every fact

Think of letters in the post. Every envelope has the same things on the outside: a postmark with a date, a tracking number, and an address that tells the sorter what to do with it. What is inside differs from letter to letter. The sorting office handles every envelope the same way without opening it.

A recorded fact gets the same treatment. Every one has the same outer fields, and only `data` differs:

```ts
// src/types.ts
export type SessionEvent = {
  seq: number    // 1, 2, 3, ... position in the log, no gaps
  time: string   // when it was recorded, ISO 8601
  type: string   // which kind of fact, e.g. 'tool/result'
  data: unknown  // the fact itself; its shape depends on type
}
```

The **sequence number** `seq` is the fact's position: the first fact is 1, the next 2, and so on, with no gaps. Order is the most important thing a log records, and a clock is not a safe way to keep it, because two facts can share a timestamp. With `seq`, order is never in doubt, a missing number shows that something was lost, and other code can point at a fact by its number. `time` is for people: debugging, and measuring how long a step or a tool took.

The post picture stops holding at one point: a sorter does not care what is inside an envelope, but code reading your log must understand every `type` it meets. If it finds a type it does not know, the safe move is to stop with an error rather than skip it and continue with a gutted conversation.

`Session.append` now fills in the envelope:

```ts
append(type: string, data: unknown): SessionEvent {
  const event = { seq: this.events.length + 1, time: new Date().toISOString(), type, data }
  this.events.push(Object.freeze(event))
  return event
}
```

## The kinds of fact an agent records

`minidsh` uses eight types. Four mark structure: `turn/start` and `turn/end` (with a `reason` such as `'completed'`), `step/start` and `step/end`. Each carries the turn number, and the step ones carry the step number too. Four record content: `user/message`, `assistant/message`, `tool/call` and `tool/result`. Here is one turn where the model uses one tool:

```text
seq type               data
1   turn/start         { turn: 1 }
2   step/start         { turn: 1, step: 1 }
3   user/message       { message: { role: 'user', content: 'How many lines in notes.txt?' } }
4   assistant/message  { message: { role: 'assistant', content: '',
                           toolCalls: [{ id: 'call_1', name: 'count_lines',
                                         arguments: '{"path":"notes.txt"}' }] } }
5   tool/call          { callId: 'call_1', name: 'count_lines', arguments: '{"path":"notes.txt"}' }
6   tool/result        { message: { role: 'tool', toolCallId: 'call_1', content: '42' } }
7   step/end           { turn: 1, step: 1 }
8   step/start         { turn: 1, step: 2 }
9   assistant/message  { message: { role: 'assistant', content: 'notes.txt has 42 lines.' } }
10  step/end           { turn: 1, step: 2 }
11  turn/end           { turn: 1, reason: 'completed' }
```

Read it top to bottom and the whole turn is there: two steps, one tool call, one answer.

Why is `tool/call` (seq 5) separate from the assistant message (seq 4) that already lists the call? Seq 4 records what the model asked for. Seq 5 records that your program actually started running it. Usually both appear together. When something goes wrong between them, the difference tells you whether the tool ever ran.

> **Key idea:** A session event is one recorded fact in a shared envelope: a sequence number giving its position, a time, a type naming the kind of fact, and data whose shape that type decides.

**In DeepSeek Harness:** events are defined in `packages/core/session/src/types.ts`. The envelope is `{type, seq, time, data}` plus a few optional fields. Beyond these eight types it records `system/message` (the system prompt as a history entry), `assistant/attempt` (a model reply that failed and is not shown to the model), and `request/header` (the settings and tool schemas sent). An event type that the reader does not know and that is not marked `ignorable` makes the reader refuse to rebuild the session.

## What you have now

Every fact in the event log is now a typed session event with a position, a time and a kind, and a turn reads as a clear sequence of them. The loop still needs a message array to send to the model. How do you turn these events back into exactly the messages the model should see?
