# Event log: a list of facts that only ever grows

Your agent loop works. It keeps a `messages` array, pushes the user's question onto it, pushes each assistant reply and each tool result, and sends the whole array on every step. Now ask it some harder questions. What exactly did the model see on step 3 of yesterday's turn? Which tool ran, and when? If some code trims the array to save tokens, how do you know what was there before? The array cannot answer, because it only holds the present.

## Write down what happened, never what is

Think of a bank. It does not keep your balance in one box that it rubs out and rewrites. It keeps a statement: every deposit and every withdrawal, in order, each written once. Your balance is something it works out from that list. When the bank makes a mistake, it does not erase the bad line. It adds a correcting line, so the history of the mistake stays visible.

An agent can work the same way. Instead of a `messages` array that the loop edits, it keeps a list of facts: "the user said this", "the model replied that", "this tool returned this". Each fact is added at the end and never changed. The message array the model needs becomes something you compute from the facts.

The bank picture stops holding in one place. A statement is read by people, who can guess what a vague line meant. Your list is read by code, so every fact must be precise enough for a program to rebuild the conversation from it with no guessing.

Here is the smallest version, in a new file of `minidsh`:

```ts
// src/session.ts
export type Fact = { type: string; data: unknown }

export class Session {
  private readonly facts: Fact[] = []

  append(type: string, data: unknown): void {
    this.facts.push(Object.freeze({ type, data }))
  }

  all(): readonly Fact[] {
    return this.facts
  }
}
```

There is an `append` and a way to read. There is no `update`, no `delete`, no `splice`. `Object.freeze` backs up the "never changed" promise: reassigning a field of a recorded fact now throws, because ES modules run in strict mode. It is shallow, so treat the `data` inside as read-only too. In the loop, every place that used to call `messages.push(...)` now calls `session.append(...)`:

```ts
session.append('user/message', { role: 'user', content: 'What is 2+2?' })
// ... model request ...
session.append('assistant/message', { role: 'assistant', content: '4' })
```

After that turn the list holds two facts, in the order they happened. Nothing else in the program holds a second copy of the conversation.

## Why one list of facts beats an edited array

With an edited array plus a separate log written "for debugging", you have two records of the same thing. Sooner or later they disagree: a bug updates one and not the other, and you can no longer trust either. When the list of facts is the only record, there is nothing for it to disagree with.

You also never lose information. Suppose a later feature needs to shorten a long conversation. It does not delete old facts. It appends a new fact that says "from here on, use this shorter version". The old facts are still there for anyone who wants to see what really happened.

> **Key idea:** An event log is a list of facts in the order they happened, where new facts are only ever added at the end and recorded facts are never changed or removed. Everything else, including the messages you send the model, is computed from it.

The word for "only added at the end" is **append-only**.

**In DeepSeek Harness:** the log is the session, defined in `packages/core/session/src/types.ts`. The agent loop in `packages/core/agent-loop/src/agent.ts` appends every accepted fact before the next step reads from it. The design notes give the reason in one line: with a mutable array, "state and log can diverge; with event-sourcing the log IS the state, so divergence is structurally impossible." They also state the rule that follows from it: "Model-visible means logged."

## What you have now

You replaced the agent loop's private message array with a single append-only list of facts, so every turn and step leaves a permanent record. Each fact is still a loose `{ type, data }` pair, though. What exactly should one recorded fact contain, and which kinds of fact does an agent need?
