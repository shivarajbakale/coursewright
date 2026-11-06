# Agent loop: ask the model, run its requests, ask again

Your script asked the model once, ran one request, and asked again. That worked because one file was enough. Now a user asks "What does the file named in index.txt say?" The model must read `index.txt` first, and only then knows which file to read next. You cannot know in advance how many rounds it will take. How do you write a program for that?

## Keep going until the model answers

Picture a detective who cannot leave the office. They send an assistant out for a record, read it, and decide what they need next. Maybe another record. Maybe a witness statement. When they have enough, they write the report. The assistant does not plan anything; they fetch what is asked for until the report arrives.

Your program is the assistant, and the rule is short:

1. Send the history and the tool schemas to the model.
2. Add the reply to the history.
3. If the reply holds no tool calls, it is the answer. Stop.
4. Otherwise run every tool call, add each tool result, and go back to 1.

This is the agent loop. A model on its own only writes text. Wrapped in this loop, it can look things up, act, look at what happened, and act again. That is what people mean by an agent.

The picture stops holding in one place. A detective remembers what they read. The model is stateless, so every round sends the whole history again, every record fetched so far included.

## The loop in code

Give each tool a body that runs, beside its schema.

```ts
// src/types.ts (add)
export type Tool = ToolSchema & {
  // the signal lets a later lesson stop a running tool; ignore it for now
  execute(args: any, signal: AbortSignal): Promise<string>
}
```

```ts
// src/tools.ts (add)
import { readFile } from 'node:fs/promises'
export const readFileTool: Tool = { ...readFileSchema, execute: (args) => readFile(args.path, 'utf8') }
```

```ts
// src/loop.ts
import { complete } from './llm.ts'
import type { Message, Tool } from './types.ts'

export async function runAgent(history: Message[], tools: Tool[]): Promise<string> {
  const schemas = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
  while (true) {
    const { message } = await complete(history, schemas)
    history.push(message)
    if (!message.toolCalls?.length) return message.content // plain text: done

    for (const call of message.toolCalls) {
      const tool = tools.find((t) => t.name === call.name)! // assumes the name exists, for now
      const output = await tool.execute(JSON.parse(call.arguments), new AbortController().signal)
      history.push({ role: 'tool', toolCallId: call.id, content: output })
    }
  }
}
```

Run it with `await runAgent([{ role: 'user', content: 'What does the file named in index.txt say?' }], [readFileTool])`. Say `index.txt` contains `notes.txt`, and `notes.txt` contains "Buy milk. Call Sam."

1. Round one sends 1 message. The model asks for `read_file` with `{"path":"index.txt"}`. The program adds the request and the result "notes.txt". History: 3 messages.
2. Round two sends 3 messages. The model has learned the name and asks for `{"path":"notes.txt"}`. Request and result are added. History: 5 messages.
3. Round three sends 5 messages. The reply has no tool calls: "The file is notes.txt, and it says to buy milk and call Sam." The loop returns it.

Three model requests, two tool runs, and your code never decided which file to read. The model chose each action; the loop carried it out.

Notice the loop's only exit. It ends when the model answers in plain text. The model decides when the work is finished, not your code.

> **Key idea:** The agent loop sends the history to the model, runs every tool call in the reply, adds the results, and repeats until a reply contains only text.

**In DeepSeek Harness:** the loop lives in `packages/core/agent-loop/src/agent.ts`. Its driver keeps running rounds while there is work left, and before running any tool it records the model's reply, so its log always shows exactly what the tools followed.

## What you have now

You have joined tool calls and tool results into a loop, and the model can now take several actions to answer one question. One question can mean three model requests or thirty. To count and control that work, you need names for the two sizes of it: one answer to the user, and one round inside it. What are they?
