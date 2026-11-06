# Turn: one full answer that may take several model requests

In the agent loop, one question about `index.txt` took three model requests and two tool runs. Ask a follow-up and the work starts again. To log the work, count it, cap it or show progress, you need words for its two sizes. What is "one answer", and what is "one round" inside it?

```inkling
title "A turn of three steps"
layout flow
user: person "You"
model: icon server "Model"
tool: icon folder "read_file"
answer: box "Answer" green
step 1: user, model "You ask; the model asks for a tool"
step 2: tool, model "The tool reads the file; the model asks again"
step 3: model, answer "The model replies with plain text"
user -> model : "question"
model -> tool : "tool call"
tool -> model : "tool result"
model -> answer : "final text"
circle answer
```

## A trip to the help desk

Picture a help desk. You walk up and ask a question. The clerk goes to the back room, comes back, goes again, and finally gives you the answer. Your visit, from question to answer, is one unit. Each trip to the back room is a smaller unit inside it. Ask a second question and a new visit begins, but the clerk still has the notes from the first one on the desk.

An agent's work has the same two sizes:

- A step is one model request plus the tool calls in its reply, run and answered. A step whose reply has no tool calls is the last one.
- A turn is everything from one user message to the final plain-text answer. It is made of one or more steps.

The history outlives both. Each new turn starts from the history the earlier turns left behind, so the model sees the whole conversation.

The picture stops holding in one place. The clerk remembers your first visit. The model does not; your program carries the history from one turn to the next, as you did with the stateless model.

## Counting steps in a turn

Rename the loop to say what it runs, and number its steps.

```ts
// src/loop.ts
export async function runTurn(history: Message[], userText: string, tools: Tool[]): Promise<string> {
  history.push({ role: 'user', content: userText }) // a turn starts with a user message
  const schemas = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
  let step = 0
  while (true) {
    step++
    const { message } = await complete(history, schemas)
    history.push(message)
    if (!message.toolCalls?.length) {
      console.error(`[turn done after ${step} step(s)]`)
      return message.content
    }
    for (const call of message.toolCalls) {
      console.error(`[step ${step}] ${call.name} ${call.arguments}`)
      const tool = tools.find((t) => t.name === call.name)!
      const output = await tool.execute(JSON.parse(call.arguments), new AbortController().signal)
      history.push({ role: 'tool', toolCallId: call.id, content: output })
    }
  }
}
```

Progress goes to `console.error` so it stays apart from the answer on standard output. Now a terminal chat where each line you type is one turn:

```ts
// src/cli.ts — run with: npx tsx src/cli.ts
import * as readline from 'node:readline/promises'
import { runTurn } from './loop.ts'
import { readFileTool } from './tools.ts'
import type { Message } from './types.ts'

const history: Message[] = [{ role: 'system', content: 'You can read files in the current folder.' }]
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
while (true) console.log(await runTurn(history, await rl.question('> '), [readFileTool]))
```

Trace two turns, with the same files as before.

Turn one: "What does the file named in index.txt say?"

```text
[step 1] read_file {"path":"index.txt"}
[step 2] read_file {"path":"notes.txt"}
[turn done after 3 step(s)]
```

Three steps: two that ran a tool, and a third whose reply was the answer.

Turn two: "Is calling Sam on that list?" The history already holds the contents of `notes.txt` from turn one. The model answers straight away, "Yes", in a single step with no tool calls. In `runTurn`, a turn always has at least one step, but it can need far fewer than the turn before it.

Why bother with the names? Because each answers a different question. Per step you ask "what did this one request cost, and which tools did it run?" Per turn you ask "how long did this answer take, and is the agent still working on it?" A screen shows a spinner for a turn and a line for each step.

> **Key idea:** A step is one model request plus the tool calls in its reply; a turn is all the steps between one user message and the final text answer, and the history carries over from turn to turn.

**In DeepSeek Harness:** the loop in `packages/core/agent-loop/src/agent.ts` uses the same two units. It records `turn/start` and `turn/end` around each turn, `step/start` and `step/end` around each step, and gives every turn an end reason such as `completed` or `aborted`. Its turns can even end with zero steps, for example when a check before the first request blocks it.

## What you have now

You can name and count the work: turns made of steps, each step one model request and its tool runs. Nothing in `runTurn` stops it if the model keeps asking for tools forever. What keeps a confused model from looping without end?
