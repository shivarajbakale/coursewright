# Turn: one answer made of several model requests

The agent loop repeats until the model replies in text. Nothing in it stops a model that keeps asking for tools. Suppose `notes.txt` does not exist, and the model asks for `count_lines` on it again and again. Each request resends the whole conversation, so each costs more tokens than the last. How many requests may one answer take?

## One errand, several trips

Think of an errand: "get everything for dinner". You may need several trips. You go to the shop, then home to check the fridge, then back to the shop for the eggs. The errand is one task. Each trip is one part of it. A sensible person also has a limit: after five trips, they stop and phone home to ask.

An agent's work has the same two levels.

A **turn** is one complete answer to one user message. It starts when the question arrives and ends when the model replies in text. A **step** is one model request inside a turn, together with the tools that reply asks for. A **step limit** is the largest number of steps your program allows in one turn. The comparison differs in one way: the person on the errand notices when trips are wasted, but the model often cannot tell that it repeats itself. The program must keep the count.

## Counting the steps

Ask "Do notes.txt and todo.txt have the same number of lines?" and trace one turn:

1. Send step 1 with 1 message. The model asks for `count_lines` on `notes.txt`, and the program gets `42`.
2. Send step 2 with 3 messages. The model asks for `count_lines` on `todo.txt`, and the program gets `17`.
3. Send step 3 with 5 messages. The model replies in text: "No: notes.txt has 42 lines and todo.txt has 17." The stop reason is `end_turn`.
4. End the turn. It took 3 steps, well under a step limit of 10.

```inkling
title "A turn holds steps"
layout right
question: person "Your question"
s1: box "Step 1\ncount notes.txt"
s2: box "Step 2\ncount todo.txt"
s3: box "Step 3\nanswer in text"
answer: sticky "42 and 17: no"
group turn "Turn 1" { s1, s2, s3 }
question -> s1 -> s2 -> s3 -> answer
circle s3
step 1: question "One question opens one turn"
step 2: s1, s2 "Each model request is one step"
step 3: s3 "A text reply is the last step"
step 4: answer "The turn ends with the answer"
```

In code, the turn is the loop, and the step limit replaces `while (true)`:

```ts
// src/loop.ts
const MAX_STEPS = 10

export async function agent(messages: Message[]): Promise<string> {
  for (let step = 1; step <= MAX_STEPS; step++) {
    const reply = await callModel(messages, tools)
    messages.push({ role: 'assistant', content: reply.content })
    if (reply.stop_reason !== 'tool_use') return textOf(reply.content)
    const results: Block[] = []
    for (const block of reply.content) {
      if (block.type === 'tool_use') {
        const output = await runTool(block.name, block.input)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: output })
      }
    }
    messages.push({ role: 'user', content: results })
  }
  return `Stopped after ${MAX_STEPS} steps without a final answer.`
}
```

When the turn reaches step 10 and the model still asks for a tool, the loop ends and returns a plain note. The program spent at most 10 requests, not an unlimited number. The user sees that the agent stopped, and can ask again in a different way.

A step limit is a safety net, not a plan. Set it too low, and real work stops halfway: a task that reads 12 files needs at least 13 steps. Set it too high, and a stuck model wastes tokens for a long time.

> **Key idea:** A turn answers one user message. Each model request in it is a step, and a step limit caps the steps.

## How dsh does it

`packages/core/agent-loop/src/agent.ts` records both levels. `turn()` (line 327) writes `turn/start` (line 336), writes `step/start` and `step/end` around each step (lines 361 and 388), and writes `turn/end` with a reason (line 422). The reasons include `completed`, `max-tokens`, `blocked`, `aborted` and `error` (`packages/core/session/src/types.ts`, lines 206-221). The core loop has no fixed step count. Instead, the package `packages/guard/repeat-tool-reminder` notices the same tool call repeated 3, 5 and 8 times in a row, and adds a reminder for the model to change its approach (`src/index.ts`, line 53).

## What you have now

The agent loop now runs in turns, each made of steps, with a step limit as a safety net. One gap is left: when `notes.txt` does not exist, `runTool` throws, and the whole program crashes in the middle of a turn. How can a failing tool give the model something useful instead?
