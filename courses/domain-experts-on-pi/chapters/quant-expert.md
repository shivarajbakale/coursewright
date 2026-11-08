# The quant researcher: a backtesting expert that works in scripts

The first two experts work in small steps: one query, one command. A quant researcher works on hundreds of numbers at once. If every price passes through the model, the context window fills and the arithmetic goes wrong. How should this expert work?

Think of a lab assistant who has a calculator. You ask: "What is the average of these 250 readings?" You do not read the 250 numbers aloud. The assistant types them into the calculator and tells you the result. The picture differs from the field in one way. The assistant checks the answer by feel. A script has no feel, so you check it against a second calculation.

The quant researcher works through codemode. The model writes one short JavaScript program. The program fetches prices with the `prices` tool, does the arithmetic and returns a short summary. The 250 prices stay inside the script. Only the summary reaches the model.

The task is a **backtest**: running a trading rule over past prices to see how it would have done. The rule here is a moving-average crossover. Buy when the average of the last 20 closes rises above the average of the last 50. Sell when it falls below.

The `prices` tool takes `{ symbol, from, to }` and returns daily closes from a local CSV fixture. In this pack it returns a list of numbers, oldest first. The model sends this script. The first line sets a timeout of 60 seconds:

```js
// @options: {"timeout_ms": 60000}
const closes = await tools.prices({ symbol: "AAPL", from: "2025-01-01", to: "2025-12-31" });
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
let holding = false, entry = 0, trades = 0, equity = 1, peak = 1, maxDrawdown = 0;
for (let i = 50; i < closes.length; i++) {
  const fast = avg(closes.slice(i - 20, i));
  const slow = avg(closes.slice(i - 50, i));
  if (!holding && fast > slow) { holding = true; entry = closes[i]; trades++; }
  else if (holding && fast < slow) { holding = false; equity *= closes[i] / entry; }
  const mark = holding ? equity * closes[i] / entry : equity;
  peak = Math.max(peak, mark);
  maxDrawdown = Math.max(maxDrawdown, (peak - mark) / peak);
}
if (holding) equity *= closes[closes.length - 1] / entry;
return { trades, totalReturn: equity - 1, maxDrawdown };
```

Read the script in three steps. It starts the loop at day 50, so both averages have enough days. It tracks `equity`, which starts at 1 and grows or shrinks with each trade. It tracks `maxDrawdown`, the largest fall from a peak. The result is three numbers: `trades`, `totalReturn` and `maxDrawdown`.

This saves context. One year has about 250 closes. They never enter the conversation. The model reads 3 numbers.

The sandbox is a guard. A script has no network and no file access, and its only power is to call the tools it was given. Calls from the script go through the normal tool pipeline, so schemas and gates still apply. The `timeout_ms` option stops a loop that never ends.

Run the expert like this. The flag `--tools codemode` turns codemode on:

```sh
PI_CODING_AGENT_DIR=agents/quant pi --model deepseek/deepseek-flash \
  --system-prompt packs/quant/prompt.md -e packs/base/extension.ts \
  -e packs/quant/extension.ts --tools codemode
```

The graders check numbers, never prose. The test recomputes the same backtest in plain TypeScript on the same fixture. It passes the run if the expert's `totalReturn` is within 0.1 percentage points of the test's value:

```ts
const expected = backtest(closes);          // plain TypeScript, same rule
const pass = Math.abs(answer.totalReturn - expected.totalReturn) <= 0.001;
```

One more task needs a refusal. If the user asks for tomorrow's price, the expert must say it cannot know. The grader checks that the reply refuses and gives no price.

```inkling
title "A backtest in one script"
layout sequence
model: box "Model"
sandbox: box "Codemode sandbox"
prices: box "prices tool"
model -> sandbox : "One script"
sandbox -> prices : "tools.prices(AAPL, 2025)"
prices --> sandbox : "250 closes"
note sandbox "adds up the returns here"
sandbox --> model : "3 numbers"
steps auto
```

> **Key idea:** The quant researcher does its arithmetic in a codemode script, so many prices stay in the sandbox and the model reads only a short summary.

## How pi does it

- Nested calls from scripts go through the normal tool pipeline (packages/coding-agent/src/extensions/codemode/execute.ts:540). The sandbox has 256 MB of memory (execute.ts:56).
- A script has no file system or network (packages/coding-agent/docs/codemode.md:7). The timeout option is in packages/coding-agent/docs/codemode.md:16.
- The `--tools` list can switch codemode on (packages/coding-agent/src/extensions/codemode/index.ts:1-7).

## What you have now

You have three experts: a reader, an operator and a researcher. The quant researcher adds codemode and graders that compare numbers with a second calculation. Each expert now has its own prompt, tools, gates and evals. How do the router, the base pack and the experts work together on one real task?
