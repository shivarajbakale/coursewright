# Handoff: one expert passing work to another

The router sends each task to one expert. Some tasks do not fit one expert. Take this question: "Which customers churned last quarter, and does our pricing explain it?" The first half is a database question. The second half needs calculation. What happens to the answer of the first half?

Think of a relay race. One runner carries the baton for a set distance and hands it to the next runner. Each runner stays in their own lane. The baton is the only thing that moves between them.

The picture differs from the field in one way. A baton is a single object that does not change. The result of an expert is text, and the next expert reads it as part of a new task.

A **handoff** passes one expert's result as part of the next expert's task. Your program does the passing, not the experts. This has three effects:

- Each expert answers only its own part, so its tools and gates cover only its own work.
- The expert never calls another expert, so no expert gets power over another domain.
- The router sees every step, so it can log the whole chain.

There is another design. An expert could start another agent itself. An agent started by another agent to do part of a task is a **subagent**. This is more flexible, but there is a cost: the first expert's guards then cover work done in another domain. For `fleet`, the router hands off. This keeps each expert boxed in.

Here is `router/chain.ts`. A step names an expert and a task. The text `{previous}` in a task becomes the result of the step before it:

```ts
import { appendFileSync } from "node:fs";
import { experts } from "./experts";

type Step = { expert: "sql" | "k8s" | "quant"; task: string };

async function run(expert: Step["expert"], task: string) {
  await experts[expert].prompt(task);
  return experts[expert].getLastAssistantText() ?? "";
}

export async function chain(steps: Step[]) {
  if (steps.length > 3) throw new Error("A chain has at most 3 steps.");
  let previous = "";
  for (const step of steps) {
    const task = step.task.replace("{previous}", previous);
    previous = await run(step.expert, task);
    appendFileSync("router/decisions.jsonl",
      JSON.stringify({ expert: step.expert, task, result: previous.slice(0, 200) }) + "\n");
  }
  return previous;
}
```

Follow one chain. The user asks the churn question. The router splits it into two steps:

1. Step one goes to the SQL expert: "List the customers with no order last quarter."
2. The SQL expert answers with a short list. The code stores it in `previous`.
3. Step two goes to the quant expert: "Using this list: {previous}. Does a 5% price rise explain the loss?"
4. The code replaces `{previous}` with the list. The quant expert reads one task that holds all it needs.
5. Each step adds a line to the log, and the chain stops at 3 steps at most.

The cap of 3 steps matters. A chain can grow without end. Each step costs tokens and can drift from the question. A hard limit keeps the cost known.

```inkling
title "A handoff through the router"
layout sequence
user: person "User"
router: box "Router"
sql: box "SQL expert"
quant: box "Quant expert"
user -> router : "Churn question"
router -> sql : "Step one task"
sql --> router : "List of customers"
router -> quant : "Step two with {previous} filled"
quant --> router : "Answer"
router --> user : "Final answer"
note router "logs every step"
steps auto
```

> **Key idea:** A handoff puts one expert's result into the next expert's task. The router does the passing, so each expert stays inside its own limits.

## How pi does it

- pi has no subagents built in (README.md:19). Its subagent example registers a `subagent` tool with single, parallel and chain modes. Chain mode fills `{previous}` in each step's task with the previous output (packages/coding-agent/examples/extensions/subagent/index.ts:10, 460-475).
- Each subagent there is a separate process: `pi --mode json -p --no-session --model ... --tools ... --append-system-prompt <file> "Task: ..."` (packages/coding-agent/examples/extensions/subagent/index.ts:298-345). The limits are 8 tasks, and 4 at once (index.ts:34-35).
- Agents are Markdown files with front matter for name, description, tools and model (packages/coding-agent/examples/extensions/subagent/agents/scout.md:1-6).

## What you have now

You can chain experts: a handoff passes one result into the next task, the router logs each step, and a cap of 3 steps bounds the cost. It builds on the router, which picks the experts, and on the sessions that hold them. You now have all the parts, so can you assemble the first complete expert from them?
