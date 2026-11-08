# Repeated runs: one run proves nothing

Your lift number came from one run of each task in each arm. Run the whole set again tomorrow. Will you get the same numbers? A model picks each next word with an element of chance, so two runs of the same task can end differently.

Think of a basketball player taking free throws. One throw that goes in does not make her a 90% shooter. You need 20 or 30 throws to see how she really shoots. The runs of an expert are like the throws. One difference: a player gets tired, so her later throws change. An expert starts each run in a fresh folder, so run five is as fresh as run one.

pi's own eval guide says it directly: "One repetition cannot establish stability." (packages/evals/README.md:105). So run each task 5 times. In `fleet`, add a flag `--repeat 5` to the runner.

With 20 tasks and 5 runs each, the pack arm makes 100 runs. The control arm also makes 100 runs. For each task, report `passes/runs` instead of one score.

Two more rules keep the comparison fair:

1. Alternate the order of the arms. Run control first on odd repetitions and pack first on even ones. If the model service is slow in the morning and fast in the afternoon, neither arm always gets the better time.
2. Do not average away the spread. A task's spread tells you more than its mean.

A task is **flaky** when it passes in some runs and fails in others, with no change between them. In `fleet`, mark a task as flaky when its passes are between 1 and runs minus 1. With 5 runs, that means 1, 2, 3 or 4 passes. A task that passes 0 times is plainly failing. A task that passes 5 times is stable.

```inkling
title "Five runs of top-customer"
layout timeline
- 1: Pass
- 2: Fail
- 3: Pass
- 4: Fail
- 5: Pass
span 1..5 "flaky: 3 of 5"
steps auto
```

Take `top-customer`. It passes 3 of 5 times, so it is flaky. Do not report 60% and move on.

Open the session files of the two failed runs. Suppose they show that the model counted refunded orders as spending. That is a real defect in the expert. The fix is a line in the skill that states the rule: refunded orders do not count. Then run the task 5 times again. A fix that works moves the task from 3 of 5 to 5 of 5.

Repeated runs also show a saturated set. If every task passes 5 of 5 in both arms, the lift is 0 because the set is easy, not because the pack is weak.

> **Key idea:** One run of a task proves nothing, so run each task 5 times and treat a task with mixed results as flaky.

## How pi does it

pi's evals alternate the repetition order for each run to reduce order bias (packages/evals/src/plan.ts:52-55; packages/evals/README.md:80). The report marks a set as flaky or saturated, and does not hide it in an average (packages/evals/src/report.ts:337-357). It also refuses to guess: "Missing telemetry remains unavailable rather than being treated as zero." (packages/evals/README.md:103).

## What you have now

You can tell a stable task from a flaky one, and you can trust a lift that comes from 5 runs per task. The runner now produces 5 scores for each task in each arm. The runs differ in more than pass or fail: one run may take 3 tool calls and another 30. How do you see what each run cost?
