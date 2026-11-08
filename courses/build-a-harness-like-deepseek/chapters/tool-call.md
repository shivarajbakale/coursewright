# Tool call: the model asks to run a function

Your request now carries a tool schema for `count_lines`. You ask "How many lines are in notes.txt?". The model cannot open the file, and it knows your program can. What does it send back instead of a guess?

## An order ticket

Think of the restaurant again. You read the menu and tell the waiter "one medium pizza". The waiter writes it on a ticket with a number, such as ticket 7, and takes it to the kitchen. You did not cook anything. You only asked, in the form the menu describes.

A **tool call** is that ticket. Instead of a text answer, the model replies with a structured request: the name of one tool, the arguments for it and an id. The model runs nothing. It writes the request as predicted tokens, the same way it writes text, and your program decides what to do with it. The comparison differs in one way: a diner orders on purpose, but the model only predicts that a request fits here. Because of this, the arguments can be wrong, and your program must check them.

## The reply with a tool call

The reply's content list gains a new kind of block, `tool_use`:

```json
{
  "content": [
    { "type": "text", "text": "I will count the lines in notes.txt." },
    { "type": "tool_use", "id": "call_01", "name": "count_lines", "input": { "path": "notes.txt" } }
  ],
  "stop_reason": "tool_use"
}
```

Read it block by block:

1. Read the text block. The model often says what it is about to do, and you may show this text.
2. Read the `tool_use` block. `name` is a tool from your schemas, and `input` holds the arguments as a JSON object.
3. Keep the `id`. It names this one request, and the next lesson needs it.
4. Read the stop reason. `tool_use` means the model stopped to wait for your program. This is the extra stop reason that streaming mentioned.

Add the new block to the types and find the calls:

```ts
// src/llm.ts
export type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

export type Reply = {
  content: Block[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens'
  usage: { input_tokens: number; output_tokens: number }
}

// textOf now keeps only the text blocks:
export function textOf(content: Block[]): string {
  return content.map(block => (block.type === 'text' ? block.text : '')).join('')
}

// src/main.ts
const reply = await callModel([{ role: 'user', content: 'How many lines are in notes.txt?' }], tools)
for (const block of reply.content) {
  if (block.type === 'tool_use') console.log(block.id, block.name, block.input)
}
// call_01 count_lines { path: 'notes.txt' }
```

```inkling
title "The model asks instead of guessing"
layout sequence
prog: icon laptop "Your program"
model: icon server "DeepSeek API"
prog -> model : "question + count_lines schema"
activate model
model --> prog : "tool_use: count_lines, path notes.txt"
deactivate model
prog -> prog : "nothing has run yet"
steps auto
```

One reply can hold several `tool_use` blocks. To compare two files, the model can ask for `count_lines` twice, with two ids. Each block is a separate tool call.

The model writes the call from the schema, but nothing forces it to match. It can give `{ "file": "notes.txt" }`, or name a tool you never offered. Your program reads every tool call as a request from outside, and checks it before it acts.

> **Key idea:** A tool call is a reply block with a tool name, arguments and an id. The model stops and waits, and it runs nothing itself.

## How dsh does it

`packages/llm/llm-deepseek/src/translate.ts` reads each `tool_use` block from the stream and turns it into a dsh `tool-call` block with the same id and name (line 56). In a stream, the arguments arrive as pieces of JSON text (lines 82-85). When the reply ends, dsh checks that each set of arguments is valid JSON, and it rejects the reply if one is not (lines 151-158). The stop reason `tool_use` becomes dsh's `tool-calls` (line 93).

## What you have now

The model can ask your program to run a tool, by name, with arguments and an id, and the stop reason `tool_use` says it is waiting. The model is stateless, so it will not wait in any real sense. How does your program give it the result?
