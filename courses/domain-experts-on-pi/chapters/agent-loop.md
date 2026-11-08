# The agent loop: ask, run the tool, send back, repeat

A model can reply with a tool call, and your program can run it. One exchange answers one request. Real tasks need more. A user asks "Why did the build fail?" The model must read the log, run a command, then answer. Who asks the model again after the first tool result?

Think of a cook working with a helper in the next room. The cook reads the recipe, writes a note, and the helper returns with flour. The cook looks at the new state of the bench and writes the next note. The cook never leaves the kitchen.

Here the cook is the model, the helper is your program, and the notes are the conversation. One difference matters: a cook remembers the kitchen between notes. The model does not. It keeps nothing between requests, so your program sends the whole conversation again on every pass.

## One question, three turns

Take the build question, with token counts. A token is one small piece of text.

1. The program sends 320 tokens: the instructions and the question. The model replies with a tool call, `read_file` with `{ "path": "build.log" }`. That reply is 30 tokens.
2. The program runs the tool. The tool result is 400 tokens of log. The conversation now holds 750 tokens: 320 + 30 + 400.
3. The program sends all 750 tokens. The model reads the log and replies with a second tool call, `run_command` with `{ "command": "make build" }`. That reply is 25 tokens. The command prints 90 tokens of error text.
4. The conversation now holds 865 tokens: 750 + 25 + 90. The program sends all 865. This time the model replies in plain text: "The build fails because a test file is missing." It makes no tool call. The loop ends.

One user question took three requests and two tool runs. This is normal. A model that reads a file, runs a command and then answers needs at least three passes.

## The loop in code

The program that repeats these passes is short. This is TypeScript-like pseudocode, not a real API:

```ts
while (true) {
  const reply = await model(messages);
  messages.push(reply);
  const calls = toolCalls(reply);
  if (calls.length === 0) break;
  for (const call of calls) {
    messages.push(await run(call));
  }
}
```

Read it in order. `model(messages)` sends the whole list and returns one reply. The reply is pushed onto the list, so the next request contains it. `toolCalls` picks the calls out of the reply. If there are none, `break` leaves the loop: the reply is the answer. If there are calls, each one runs, and each result is pushed onto the list. Then the loop asks again.

```inkling
title "The agent loop"
layout cycle
center "until no tool calls"
ask: circle "Ask the model"
run: circle "Run the tools"
add: circle "Add results"
cycle ask, run, add
step 1: ask "Send the whole conversation"
step 2: run "Each requested tool runs"
step 3: add "Its result joins the list"
```

The list only grows in this sketch. Nothing is removed. That is why the context window matters: after enough turns the list no longer fits, and the program must shorten it before it can send.

These passes have a name. One **turn** is one assistant reply plus the tool calls and results that come with it. The example above has three turns.

> **Key idea:** An agent loop sends the whole conversation, runs each tool call, adds the result, and stops when a reply has no tool calls.

## How pi does it

pi's loop lives in `packages/agent/src/agent-loop.ts`, and the main loop runs from line 172 to line 330. pi writes the same rule into its types: a turn is "one assistant response + any tool calls/results" (`packages/agent/src/types.ts:532-534`). The loop exits when the model makes no tool call and no message waits to be sent (`packages/agent/src/agent-loop.ts:310-326`).

## What you have now

You know that a tool call is one request, and that a loop turns many requests into one answer. You also know why the whole conversation goes out each time: the model keeps nothing. A program owns this loop, the tool list and the instructions.
