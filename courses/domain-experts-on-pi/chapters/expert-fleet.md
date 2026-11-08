# The expert fleet: every part joined end to end

The router, the base pack and three experts each do one job. What happens when one task passes through all of them? Where does each part do its work, and what does it leave behind for you to check?

Think of a delivery company. A parcel passes the front desk, a sorting hub, a van and a doorstep. At every stop someone scans it. If a parcel goes wrong, you read the scans and see which stop failed.

The picture differs from the field in one way. Scans are made by people who remember the parcel. Your logs are all the memory the fleet has.

Take this task: "Monthly revenue in Germany for 2025, and would a 5% price rise have paid off?" Here is its path:

1. The router reads the task. A rule sees `revenue` and picks the SQL expert.
2. The classifier also says the task needs the quant expert. The router builds a chain of 2 steps.
3. The SQL expert starts as an SDK session. The base pack loads first, then the SQL pack.
4. The model reads the `monthly-revenue` skill and calls `sql_query`. The schema accepts the call and the gate allows the SELECT.
5. The result comes back, and the email mask runs on it before the model sees it.
6. The router takes the 12 monthly numbers and puts them into the quant expert's task.
7. The quant expert writes one script, and the sandbox returns a few numbers.
8. The router logs both steps. The user gets one answer.

Everything leaves a trace. `router/decisions.jsonl` holds the task, the choice and the reason for each step. Each expert has its own session file, so two files record the full conversation. The base pack's `fleet-log` entries record each tool call and how long it took. The eval runner writes `results.jsonl` for the runs you test.

Each expert has the same eight parts. Check them as a list:

- A prompt: the role and the rules.
- Skills: procedures for common tasks.
- A tools allowlist: only the tools the job needs.
- Gates: code that blocks or changes a call.
- A container: the box the process runs in.
- An agent folder: its own settings and sessions.
- Evals: golden tasks with graders.
- Metrics: tokens, tool calls and cost per run, tagged by expert.

```inkling
title "One task through the fleet"
layout down
task: box "Task"
router: box "Router"
sql: box "SQL expert"
quant: box "Quant expert"
answer: box "Answer"
logs: box "Logs and sessions"
task -> router : "revenue and a price rise"
router -> sql : "rule: revenue"
sql -> quant : "12 numbers, via the router"
quant -> answer : "script result"
router -> logs : "decisions.jsonl"
sql -> logs : "session file"
quant -> logs : "session file"
step 1: task "One task needs two experts"
step 2: router "The router picks the SQL expert and plans a chain"
step 3: sql "The SQL expert reads the database through its gates"
step 4: quant "The quant expert gets the numbers from the router"
step 5: answer "The user gets one answer"
step 6: logs "Every step leaves a line or a session file"
```

> **Key idea:** A fleet is a router, a base pack and boxed experts joined by logs. Every task leaves a trace, so mistakes can be found.

Now the maintenance loop. A wrong route or a failed task becomes a new golden task. You rerun the evals with repeats, so a flaky task shows up. You compare lift and cost by expert before you ship a change. A change ships when the lift holds and the cost stays acceptable. If a pack passes more tasks but uses three times the tokens, you see that trade-off before users do.

## How pi does it

- The loop: packages/agent/src/agent-loop.ts:172-330.
- The session file: packages/coding-agent/src/core/session-manager.ts:41.
- Prompt sections: packages/coding-agent/src/core/system-prompt.ts:128-192.
- The `tool_call` event: packages/coding-agent/src/core/extensions/types.ts:1270-1275.
- The SDK options: packages/coding-agent/src/core/sdk.ts:48-106.

## What you have now

You have a complete fleet: a router, a base pack, three experts, containers, evals and logs, all traced through one task. Every part rests on pi's loop, its events and its session file. The next step is yours: take a task from your own work, write its golden task and run it against a new pack.
