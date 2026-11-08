# Codemode: one script that calls many tools

A quant expert needs a year of daily prices to compute an average. If the model calls a price tool and reads every row, 250 prices fill the context window. Each step also costs one trip to the model. Is there a way to do the work without the rows ever reaching the model?

Think of asking an assistant to total a pile of receipts. You can ask for one receipt at a time and add the numbers in your head. Or you can hand over a short list of instructions: "open the pile, add every amount, tell me the total". The assistant does the long work and tells you only the answer.

**Codemode** is the second way. The model writes a short JavaScript program instead of calling tools one by one. The comparison differs in one way: a human assistant can do anything, but the program here can do only what its sandbox allows.

The program runs in a sandbox: a closed space that limits what a program can reach. It runs in **QuickJS**, a small JavaScript engine. pi runs QuickJS compiled to WebAssembly, separate from Node. The sandbox has no file system, no network, no timers, no `fetch`, no `process` and no `require`. Its only power is calling the tools it was given.

In a script, tools are functions: `tools.<name>(args)`. You can use `console.log` and `return`. `searchTools()` and `describeTool()` find a tool and show its schema. Only what the script prints or returns goes back to the model.

Here is a script for the quant expert. Its `prices` tool takes `{ symbol, from, to }` and returns daily closes:

```ts
const rows = await tools.prices({ symbol: "AAPL", from: "2025-01-01", to: "2025-12-31" });
const closes = rows.map((r) => r.close);
const window = 20;
const last = closes.slice(-window);
const avg = last.reduce((a, b) => a + b, 0) / window;
return { days: closes.length, movingAverage20: avg, lastClose: closes[closes.length - 1] };
```

```inkling
title "One call per step against one script"
layout compare
columns "One tool call per step", "One codemode script"
row "Round trips": "many", "one"
row "Prices in context": "all 250", "none"
row "Guards still apply": "yes", "yes"
step 1: round-trips "A script makes one round trip to the model"
step 2: prices-in-context "Only the summary numbers come back"
step 3: guards-still-apply "Each call inside the script passes through the normal tool path"
```

Follow the script. It calls `prices` once. The 250 daily prices stay inside the sandbox. JavaScript takes the last 20 closes and computes their average. The script returns three numbers. Because of this, the model reads three numbers, not 250 rows, and it spent one round trip.

The guards still work. Every call from a script goes through pi's normal tool pipeline, so schemas and guards apply to each call. A script cannot do what a direct call may not do.

The script has limits:

- 256 MB of memory.
- At most 2 workers per process, unless `PI_CODEMODE_MAX_WORKERS` is set.
- Output of 10,000 tokens by default.
- No time limit by default. A script can set one with `// @options: {"timeout_ms": 60000}`.

The tool is named `codemode`. Turn it on by adding `codemode` to `--tools`. It also switches on when MCP tools use the codemode exposure.

> **Key idea:** Codemode lets the model write one sandboxed script that calls many tools, so only the script's output enters the context.

## How pi does it

- The sandbox has no file system, network, timers, fetch, process or require (packages/codemode/README.md:3-5; packages/coding-agent/docs/codemode.md:7).
- Script calls go through the normal tool pipeline (packages/coding-agent/src/extensions/codemode/execute.ts:540).
- The script functions are listed at packages/coding-agent/docs/codemode.md:22-38. The timeout option is at packages/coding-agent/docs/codemode.md:16.
- The memory limit is at packages/coding-agent/src/extensions/codemode/execute.ts:56, the worker limit at execute.ts:57-64 and the output limit at execute.ts:306.
- The tool turns on as described at packages/coding-agent/src/extensions/codemode/index.ts:1-7.

## What you have now

You have a way to let the model combine many tool calls in one script, with the same guards on each call. It builds on the MCP server, whose default exposure feeds this tool. How do you gather these pieces into a whole expert for one domain?
