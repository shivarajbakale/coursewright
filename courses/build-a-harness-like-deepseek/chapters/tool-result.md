# Tool result: the answer sent back to the model

The model replied with a tool call: run `count_lines` on `notes.txt`, id `call_01`. Your program can count the lines. But the model is stateless, and the request that asked has already ended. How does the count reach the model, and how does the model know which request it answers?

## The dish with the ticket number

Think of the restaurant one last time. The kitchen cooks the pizza and puts ticket 7 next to it. The waiter reads the number and brings the dish to the right table. Without the number, a busy waiter could bring it to the wrong person.

A **tool result** is the dish with its ticket. Your program runs the tool and sends the output back as a `tool_result` block. The block carries the **call id**: the `id` of the tool call it answers, in a field called `tool_use_id`. The comparison differs in one way: the diner waits at the table, but the model does not wait anywhere. Your program sends a new request with the whole conversation, and the result is the newest message in it.

## Answering call_01

First, run the tool:

```ts
// src/tools.ts
import { readFile } from 'node:fs/promises'

export async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'count_lines') {
    const lines = (await readFile(String(input.path), 'utf8')).split('\n')
    if (lines.at(-1) === '') lines.pop() // a final newline does not start a new line
    return String(lines.length)
  }
  throw new Error(`unknown tool "${name}"`)
}
```

The result block joins the `Block` type:

```ts
// src/llm.ts: one more kind of block
  | { type: 'tool_result'; tool_use_id: string; content: string }
```

Then build the next request:

```ts
// src/main.ts
const messages: Message[] = [{ role: 'user', content: 'How many lines are in notes.txt?' }]
const first = await callModel(messages, tools)
messages.push({ role: 'assistant', content: first.content })

const call = first.content.find(block => block.type === 'tool_use')
if (call?.type === 'tool_use') {
  const output = await runTool(call.name, call.input) // "42"
  messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: call.id, content: output }] })
}

const second = await callModel(messages, tools)
console.log(textOf(second.content)) // "notes.txt has 42 lines."
```

1. Add the model's reply to the list as an `assistant` message. The tool call must stay in the conversation, or the result answers nothing.
2. Run `count_lines` with `{ path: "notes.txt" }`. It returns the text `"42"`.
3. Add a `user` message with one `tool_result` block. Its `tool_use_id` is `call_01`, the id from the call.
4. Send all 3 messages again. The model reads the question, its own call and the result with the same id.
5. Read the reply. The model answers "notes.txt has 42 lines." with the stop reason `end_turn`.

```inkling
title "The call id joins call and result"
layout down
call: box "tool_use\nid call_01\ncount_lines"
run: round "runTool"
result: box "tool_result\ntool_use_id call_01\n42"
model: round "The model"
call -> run : "name and input"
run -> result : "output"
result -> model : "next request"
underline result
step 1: call "The model asks, with id call_01"
step 2: run "Your program runs the tool"
step 3: result "The result carries the same id"
step 4: model "The model reads both in the next request"
```

The result goes in a `user` message because, to the model, it comes from outside the model. The id makes the pairing exact. When one reply holds two tool calls, the next message holds two `tool_result` blocks, each with its own id, so the order does not matter.

A request with a tool call and no matching result is invalid. The model asked a question, and nothing answers it. Providers refuse such a request.

> **Key idea:** A tool result is the tool's output sent back in a user message, paired to its tool call by the call id.

## How dsh does it

dsh stores a result as a message with the role `tool` and a `toolCallId` field (`packages/llm/llm/src/message.ts`, lines 172-180). `packages/llm/llm-deepseek/src/serialize.ts` writes it as a `tool_result` block with `tool_use_id` (line 121), inside a `user` message (line 125). Before it sends anything, the same file checks that every call has exactly one result in the next message (lines 131-146). If one is missing, dsh stops with the error "tool calls need immediate results".

## What you have now

You have the full exchange for one tool: a schema offers it, a tool call asks for it, and a tool result answers it by call id, inside a resent conversation. But the model may need a second tool after it reads the first result, and a third after that. Who decides when to stop asking?
