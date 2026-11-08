# Package layers: models, the loop and the coding agent

The last lesson left a question. Which code writes the session file, runs the loop and calls the model? pi does all three jobs, but its source is not one block. It is a stack of three packages, and each one sits on the package below it.

Think of a three-storey building. The ground floor has the telephone lines that reach the outside world. The first floor holds the people who decide what to do next. The top floor is the shop where customers walk in. Each floor uses the floor below it and knows nothing about the floors above.

The comparison differs in one way. You cannot lift a floor out of a building and put it under another roof. These three floors are separate bundles, and a program can install the bottom one alone or the bottom two, without the top.

The bottom bundle is `@earendil-works/pi-ai`. It holds the message types, the stream of reply pieces, and the code that sends a request to a model service. It depends on no agent code.

Above it is `@earendil-works/pi-agent-core`, in the folder `packages/agent`. It holds the loop and the `Agent` class. It depends only on pi-ai.

The top bundle is `@earendil-works/pi-coding-agent`, in the folder `packages/coding-agent`. It holds the `pi` command, sessions, the system prompt and the tools. It depends on pi-agent-core and pi-ai.

```inkling
title "Three layers, each built on the one below"
layout stack
- pi-coding-agent
  - The pi command
  - Sessions
  - The system prompt
  - The tools
- pi-agent-core
  - The Agent class
  - The loop
- pi-ai
  - Message types
  - The reply stream
- The model services
step 1: the-model-services "A model service answers one request"
step 2: pi-ai "pi-ai carries the messages and the reply stream"
step 3: pi-agent-core "pi-agent-core runs the loop and asks you for the model call"
step 4: pi-coding-agent "pi-coding-agent adds the command, the sessions, the prompt and the tools"
```

The middle package shows why the order matters. Suppose your program uses pi-agent-core alone. You create an `Agent` and ask it to take one turn. The loop is there, but no call to a model is. You must give the loop a function that sends the request and returns the reply. Without one, it stops:

```
No default stream function configured. Pass streamFn explicitly or call setDefaultStreamFn().
```

The message gives two ways to supply the function: pass `streamFn` when you create the agent, or call `setDefaultStreamFn()` once. With either one, the loop has a model call. Because pi-agent-core never names a model service, a program can pair it with any of them.

Each of the three is an **npm package**: a named, versioned bundle of JavaScript code that you install with npm.

> **Key idea:** pi is three stacked packages: models, then the loop, then the coding agent, and each layer works without the layers above it.

An expert in this course sits on the top package, pi-coding-agent, so it gets the loop and the model layer for free. The repository also holds helper packages, such as mcp and codemode, which later lessons use.

## How pi does it

The three packages live in three folders of the repository: `packages/ai`, `packages/agent` and `packages/coding-agent`. The pi-ai entry file states its job in one line, "Core only, side-effect free" (packages/ai/src/index.ts:1-5). The middle package treats a missing model call as an error (packages/agent/src/stream-fn.ts:15-19). The comment above that check gives the reason: the loop does not carry a catalogue of model services (packages/agent/src/stream-fn.ts:8-9).

## What you have now

You can now name the three parts of pi and say what each one holds. pi-ai carries messages and replies, pi-agent-core runs the loop, and pi-coding-agent adds the command, the sessions, the prompt and the tools. As with the harness, the top part is what you meet and the lower parts do the work underneath. That leaves the loop itself: what it does in one turn, and when that turn ends.
