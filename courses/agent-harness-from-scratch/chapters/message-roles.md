# Message roles: labels saying who wrote each message

Your first model call sent a list called `messages` with one entry, labelled `role: 'user'`. The reply came back labelled `role: 'assistant'`. Why is the request a list and not one string, and what do those labels do?

## A script with speaker names

Think of a play script. Every line starts with the name of who speaks it. At the top, before any dialogue, there is a short note for the actors: "A small kitchen. Late at night. Speak quietly." Nobody says the note aloud, but it shapes every line that follows.

```inkling
title "A chat request is an ordered script"
layout down
system: sticky "System\ninstructions"
user: person "User\nquestion"
api: box "Model API"
assistant: icon chat "Assistant\nreply"
step 1: system "Your note about how to behave goes first"
step 2: user "Then the question the person typed"
step 3: api "The messages list goes to the model"
step 4: assistant "The model replies with the assistant role"
circle system
```

A chat request is written the same way. It is a list of messages, and each message has a role saying who it comes from:

- `system`: the note at the top. Instructions from you, the programmer, about how the model should behave.
- `user`: what the person typed.
- `assistant`: what the model wrote. Replies come back with this role.

The text in a system message is called the system prompt. It is where you set the model's job, tone and rules for the whole conversation.

The picture stops holding in one important way. Actors are people who choose to follow the script. The model is still a next-token predictor. Before it reads your list, the provider joins all the messages into one long run of tokens, with special marker tokens showing where each message starts and who wrote it. The model was trained on text in that shape, so it has learned to treat the system message as rules and to write the next assistant message. That is a strong habit, not a guarantee. A model can still drift from its system prompt.

## Giving your program a message type

Put the shape in a type, so the rest of your project agrees on it.

```ts
// src/types.ts
export type Message = {
  role: 'system' | 'user' | 'assistant' // later lessons add one more role
  content: string
}
```

Then wrap the call from the previous lesson in a function that takes any list of messages.

```ts
// src/llm.ts
import type { Message } from './types.ts'

export async function complete(messages: Message[]): Promise<string> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' }, messages }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}
```

Now try the same question with and without a system prompt.

```ts
// src/roles.ts — run with: npx tsx src/roles.ts
import { complete } from './llm.ts'

const question = { role: 'user', content: 'What is the capital of France?' } as const

console.log(await complete([question]))
console.log(await complete([
  { role: 'system', content: 'Answer in at most three words. No full sentences.' },
  question,
]))
```

The first call sends one message and typically gets a full sentence back, such as "The capital of France is Paris." The second sends two. The system message comes first, the user message second, and the reply is usually just "Paris". The question did not change. Only the note at the top did.

Order matters. The model reads the list from top to bottom, as one text. The system message goes first, so its rules frame everything after it.

> **Key idea:** A chat request is an ordered list of messages, each labelled with a role: `system` for your instructions (the system prompt), `user` for the person, and `assistant` for the model's own replies.

**In DeepSeek Harness:** its message type has five roles, not three. Beside system, user and assistant there are `developer` and `tool`, and each message's content is a list of typed blocks rather than one string (`packages/llm/llm/src/message.ts`).

## What you have now

You can call a model with a list of labelled messages, and a system prompt shapes how it answers. The `assistant` role suggests that the model's earlier replies can go into the list too. But why would you ever send the model its own words back?
