# Faux provider: a scripted model inside pi

Golden tasks check the expert's judgement, and that needs a real model. But your pack also holds plain code: tools, gates and result rewrites. Suppose a gate must block `DELETE FROM orders`. To test it, must you pay a model to decide to send that query, and hope it does so on every run?

Think of a rehearsal for a play. The real lead actor is busy and costs money. So a stand-in reads the lines from a script, and the rest of the cast rehearses against the stand-in. The cast learns whether the stage and the props work. The stand-in differs from a real model in one way: it never decides anything. It says exactly what the script says, in order.

pi has such a stand-in. It is the **faux provider**: a model provider inside pi-ai that plays replies you queued in advance. A reply can be text, or a tool call. The real pi session runs, and your real extension loads. Only the model is scripted. Because of that, the test is fast, costs nothing and gives the same result every time.

Three builders make the replies: `fauxText`, `fauxToolCall(name, args)` and `fauxAssistantMessage(content, { stopReason })` (packages/ai/src/providers/faux.ts:55-102). You put them in a queue. Each model call from the session takes the next reply from the queue.

Here is how pi's own tests queue two replies. The first asks for a tool call. The second is the final answer.

```ts
harness.setResponses([
  fauxAssistantMessage([fauxToolCall("echo", { text: "x" })], { stopReason: "toolUse" }),
  fauxAssistantMessage("done"),
]);
await harness.session.prompt("go");
```

The `harness` is pi's internal test helper. For `fleet` you build the session yourself, and this course's project shows the exact wiring. The idea carries over. For the SQL gate, the queue holds two replies. The first is a tool call to `sql_query` with `{ sql: "DELETE FROM orders" }`. The second is the text "ok".

```inkling
title "A gate test with no real model"
layout sequence
test: box "Test"
faux: box "Faux provider"
session: box "pi session"
gate: box "SQL gate"
test -> faux : "queue two replies"
test -> session : "prompt"
session -> faux : "ask the model"
faux --> session : "call sql_query"
session -> gate : "check the call"
gate --> session : "error: one SELECT only"
steps auto
```

Then the test reads the tool result. It asserts that the result is an error that contains "Only one SELECT statement is allowed." That proves the gate works, without a model.

A reply can also be a function. It sees the conversation so far, so it can react to a tool result (faux.ts:110-117). If the queue runs empty, the next call returns an error, "No more faux responses queued" (faux.ts:529-541). A test that fails with that message asked for more model calls than you scripted.

> **Key idea:** A faux provider plays queued replies in place of a model, so you can test a pack's code without a real model.

## How pi does it

pi tests itself this way. Its test guide says "Use the faux provider" and "Do not use real provider APIs, real API keys, network calls, or paid tokens" (packages/coding-agent/test/suite/README.md:5-10). The queue is managed with `setResponses`, `appendResponses` and `getPendingResponseCount` (packages/ai/src/providers/faux.ts:135-145).

## What you have now

You can test your pack's code with scripted replies. Golden tasks with a real model check the judgement, so you need both. A golden task still needs a program that decides pass or fail. How does it decide?
