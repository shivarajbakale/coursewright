# The logged system prompt: instructions stored as a message in the record

Derived history builds every message from the session. The system prompt is still outside it: the loop reads a constant and puts it in the request's `system` field. Suppose you change that constant from "You are a careful coding agent." to "You are a careful coding agent. Always run the tests." Old sessions do not show which prompt each request used. A reader who rebuilds an old request from the session uses today's prompt and gets a request that was never sent. The rule that model-visible means logged is broken for the one input that shapes every answer.

## The agenda in the minutes

Think of the minutes of a meeting. The secretary writes the agenda at the top. If the chair changes the agenda part way through, the minutes record the change at the point where it happened. A reader can then tell which agenda each decision was made under.

The comparison differs in one way. People in a meeting remember the old agenda after it changes. In mini-dsh, each request carries only the latest prompt, and the model knows nothing of the old one.

So the system prompt becomes an event, `system/message`, like any other message.

```inkling
title "The prompt goes through the session"
layout sequence
loop: box "Loop"
session: db "Session"
request: box "Request"
loop -> session : "system/message, if the text changed"
loop -> session : "user/message"
session --> request : "system field from the latest system/message"
session --> request : "messages from messagesFrom"
steps auto
```

## Writing and reading the prompt

`EventType` in `src/session.ts` gains `'system/message'`. The loop calls `logSystemPrompt` before the first step of each turn:

```ts
function logSystemPrompt(session: Session, prompt: string, turn: number) {
  const last = [...session.all()].reverse().find(e => e.type === 'system/message')
  if ((last?.data as any)?.text !== prompt) {
    session.append('system/message', { turn, step: 1, text: prompt })
  }
}

export function requestFrom(session: Session) {
  let system: string | undefined
  for (const event of session.all()) {
    if (event.type === 'system/message') system = (event.data as any).text
  }
  return { system, messages: messagesFrom(session) }
}
```

`messagesFrom` needs no change. A `system/message` event falls to its `default` case and makes no message. `requestFrom` puts the latest prompt text in the `system` field instead.

Follow three turns:

1. Start turn 1 at seq 0. No `system/message` exists, so the prompt is appended at seq 2, after the turn and step markers.
2. Start turn 2 at seq 12. The prompt text is the same, so `logSystemPrompt` appends nothing.
3. Change the prompt and start turn 3 at seq 20. The text differs, so the new prompt is appended at seq 22.

Now rebuild the second step of turn 1 from the events up to that moment. `requestFrom` finds only event 2, so the `system` field holds the old prompt. That is the prompt that request used. Rebuild a turn 3 request and it holds the new one. The session now answers "which instructions did the model have?" for every request.

`logSystemPrompt` appends only when the text changes. Because of this, a session with the same prompt for 50 turns has one `system/message`, not 50.

> **Key idea:** The system prompt is logged as a system/message event when it changes, and each request takes its system field from the latest one.

## How dsh does it

`packages/core/agent-loop/src/agent.ts` renders the prompt and appends each `system/message` it must commit (line 460), before the step's user messages. The DeepSeek adapter in `packages/llm/llm-deepseek/src/serialize.ts` turns the first system message into the request's `system` field (lines 106-114 and 151). The `deepseek-flash` model entry sets `systemPromptUpdate: 'in-history'` (`models.ts`, line 14). For it, a later prompt change goes into the history as a system update after the last user turn. Older dsh session files did not hold the prompt as a message. The package `session-format-v2-to-v3` converts them, and its summary says it "promotes system prompts into messages".

## What you have now

Every part of a request, the prompt included, now comes from the session, so any request can be rebuilt. But the session lives in memory: when the program stops, every event is lost. How do you keep the events on disk without losing the ones written just before a crash?
