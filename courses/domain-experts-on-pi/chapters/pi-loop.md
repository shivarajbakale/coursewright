# The pi loop: turns that stop without a step limit

You know the agent loop: ask the model, run the tool calls, add the results, repeat. The loop ends when a reply has no tool calls. But what if the model keeps asking for tools? Does pi count turns and cut the loop at a fixed number? It does not, and this lesson shows what ends a run instead.

Think of a taxi driver on a long job. No counter forces a stop at 100 kilometres. The driver stops when the passenger is dropped off.

A passenger can also say "stop here", and a flat tyre stops the car too. The loop is like this: it runs until one of several signals arrives. The comparison differs in one way. A driver notices a signal at any moment. The loop checks its signals only at fixed points, between steps.

Two words help here. A **hook** is a function the harness calls at a fixed point, so your code can change what happens next. An **abort** is the act of cancelling the run from outside.

## What ends a run

pi's loop has no step limit. You will not find a `maxTurns` or `maxSteps` setting in its loop or session code. A run ends for one of these reasons:

1. The model replies with no tool calls and no message waits to be sent. This is the normal end.
2. A hook named `finishTurn` returns `{ action: "end" }`.
3. Every tool result in a batch asks to stop.
4. The model reply has the stop reason `"error"` or `"aborted"`.
5. Someone aborts the run.

One more case is not an end, but it matters. A model reply can be cut off because it hit the output-token limit. Its stop reason is then `"length"`.

The last tool call in that reply may have incomplete arguments. So pi does not run the tool calls of such a reply. It marks them as failed, with an error text that says the call "was not executed: the response hit the output token limit". The model sees this and can try again.

## A cap you write yourself

Because there is no built-in limit, an expert that must not run forever adds its own cap in a `finishTurn` hook. This is a sketch of the idea, not pi's exact signature:

```ts
// sketch: roughly how a turn cap could look
let turns = 0;
const finishTurn = () => {
  turns += 1;
  if (turns >= 20) return { action: "end" };
};
```

Each time a turn finishes, the hook counts. At 20 turns it asks the loop to end. Before that, it returns nothing, and the loop goes on. The cap belongs to the expert, not to pi.

Other hooks exist at other points. Their names are `beforeToolCall`, `afterToolCall`, `prepareRequest` and `prepareNextTurn`. You only need the names now.

## Abort

An abort works through a standard Node object called an `AbortController`. pi makes one for each run. When the caller calls `abort()`, the controller sends a signal. The signal reaches the model call and every tool that runs at that moment. Both can stop early, instead of finishing work nobody wants.

```inkling
title "How a pi run ends"
layout flow
ask: box "Ask the model"
calls: diamond "Tool calls?"
run: box "Run the tools"
hook: diamond "Hook says end?"
stop: box "Run ends" green
ask -> calls : "reply arrives"
calls -> run : "yes"
calls -> stop : "no"
run -> hook : "results added"
hook -> ask : "no, next turn"
hook -> stop : "yes"
step 1: ask "The loop sends the conversation to the model"
step 2: calls "No tool calls means a normal end"
step 3: run, hook "Tools run; a hook may still end the turn"
step 4: stop "An error or an abort also ends the run"
circle stop
```

> **Key idea:** pi's loop has no step limit. It ends on a reply without tool calls, a hook's end, an error or an abort.

## How pi does it

The main loop is in `packages/agent/src/agent-loop.ts:172-330`. It ends when there are no tool calls and no queued messages (`packages/agent/src/agent-loop.ts:310-326`). It stops on the stop reasons `"error"` and `"aborted"` (`packages/agent/src/agent-loop.ts:254-265`).

A `finishTurn` hook may return `{ action: "end" }` (`packages/agent/src/agent-loop.ts:295-307`). Tool calls of a reply cut off by the token limit are failed, not run (`packages/agent/src/agent-loop.ts:273-279`). Cancellation uses one `AbortController` per run (`packages/agent/src/agent.ts:517-534`). The hooks are declared in `packages/agent/src/types.ts:193-330`.

## What you have now

You know that pi's loop is the agent loop with hooks and an abort, and that it has no step limit. A cap is something an expert adds. The open question is what happens inside one turn when a reply asks for several tools at once.
