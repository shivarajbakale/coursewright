# The first agent: the whole loop in one small program

You have every piece of an agent, each built in its own lesson. A model API call sends a stateless conversation. Roles mark who said what. Tool schemas offer functions, tool calls ask for them, results answer them, errors go back as results, and a step limit caps the turn. What does the whole program look like when the pieces sit together?

## A small workshop

Think of a small workshop with three people. A planner decides what to do next. A runner fetches tools from the shelf and reports what happened. A clerk carries every message to the planner and back. None of them does another's job.

Your first agent has the same three parts in three files. The model is the planner, and `src/tools.ts` is the runner. `src/llm.ts` is the clerk that talks to DeepSeek, and `src/loop.ts` connects them. The comparison differs in one way: a human planner remembers yesterday, but the model remembers nothing. The loop carries the whole conversation to it in every request.

## The whole program

The model client, with every block type from the earlier lessons. DeepSeek can also return a `thinking` block with the model's reasoning. The loop keeps it in the conversation unchanged.

```ts
// src/llm.ts
export type Block =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature?: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
export type Message = { role: 'user' | 'assistant'; content: string | Block[] }
export type Tool = { name: string; description: string; input_schema: Record<string, unknown> }
export type Reply = { content: Block[]; stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' }

const URL = 'https://api.deepseek.com/anthropic/v1/messages'
const SYSTEM = 'You are a careful assistant. Answer in one short sentence.'

export async function callModel(messages: Message[], tools: Tool[] = []): Promise<Reply> {
  const response = await fetch(URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.DEEPSEEK_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-flash', max_tokens: 1024, system: SYSTEM, messages,
      ...(tools.length > 0 ? { tools } : {}),
    }),
  })
  if (!response.ok) throw new Error(`model call failed: ${response.status} ${await response.text()}`)
  return (await response.json()) as Reply
}

export function textOf(content: Block[]): string {
  return content.map(block => (block.type === 'text' ? block.text : '')).join('')
}
```

The tools, now two of them:

```ts
// src/tools.ts
import { readdir, readFile } from 'node:fs/promises'
import type { Tool } from './llm.ts'

const path = { type: 'string', description: 'Path relative to the current folder' }
export const tools: Tool[] = [
  { name: 'count_lines', description: 'Count the lines in a text file.',
    input_schema: { type: 'object', properties: { path }, required: ['path'] } },
  { name: 'list_files', description: 'List the names in a folder. Use it to find a file.',
    input_schema: { type: 'object', properties: { path }, required: ['path'] } },
]

export async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (typeof input.path !== 'string') throw new Error('invalid arguments: path must be a string')
  if (name === 'list_files') return (await readdir(input.path)).join('\n')
  if (name === 'count_lines') {
    const lines = (await readFile(input.path, 'utf8')).split('\n')
    if (lines.at(-1) === '') lines.pop()
    return String(lines.length)
  }
  throw new Error(`unknown tool "${name}"`)
}
```

The agent loop with its step limit and error results, and the entry point:

```ts
// src/loop.ts
import { callModel, textOf, type Block, type Message } from './llm.ts'
import { runTool, tools } from './tools.ts'

const MAX_STEPS = 10

export async function agent(messages: Message[]): Promise<string> {
  for (let step = 1; step <= MAX_STEPS; step++) {
    const reply = await callModel(messages, tools)
    messages.push({ role: 'assistant', content: reply.content })
    if (reply.stop_reason !== 'tool_use') return textOf(reply.content)
    const results: Block[] = []
    for (const block of reply.content) {
      if (block.type !== 'tool_use') continue
      try {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: await runTool(block.name, block.input) })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${message}`, is_error: true })
      }
    }
    messages.push({ role: 'user', content: results })
  }
  return `Stopped after ${MAX_STEPS} steps without a final answer.`
}

// src/main.ts
import { agent } from './loop.ts'
console.log(await agent([{ role: 'user', content: process.argv.slice(2).join(' ') }]))
```

The logic is about sixty lines. Run it from a folder where `notes.txt` sits inside `docs`:

```text
DEEPSEEK_API_KEY=sk-... npx tsx src/main.ts "How many lines are in notes.txt?"
```

The model chooses its own path, so runs differ. Here is one possible turn:

1. Run step 1. The model calls `count_lines` on `notes.txt`. The file is not there, so the result is an error.
2. Run step 2. The model reads the error and calls `list_files` on `.`. The result lists `docs` and `src`.
3. Run step 3. The model calls `list_files` on `docs`, and the result is `notes.txt`.
4. Run step 4. The model calls `count_lines` on `docs/notes.txt`, and the result is `42`.
5. Run step 5. The model replies "docs/notes.txt has 42 lines." and the program prints it.

Your code never decided to look in `docs`. The model made every choice from the schemas and the results. Your program only ran what it asked for, within 10 steps.

> **Key idea:** A first agent is a model client, a set of tools and a loop with a step limit. The model decides, and the program runs.

## How dsh does it

DeepSeek Harness splits the same three jobs into packages:

- `packages/core/agent-loop` (`@deepseek-ai/dsh-agent-loop`) runs turns and steps, like `src/loop.ts`.
- `packages/core/tools` (`@deepseek-ai/dsh-tools`) collects the tool schemas and runs each call, like `src/tools.ts`.
- `packages/llm/llm` and `packages/llm/llm-deepseek` make the model call, like `src/llm.ts`.

```inkling
title "mini-dsh beside dsh"
layout stack
- main.ts: your question
- loop.ts: dsh-agent-loop
- tools.ts: dsh-tools
- llm.ts: dsh-llm and dsh-llm-deepseek
- DeepSeek API
brace loop-ts-dsh-agent-loop..llm-ts-dsh-llm-and-dsh-llm-deepseek "the harness"
step 1: main-ts-your-question "The question enters the program"
step 2: loop-ts-dsh-agent-loop "The loop runs the turn"
step 3: tools-ts-dsh-tools "The tools answer tool calls"
step 4: llm-ts-dsh-llm-and-dsh-llm-deepseek "The model client talks to DeepSeek"
step 5: deepseek-api "The model decides every next step"
```

The difference is in what surrounds them. dsh writes every message to a record before the model sees it, so a crash loses nothing.

## What you have now

You have a working agent: a model client, two tools and a loop with a step limit and error results, joined over a stateless conversation. It keeps the conversation only in the `messages` array, so when the program stops, the conversation is gone. How can a program keep a record of everything that happened, so it can be saved and rebuilt?
