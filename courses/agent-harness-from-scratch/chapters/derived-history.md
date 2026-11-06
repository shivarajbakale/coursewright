# Derived history: building the model's messages by reading the log

The agent loop no longer keeps its own message array. Every fact goes into the event log as a session event. But the model is a stateless model: each request must carry the whole conversation as a list of messages with roles. The log holds turns, steps, tool calls and messages, all mixed together. How do you get from one to the other?

## Read the log, keep what the model should see

Go back to the bank. Your balance is not stored anywhere. Each time you ask, the bank walks your statement from the top, adding deposits and subtracting withdrawals, and the number it ends with is your balance. Ask twice with no new lines, and you get the same number twice.

The model's messages work the same way. Before each model request, walk the log from the first event to the last. Each event either contributes one message or contributes nothing. Where the picture stops holding: a balance is one number, while here you build a list, and the order of the list matters as much as its contents.

```inkling
title "Reading the log to build messages"
layout down
log: db "Event log\n11 events" yellow
derive: box "deriveMessages\nwalk top to bottom"
visible: sticky "Message-carrying events\nuser/message\nassistant/message\ntool/result"
drop: sticky "Bookkeeping events\nturn/start, step/end\ntool/call"
req: box "Model request\nmessages array"
log -> derive : "one event at a time"
derive -> visible : "keep one message"
derive -> drop : "contributes nothing"
visible -> req : "in log order"
circle req
step 1: log "Start at the first event"
step 2: derive "Walk through each event in order"
step 3: visible "Keep events that carry a message"
step 4: drop "Skip bookkeeping events"
step 5: req "Send the derived messages with the request"
```

Three event types carry a message the model should see. Everything else, such as `turn/start`, `step/end` or `tool/call`, is bookkeeping for your program and turns into nothing:

```ts
// src/session.ts
import type { Message, SessionEvent } from './types.ts'

const VISIBLE = new Set(['user/message', 'assistant/message', 'tool/result'])

export function deriveMessages(events: readonly SessionEvent[]): Message[] {
  const messages: Message[] = []
  for (const event of events) {
    if (!VISIBLE.has(event.type)) continue
    const { message } = event.data as { message: Message }
    const empty = message.content === '' && !message.toolCalls?.length
    if (message.role === 'assistant' && empty) continue
    messages.push(message)
  }
  return messages
}
```

The empty-assistant check covers a reply with no text and no tool calls. Sending one adds nothing, and some providers reject it.

Walk it over the eleven events from the turn in the session event lesson. Seq 1 and 2 give nothing. Seq 3 gives the user's question. Seq 4 gives the assistant message holding `call_1`. Seq 5, the `tool/call`, gives nothing: the call is already inside seq 4. Seq 6 gives the tool result `'42'`. Seq 7 and 8 give nothing. Seq 9 gives the answer. Seq 10 and 11 give nothing. Eleven events, four messages:

```text
user       How many lines in notes.txt?
assistant  (tool call call_1: count_lines {"path":"notes.txt"})
tool       42            (for call_1)
assistant  notes.txt has 42 lines.
```

The loop's step now looks like this. It appends, then derives, and never holds its own copy:

```ts
const request = {
  model: 'deepseek-flash',
  thinking: { type: 'disabled' },
  messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...deriveMessages(session.events)],
  tools: toolSchemas,
}
```

## What this buys you

There is one source of truth. If a message is not in the log, the model did not see it, and if it is in the log, it was sent. Anyone holding the log can rebuild every request the loop made, which turns debugging a strange answer into reading a file.

The function is pure: same events in, same messages out. And because the log only grows at the end, each request's message list starts with exactly the previous request's list and adds to its end. That stability comes for free, and later you will see that providers reward it.

> **Key idea:** Derived history means the messages sent to the model are rebuilt from the event log before every request, by turning each message-carrying event into one message and every other event into nothing.

**In DeepSeek Harness:** `Session.deriveMessages()` in `packages/core/session` does this. It walks an ordered list of the sequence numbers of message-producing events, converts each event once and caches the result, so it does not redo the work every step. Turn, step and failed-attempt events convert to nothing, and empty assistant messages are skipped. A request is the logged settings, plus `deriveMessages()`, plus the logged tool schemas, and the docs promise that anyone holding the log "reconstructs every loop request byte-for-byte".

## What you have now

Your agent now keeps the event log as its only record and rebuilds the model's messages from it on every step, which works because the model is stateless and needs the whole conversation each time. All of this still lives in memory and vanishes when the process exits. How do you write the log to disk so that it survives?
