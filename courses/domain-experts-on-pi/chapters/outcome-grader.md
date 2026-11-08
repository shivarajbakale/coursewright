# Outcome grader: a check on the files and results left behind

A golden task says what a correct outcome looks like. Now a program must decide, after a run, whether the expert reached it. The easy way is to read the expert's final reply. If it says "Done, I removed the refunded orders", is the task done?

Think of a builder who tells you the wall is finished. You do not take the builder's word. You walk to the wall and look at it. A grader does the same: it looks at what the run left behind. One difference: you look once, by eye. A grader looks the same way on every run, because it is code.

The reply can mislead. A model can say "done" and have done nothing, or have done the wrong thing. So the grader checks the outcome:

- The number in the answer, against the right number.
- The files or the database after the run.
- Which tools the expert called, and with which arguments.

```inkling
title "Two ways to grade a run"
layout compare
columns "Grade the reply text", "Grade the outcome"
row "Fooled by 'done'": yes, no
row "Repeatable": partly, yes
row "Needs fixture": no, yes
steps auto
```

The outcome needs a fixture, so you know what the right result is and what the database looked like before. That is the price, and golden tasks already pay it.

A **judge** is a function that scores one run, from 0 to 1. Here is a judge for the task `revenue-de-2025`. It finds the numbers in the final text and passes if one is within 1% of the expected number.

```ts
function numberClose(text: string, expected: number, tol: number): boolean {
  const found = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/g) ?? [];
  return found.some((n) => Math.abs(Number(n) - expected) <= Math.abs(expected) * tol);
}

const score = numberClose(finalText, 48210.5, 0.01) ? 1 : 0;
```

Work it through. The allowed gap is 48210.5 times 0.01, which is 482.105. The reply "Revenue was $48,210.50" holds the number 48210.50. Its gap is 0, so the score is 1. The reply "$51,000" has a gap of 2789.5, which is more than 482.105. The score is 0.

`evals/graders.ts` holds two more judges. `dbUnchanged(before, after)` compares a SHA-256 hash of `shop.db` before and after the run. A different hash means the database changed. `calledTool(session, "sql_query")` looks through the tool calls in the session messages. The session file is JSONL, and it is the source of truth for which tools ran. The model's own account of what it did is not.

> **Key idea:** An outcome grader scores a run by checking what it left behind, not what the expert's reply says.

## How pi does it

pi's evals grade the final state of the session with an `output` function and with judges such as `StructuredOutputJudge` and `ToolCallJudge({ expectedTools: [{ name, arguments }] })` (packages/evals/evals/extensions.docs.eval.ts:28-39). Their rule is: "Eval files should contain only scenario setup, the model task, and deterministic grading." (packages/evals/README.md:127). The harness also rejects any run whose stop reason is not stop or toolUse. A crashed run is therefore never scored as a pass (packages/evals/src/harness.ts:247-251).

## What you have now

You can turn a golden task into a score of 0 or 1 by checking facts. Each judge reads a fixture and a result, so the fixture must be fresh for every run. Who sets that up, for each task, every time?
