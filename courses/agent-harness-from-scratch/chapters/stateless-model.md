# Stateless model: every request sends the whole conversation

Try two calls in a row. In the first, the user says "My name is Ana." In the second, a fresh request, the user asks "What is my name?" The model answers that it does not know. It was told a moment ago. Why did it forget, and how do chat apps seem to remember?

## A hotline with no notes

Picture a help hotline where nobody takes notes. Every time you call, the person who answers has never heard of you. If you want help with something you discussed yesterday, you must read out the whole story again from the start. Then they can answer as if they remembered.

A model works like that. Each API call is complete in itself. The model reads the messages in that request, writes a reply, and keeps nothing afterwards. This is what stateless means: no state, no memory, carried from one request to the next.

So the memory has to live in your program. Your program keeps every message of the conversation in a list. Each time the user says something, you add it to the list and send the whole list. When the reply arrives, you add that too, labelled `assistant`. That is why the `assistant` role exists: it lets you hand the model its own earlier words.

The picture stops holding in one place. A hotline operator could choose to take notes. The model cannot. Even if you send the same conversation twice, it starts from nothing each time.

## A chat that remembers

Here is a terminal chat. It uses the `complete` function and the `Message` type written in the lesson on message roles.

```ts
// src/chat.ts — run with: npx tsx src/chat.ts
import * as readline from 'node:readline/promises'
import { complete } from './llm.ts'
import type { Message } from './types.ts'

const history: Message[] = [{ role: 'system', content: 'You are a helpful assistant.' }]
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

while (true) {
  const text = await rl.question('> ')
  history.push({ role: 'user', content: text })
  const reply = await complete(history) // the WHOLE list, every time
  history.push({ role: 'assistant', content: reply })
  console.log(reply)
}
```

Walk through two exchanges. You type "My name is Ana." The program sends 2 messages: system and user. The reply, "Nice to meet you, Ana.", is added, so the list now holds 3.

You type "What is my name?" The program sends 4 messages: system, your first line, the model's reply, and your new question. The model reads the earlier line and answers "Ana". It did not remember. Your program reminded it.

A third question would send 6 messages, a fourth 8. The list grows by 2 with every exchange.

This has a price. Say each message is about 20 tokens. The first request sends about 40 tokens, the second about 80, the third about 120. Every request pays again for everything before it. And the list keeps growing towards the context window, until one day it no longer fits.

It also has a benefit. Because your program holds the list, your program is in charge of it. You can save it to disk, show it on screen, or leave out old parts before sending. The model has no copy to disagree with yours.

> **Key idea:** The model is stateless: it remembers nothing between requests, so your program keeps the conversation and sends all of it with every request.

**In DeepSeek Harness:** the harness never sends a hand-kept array. It keeps a record of everything that happened in a session and rebuilds the message list from that record before every request (`packages/core/session`). You will build the same idea in a later module.

## What you have now

The model holds no memory, so your program keeps the history and resends it, which costs tokens and fills the context window over time. So far each reply arrives all at once, after the model has finished. For a long answer that can mean seconds of nothing on screen. Can the reply arrive as it is written?
