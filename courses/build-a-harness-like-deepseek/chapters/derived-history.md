# Derived history: building the message list from the record

The rule that model-visible means logged says every request is built from the session alone. The loop calls `messagesFrom(session)` for that, but the function does not exist yet. The session holds 11 kinds of facts for one small question: turn markers, step markers, calls, results. The model expects something else: a short list of user and assistant messages. Which events become messages, and how?

## A scoreboard from a match report

Think of a football match report that lists every event in order. It shows kick-off, a foul, a home goal, half-time and an away goal. The scoreboard is not a second record. You can always work it out by reading the report from the top and counting only the goals. Fouls and half-time are in the report but do not change the score.

The comparison differs in one way. A scoreboard keeps a running total as the match goes on. The simplest `messagesFrom` reads the whole session from the first event on every call.

## The function

Here it is in `src/session.ts`. It reads every event and keeps only the ones the model must see.

```ts
export function messagesFrom(session: Session): Message[] {
  const messages: Message[] = []
  for (const event of session.all()) {
    const d = event.data as any
    switch (event.type) {
      case 'user/message':
        add(messages, 'user', [{ type: 'text', text: d.text }])
        break
      case 'assistant/message':
        if (d.content.length > 0) add(messages, 'assistant', d.content)
        break
      case 'tool/result':
        add(messages, 'user', [{
          type: 'tool_result', tool_use_id: d.callId, content: d.content,
          ...(d.isError ? { is_error: true } : {}),
        }])
        break
      default:
        break // turn and step markers, and tool/call, are not messages
    }
  }
  return messages
}

function add(messages: Message[], role: 'user' | 'assistant', content: Block[]) {
  const last = messages.at(-1)
  if (last?.role === role) last.content.push(...content)
  else messages.push({ role, content: [...content] })
}
```

Run it over the 11 events of the notes.txt turn, seq 0 to 10:

1. Skip events 0 and 1. They mark the start of the turn and of step 1.
2. Turn event 2, the question, into a user message.
3. Turn event 3 into an assistant message with the `tool_use` block `call_1`.
4. Skip event 4. The `tool_use` block in event 3 already carries the call, and `tool/call` only records that it started.
5. Turn event 5 into a user message with a `tool_result` for `call_1`.
6. Skip events 6 and 7, then turn event 8 into an assistant message with the answer text. Skip events 9 and 10.

The result is 4 messages from 11 events. The model sees the same list as in the first agent, but no code stored that list anywhere.

`add` joins two messages in a row with the same role. A tool result and an injected note, such as the time, are both user messages. Joined, they form one user message, so the roles keep their order: user, assistant, user.

The function skips an assistant message with empty content. A step cut off before the model wrote anything still has an event, but an empty assistant message would make the request invalid.

```inkling
title "From events to messages"
layout flow
events: db "Session events\n11 events"
fn: box "messagesFrom" yellow
skip: box "Skipped\nmarkers, tool/call" gray
msgs: box "Messages\n4 messages" green
events -> fn
fn -> msgs : "user, assistant, tool result"
fn -> skip : "not model-visible"
highlight fn
step 1: events "The session holds every fact in order"
step 2: fn "One function reads them from the start"
step 3: msgs "Message events become the model's history"
step 4: skip "Markers stay in the session only"
```

> **Key idea:** Derived history is the message list built by reading the session from the start; it is never stored, so it cannot disagree with the record.

A **projection** is a view computed from a record by a fixed rule. The scoreboard is a projection of the match report. `messagesFrom` is a projection of the session.

## How dsh does it

`Session.deriveMessages()` in `packages/core/session/src/index.ts` (line 999) is dsh's projection. It caches its result. When events are only added, it projects only the new ones instead of starting again. `docs/subsystems/session.md` lists the rules: `turn/*`, `step/*` and `assistant/attempt` events produce no message, and an empty-content `assistant/message` is skipped. The messages it returns are deep-frozen, so no caller can change the history through them.

## What you have now

You have a projection that turns the session into the model's message list, so the record is the only place history lives. The request has one part left outside the session. The system prompt still goes in its own `system` field, and the loop passes it in from beside the record. Should it be an event too?
