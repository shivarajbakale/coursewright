# Session event: one typed fact in the record

The append-only log keeps facts in order, but each fact is a loose `kind` and some `text`. To rebuild a request from the record, the program must know exactly what each fact means. Was this text from the user or from the model? Which tool call does this result answer? When did it happen? A fact needs a fixed shape that the program can read without guessing.

## A form instead of a note

Think of a hospital ward. A nurse could write free notes: "gave him something for the pain, later". A ward uses a form instead. Each line has the same boxes: what was done, the line number, the time, and the details. Anyone can read any line the same way, and a missing line number shows that a line is lost.

The comparison differs in one way. A nurse fills in the form by hand and can make a mistake in it. In the program, one function fills in the number and the time, so the writer cannot get them wrong.

```inkling
title "The four parts of one event"
steps auto
layout mindmap
- Session event
  - type: what happened
  - seq: its place in the record
  - time: when it was written
  - data: the details
```

## The shape in code

In mini-dsh, the record of one conversation is a **session**, and each fact in it is an **event**. `src/session.ts` replaces the loose `Log` with this:

```ts
export type EventType =
  | 'turn/start' | 'turn/end' | 'step/start' | 'step/end'
  | 'user/message' | 'assistant/message' | 'tool/call' | 'tool/result'

export interface SessionEvent {
  readonly type: EventType
  readonly seq: number
  readonly time: number
  readonly data: unknown
}

export class Session {
  private readonly events: SessionEvent[] = []

  append(type: EventType, data: unknown): SessionEvent {
    const event = Object.freeze({
      type,
      seq: this.events.length,
      time: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
    })
    this.events.push(event)
    return event
  }

  all(): readonly SessionEvent[] {
    return [...this.events]
  }
}
```

The caller names only the type and the data. `append` sets the other two parts. Here is one turn of the question "How many lines are in notes.txt?" as events:

| seq | type | data |
| --- | --- | --- |
| 0 | `turn/start` | `{ turn: 1 }` |
| 1 | `step/start` | `{ turn: 1, step: 1 }` |
| 2 | `user/message` | `{ text: 'How many lines are in notes.txt?' }` |
| 3 | `assistant/message` | a `tool_use` block with id `call_1` |
| 4 | `tool/call` | `{ callId: 'call_1', name: 'count_lines', input: {...} }` |
| 5 | `tool/result` | `{ callId: 'call_1', content: '42' }` |
| 6 | `step/end` | `{ turn: 1, step: 1 }` |
| 7 | `step/start` | `{ turn: 1, step: 2 }` |
| 8 | `assistant/message` | the text "notes.txt has 42 lines." |
| 9 | `step/end` | `{ turn: 1, step: 2 }` |
| 10 | `turn/end` | `{ turn: 1, reason: 'completed' }` |

Each choice in the shape has a reason:

1. Use the list length as the next `seq`. Because of this, the numbers are 0, 1, 2 with no gap, and a gap means an event is lost.
2. Name the type with a slash, such as `tool/result`. The part before the slash groups related events.
3. Copy the data through JSON. A caller that changes its own object later does not change the record. Data that JSON cannot hold, such as a function, never enters the record, so the record can always be saved.
4. Mark the start and end of each turn and step. A reader can then tell a finished turn from one that stopped part way.

> **Key idea:** A session event is one fact with a type, a sequence number, a time and data; the record sets the number and time.

A **sequence number** is the event's position in the session, counted from 0. Two events never share one.

## How dsh does it

`packages/core/session/src/types.ts` lists every core event type in `SessionEventMap` (line 287), from `turn/start` to `tool/result`, and defines the envelope `SessionEvent` (line 501) with `type`, `seq`, `time` and `data`. Other packages can add their own event types to that map. In `append()` in `packages/core/session/src/index.ts`, `seq` is the current log length (line 829). The data is copied as JSON first, and data that is not JSON throws an error (lines 817-819), so a bad event fails where it is written.

## What you have now

You have a session: an append-only list of typed events, each with its own number and time. The events record what happened, but the loop still builds its requests from a separate `messages` array. What goes wrong if the model sees something the record does not hold?
