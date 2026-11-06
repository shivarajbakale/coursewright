# Tool result: the answer you send back for one request

Your program holds a tool call: id `call_0_8f2a`, tool `read_file`, arguments `{"path":"notes.txt"}`. The model is waiting. It cannot see your disk, and it remembers nothing between requests. So how does what your program finds get back to the model?

## The ticket number comes back

Go back to the manager and the clerk. The clerk fetches the document and returns it with the ticket number from the slip. If the manager had sent out three slips, the ticket numbers are how they know which document answers which request.

Your program plays the clerk. It runs the function, then adds a new message to the history with a fourth role, `tool`. That message holds two things: the output as text, and the id of the request it answers. This message is a tool result, and the id it carries is the call id.

```inkling
title "A tool result answers one request"
layout sequence
model: box "Model"
prog: box "Your program"
file: db "notes.txt"
model -> prog : "request id call_0_8f2a"
activate prog
prog -> file : "read notes.txt"
file --> prog : "Buy milk. Call Sam."
prog --> model : "tool message id call_0_8f2a"
deactivate prog
steps auto
```

Then your program sends the whole history again. The model now sees its own request followed by the answer, and it can finish its reply.

The picture stops holding at the clerk's honesty. The model takes whatever text you put in a result as true. It has no other way to see your files.

## Running the request and answering it

First, give the message type its new role and field.

```ts
// src/types.ts
export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string // set on 'tool' messages: which request this answers
}
```

Your types use camelCase, but the wire format does not. Convert each message as you build the request body.

```ts
// src/llm.ts — send messages.map(toWire) instead of messages
function toWire(m: Message) {
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
  if (m.toolCalls?.length) {
    return { role: 'assistant', content: m.content, tool_calls: m.toolCalls.map((c) => ({
      id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments },
    })) }
  }
  return { role: m.role, content: m.content }
}
```

Now handle one reply that asks for tools.

```ts
// src/ask-file.ts — run with: npx tsx src/ask-file.ts
import { readFile } from 'node:fs/promises'
import { complete } from './llm.ts'
import { readFileSchema } from './tools.ts'
import type { Message } from './types.ts'

const history: Message[] = [{ role: 'user', content: 'What does notes.txt say?' }]
const first = await complete(history, [readFileSchema])
history.push(first.message) // keep the request itself in the history

for (const call of first.message.toolCalls ?? []) {
  const args = JSON.parse(call.arguments) as { path: string }
  const output = await readFile(args.path, 'utf8')
  history.push({ role: 'tool', toolCallId: call.id, content: output })
}

const second = await complete(history, [readFileSchema])
console.log(second.message.content)
```

Put a `notes.txt` beside it containing "Buy milk. Call Sam." and walk through the run.

1. Request one sends 1 message. The reply asks for `read_file` with id `call_0_8f2a`.
2. Your program adds that reply, reads the file, and adds a `tool` message: id `call_0_8f2a`, content "Buy milk. Call Sam."
3. Request two sends 3 messages: the question, the model's request, and your answer. The reply is text, with stop reason `stop`: "Your notes say to buy milk and to call Sam."

One question, two model requests. The model never touched the file; it read your answer.

Two rules keep this working. The assistant message with the request must stay in the history, right before its results. And every requested id needs exactly one result. If an id is left without an answer, the history no longer makes sense, and the provider will usually reject the request.

> **Key idea:** A tool result is a `tool` message holding the output of one requested function plus its call id, the id that pairs it with the request it answers.

**In DeepSeek Harness:** a result is its own message with role `tool` and a `toolCallId`, not part of another message (`ToolResultMessage` in `packages/llm/llm/src/message.ts`).

## What you have now

You can offer a tool, receive a request, run it, and send the result back, paired by its call id. Your script did this exactly once. But what if the second reply asks for another file, and the one after that for a third?
