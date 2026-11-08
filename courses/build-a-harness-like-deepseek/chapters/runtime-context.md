# Runtime context: facts added before each step

With prompt sections, the system prompt is the same bytes every step. That is good for the cache. But the model sometimes needs facts that change: the current time, or how long ago the user last wrote. If such a fact went into a section, the system prompt would change on every step. Where can a changing fact go without breaking the cache?

## A note clipped to the end

Think of a letter that goes back and forth between two offices. Each office adds its reply at the bottom and never retypes the top. When the clerk wants to say "it is now 9 o'clock", the clerk clips a small note to the bottom of the letter. The top stays the same, so the other office does not read it again.

In the harness, the letter is the history, the top is the system prompt and the old messages, and the clipped note is a new user message with the fact. The comparison differs in one way: the note is not from the person. The harness writes it, and it marks the message with its source, so a screen can show it as a harness note and not as something the user typed.

## A hook that runs before each step

The harness gives plugins a place to add such notes: a waterfall hook named `agent/pre-step`. The loop runs it before each model request. Each listener calls `next()`, gets the list of new user messages for this step, and may return a longer list. The loop then appends every message in the list to the record. This hook is called the **pre-step** hook.

```ts
let lastInjection: number | undefined

ctx.on('agent/pre-step', async ({ turn, step }, next) => {
  const decision = await next()
  const now = Date.now()
  if (lastInjection !== undefined && now - lastInjection < 600_000) return decision
  lastInjection = now
  const text = `Time sampled while preparing turn ${turn}, step ${step}: ${new Date(now).toISOString()}`
  return {
    messages: [...decision.messages, { role: 'user', content: [{ type: 'text', text }], source: 'time-context' }],
  }
})
```

In `src/loop.ts`, the step runs the waterfall and logs what comes back:

```ts
const decision = await ctx.waterfall('agent/pre-step', { turn, step }, async () => ({ messages: claimed }))
for (const message of decision.messages) session.append('user/message', message)
```

Trace one session:

1. Turn 1, step 1 starts at 09:00:00. No note exists yet, so the listener adds one with the time.
2. Turn 1, step 2 starts at 09:00:05. Only 5 seconds passed, which is less than 600,000 ms (10 minutes). The listener adds nothing.
3. Turn 2, step 1 starts at 09:12:00. 12 minutes passed, so the listener adds a new note.

Each note is a `user/message` event in the record. Because of this, a later reader can rebuild the exact request the model saw, as model-visible means logged requires. The note goes at the end of the history, so every earlier byte is unchanged and the cache still matches.

> **Key idea:** Runtime context is a changing fact that a pre-step listener adds as a logged user message at the end, not in the system prompt.

```inkling
title "One step with a time note"
layout sequence
loop: box "agent-loop"
hook: box "agent/pre-step"
time: box "time-context"
log: db "Record"
loop -> hook : "new messages"
hook -> time : "next()"
time --> hook : "plus a time note"
hook --> loop : "messages"
loop -> log : "user/message"
steps auto
```

## How dsh does it

The time note comes from `packages/context/time-context/src/index.ts`. Its `agent/pre-step` listener (line 199) is registered with `prepend: true`. It skips the note when the last one is newer than `refreshIntervalMs`, which defaults to 600,000 ms (line 135). The text starts with "Time sampled while preparing turn N, step S". Other facts, such as the working directory and the sandbox policy, register through `ctx.systemPrompt.context()`. `packages/core/agent-loop/src/runtime-context.ts` joins them into one user message, and line 160 skips it when its text did not change. In `agent.ts` (lines 463-477), the loop appends each message as a `user/message` event.

## What you have now

Stable instructions live in prompt sections, and changing facts arrive as logged user messages before a step. One kind of instruction is in between: notes that the project's own authors write in a file, which can change while the agent works. How does the harness find that file, and what happens when the agent edits it?
