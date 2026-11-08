# A stateless model: each request carries the whole chat

In the message roles example, you wrote the earlier question and answer into the request yourself. Is that needed? Suppose you send "My name is Priya." in one request, and "What is my name?" in a second request. Will the model know the name?

## A help desk with no notes

Think of a phone help desk where every call reaches a different person, and nobody writes notes. You call and explain your problem. The next day you call again, and a new person answers. They know nothing about yesterday, so you must tell the whole story again.

A hosted model works like this help desk. It is a **stateless model**: it keeps nothing from one request to the next. Every request is complete on its own, and the reply depends only on what that request contains. The comparison differs from the field in one way: on the phone you retell the story in your own words, but your program sends the earlier messages exactly, word for word. Because the program builds every request, it also decides what the model sees.

## Two requests, two ways

Trace the two questions:

1. Send request 1 with one user message, "My name is Priya." The model replies "Nice to meet you, Priya."
2. Send request 2 with only "What is my name?". The model has no earlier message, so it replies that it does not know.
3. Send request 2 again with 3 messages: the first question, the model's reply and the new question. Now the model replies "Your name is Priya."

```inkling
title "What request 2 must carry"
layout compare
columns "Only the new question", "The whole chat"
row "Messages sent": "1", "3"
row "Knows the name": no, yes!
row "Tokens sent": "fewer", "more"
step 1: only-the-new-question "Send only the new question"
step 2: the-whole-chat "Send the question, the answer and the new question"
step 3: knows-the-name "Only the whole chat gives the model the name"
```

So the program keeps the conversation in a list, and sends the whole list each time:

```ts
// src/llm.ts: a helper for the text of a reply
export function textOf(content: Block[]): string {
  return content.filter(block => block.type === 'text').map(block => block.text).join('')
}

// src/main.ts
import { callModel, textOf, type Message } from './llm.ts'

const messages: Message[] = []

async function chat(text: string): Promise<string> {
  messages.push({ role: 'user', content: text })
  const reply = await callModel(messages)
  messages.push({ role: 'assistant', content: reply.content })
  return textOf(reply.content)
}

await chat('My name is Priya.') // request 1 sends 1 message
await chat('What is my name?')  // request 2 sends 3 messages
```

The second `chat` call sends 3 messages, and a third call would send 5. The program adds the model's reply to the list as an `assistant` message, with its list of blocks unchanged. The next request then carries the reply exactly as the model wrote it.

Why do providers build models this way? A provider runs a large number of servers. When no request depends on an earlier one, any server can answer any request, and the provider stores no conversation for you. The cost moves to you. Each request sends the earlier tokens again, and you pay for them again. The list also grows until it reaches the context window.

> **Key idea:** A stateless model remembers nothing between requests, so the program sends the whole conversation in every request.

DeepSeek Harness never trusts the model to remember. It keeps its own record of the conversation, and before each request it builds the full message list from that record with `deriveMessages()` in `packages/core/session/src/index.ts` (line 999). A later module builds that record.

## What you have now

You keep the conversation in a list and send it whole, with roles, inside the context window. A long reply still takes several seconds to arrive, and with one JSON reply you see nothing until the last token is written. Can the program show the reply while the model writes it?
