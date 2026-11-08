# Expert metrics: tokens, tool calls and cost per domain

Pass or fail is one number. A run has others. Two packs can both pass 17 of 20 tasks, while one uses three times the tokens of the other. Which one would you ship? You can only choose if you can see what each run cost.

Think of a delivery company, where one run is one delivery round. Counting parcels delivered tells you little. You also want the fuel used, the stops made and the hours driven, for each driver. Then you can see that one driver delivers the same parcels with half the fuel. One difference: fuel is measured at the pump. An expert's cost is measured in tokens, and a token has a price only when pi has a price list for the model.

pi counts for you. A session object has a method, `session.getSessionStats()`. It returns these fields (packages/coding-agent/src/core/agent-session.ts:356-373):

- `userMessages`, `assistantMessages`, `toolCalls` and `toolResults`: counts.
- `tokens`: an object with `input`, `output`, `cacheRead`, `cacheWrite` and `total`.
- `cost`: the money for the run.
- `contextUsage`: how full the context window is.

Cost is only known when pi has prices for the model. For DeepSeek V4.1 Flash the catalog lists three prices, in dollars per million tokens: input 0.3, output 1.2 and cacheRead 0.006 (packages/ai/catalog/providers/deepseek.ts:18). Take a run with 1,000,000 input tokens and 100,000 output tokens, and ignore the cache.

1. Input: 1,000,000 tokens is 1 million, and 1 times 0.3 is 0.30 dollars.
2. Output: 100,000 tokens is 0.1 million, and 0.1 times 1.2 is 0.12 dollars.
3. Total: 0.30 plus 0.12 is 0.42 dollars.

Now tag every number with the name of the expert. In `fleet`, the runner writes one line to `results.jsonl` for each run:

```ts
{ expert: "sql", task: "top-customer", score: 1, tokens: 18400, toolCalls: 3, cost: 0.006, ms: 9100 }
```

The numbers in this line are an example. The tag `expert` is what makes the totals useful. Later the same file holds lines for `k8s` and `quant`, and one script can sum them all. A script of 10 lines does it:

```ts
import { readFileSync } from "node:fs";

const rows = readFileSync("results.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const by: Record<string, { runs: number; passes: number; tokens: number; toolCalls: number; cost: number }> = {};
for (const r of rows) {
  const t = (by[r.expert] ??= { runs: 0, passes: 0, tokens: 0, toolCalls: 0, cost: 0 });
  t.runs += 1; t.passes += r.score >= 1 ? 1 : 0;
  t.tokens += r.tokens; t.toolCalls += r.toolCalls; t.cost += r.cost;
}
console.table(by);
```

```inkling
title "From a run to a table per expert"
layout down
run: box "One run"
stats: box "getSessionStats"
log: box "results.jsonl"
table: box "Table per expert"
run -> stats -> log -> table
steps auto
```

Read the table next to the lift. A pack that adds 40 points of lift and uses three times the tokens is a trade-off, and now you can see it.

> **Key idea:** Expert metrics are the tokens, tool calls, cost and time of each run, tagged with the expert's name, so you can compare experts.

## How pi does it

pi's own eval harness records the same numbers from `getSessionStats` (packages/evals/src/harness.ts:391-411). pi also has a telemetry package. It defines metrics but sends nothing, and pi-coding-agent does not use it. The only call pi makes to count anything is an install ping. You turn it off with `PI_TELEMETRY=0` or `PI_OFFLINE` (packages/coding-agent/src/core/settings-defaults.ts:32; packages/coding-agent/docs/environment-variables.md:87).

## What you have now

You can see what every run cost and sum it by expert. With golden tasks, graders, a runner, lift, repeated runs and metrics, you can show whether an expert does its job and what it costs. So far you measure one expert at a time. How do several experts work in one system?
