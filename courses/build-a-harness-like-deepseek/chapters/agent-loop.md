# The agent loop: ask, run, send back, repeat

With a tool result, your program can answer one tool call. But the model often needs more than one. To fix a bug, it may read a file, then run the tests, then read a second file. Who decides when to stop asking?

## A cook and a helper

Think of a cook who works from a recipe and a helper in the kitchen. The cook says "bring me the flour". The helper brings it. The cook looks at it and says "now the eggs".

This continues until the cook says "the cake is done". The helper never decides what comes next. The helper only fetches and reports.

In an agent, the model is the cook and your program is the helper. The comparison differs in one way: the model does not remember the flour. As you saw with the stateless model, each request must carry the whole history, so the helper repeats every earlier request and answer each time.

```inkling
title "The agent loop"
layout cycle
center "until the model answers in text"
ask: circle "Ask the model"
run: circle "Run the tool"
back: circle "Send the result back"
cycle ask, run, back
step 1: ask "The program sends the history and the tool schemas"
step 2: run "The model asked for a tool, so the program runs it"
step 3: back "The result joins the history for the next request"
```

## The smallest loop

Here is the loop in TypeScript. `callModel` sends one request to DeepSeek and returns the reply. `runTool` runs one function by name.

```ts
async function agent(messages: Message[]): Promise<string> {
  while (true) {
    const reply = await callModel(messages, tools)
    messages.push({ role: 'assistant', content: reply.content })
    if (reply.stop_reason !== 'tool_use') {
      return textOf(reply.content)
    }
    const results = []
    for (const block of reply.content) {
      if (block.type === 'tool_use') {
        const output = await runTool(block.name, block.input)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: output })
      }
    }
    messages.push({ role: 'user', content: results })
  }
}
```

Trace one question, "How many lines are in notes.txt?", through it:

1. The program sends 1 user message. The model replies with a `tool_use` block for `count_lines`, and the stop reason is `tool_use`.
2. The program runs `count_lines` and gets `42`. It adds the assistant reply and a `tool_result` with the same call id. The history now has 3 messages.
3. The program sends all 3 messages. The model replies "notes.txt has 42 lines." with the stop reason `end_turn`.
4. The stop reason is not `tool_use`, so the loop returns the text.

The model made every decision. The program only ran what it asked for and sent the results back. The stop reason tells the program which case it is in.

> **Key idea:** The agent loop sends the history, runs every tool the model asks for, adds the results, and repeats until the model replies in text.

## How dsh does it

DeepSeek Harness keeps the same shape in `packages/core/agent-loop/src/agent.ts`. Its `turn()` method opens with a `turn/start` record and repeats steps in a `while (true)` loop. Each step sends one request, runs the requested tools through `ctx.tools.execute`, and decides if another step is owed. The real loop also handles queued messages, cancellation and errors, which later lessons cover one at a time.

## What you have now

You have the whole cycle: a tool schema tells the model what it may ask for, a tool call asks, and a tool result answers, again and again. The loop above has one dangerous gap: nothing stops it if the model keeps asking for tools forever. How many requests may one answer take?
