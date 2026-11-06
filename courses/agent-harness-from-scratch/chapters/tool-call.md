# Tool call: the model asking your program to run a function

You sent the model a tool schema for `read_file`. Now a user asks "What does notes.txt say?" The model cannot open the file. It knows a tool exists that can. What does it send back?

## An order slip, not an answer

Picture a manager who never leaves the desk. When they need a document from the archive, they do not fetch it. They fill in a request slip: which form, which file, plus a ticket number. A clerk takes the slip, does the work, and later brings the document back with the same ticket number on it.

The model is that manager. When it decides a tool would help, it does not write an answer. It replies with one or more request slips, each naming a tool and giving the arguments. This is a tool call. The reply's stop reason is `tool_calls`, and the text content is usually empty.

The picture stops holding in one important way. A manager can watch the clerk. The model cannot see anything your program does. It only writes the request. Whether anything runs, and what happens, is entirely up to your program.

## What arrives

Send the question with `read_file` in `tools`, without streaming. The reply looks roughly like this (trimmed, and your id will differ):

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "",
      "tool_calls": [{
        "id": "call_0_8f2a",
        "type": "function",
        "function": { "name": "read_file", "arguments": "{\"path\":\"notes.txt\"}" }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

Walk through it. `tool_calls` is a list, because the model may ask for several things at once. Each entry has an `id` made up by the provider, the tool's `name`, and its `arguments`.

Look closely at `arguments`. It is not an object. It is a string that contains JSON: `"{\"path\":\"notes.txt\"}"`. The model wrote those characters token by token, like any other text. So you must parse it yourself with `JSON.parse`, and it might not even be valid JSON. Keep the raw string, and parse it only when you are about to use it.

Give the request its own type, and let an assistant message carry a list of them.

```ts
// src/types.ts
export type ToolCall = { id: string; name: string; arguments: string /* raw JSON */ }

export type Message = {
  role: 'system' | 'user' | 'assistant' // one more role arrives in the next lesson
  content: string
  toolCalls?: ToolCall[]
}
```

Then change `complete` to send the schemas and return the whole assistant message, converted into your types.

```ts
// src/llm.ts (inside complete, after the fetch)
const choice = data.choices[0]
const message: Message = {
  role: 'assistant',
  content: choice.message.content ?? '', // may be empty or null when it asks for tools
  toolCalls: choice.message.tool_calls?.map((c: any) => ({
    id: c.id,
    name: c.function.name,
    arguments: c.function.arguments,
  })),
}
return { message, finish: choice.finish_reason as FinishReason }
```

Try it and print `message.toolCalls`. You see one entry: id `call_0_8f2a`, name `read_file`, arguments `{"path":"notes.txt"}`. Nothing has read any file. The model is waiting for your program to act.

> **Key idea:** A tool call is a structured request in the model's reply, with an id, a tool name and raw JSON arguments, asking your program to run that tool; the model itself runs nothing.

**In DeepSeek Harness:** a tool call is a content block `{ type: 'tool-call', id, name, arguments }`, and its arguments stay a raw JSON string all the way through the provider code (`ToolCallBlock` in `packages/llm/llm/src/types.ts`).

## What you have now

The model can now see your tools and ask for one by name, with arguments and an id. Your program has the request but has not answered it. How do you run the function and give the model what it found, so it can finish its reply?
