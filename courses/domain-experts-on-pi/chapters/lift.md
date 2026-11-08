# Lift: the pass rate gained by adding the pack

Your runner says the SQL expert passes 17 of 20 tasks. Is that good? It depends. If plain pi with the same model passes 16 of the same 20, the pack added very little. A pass rate alone cannot tell you whether the pack helps.

Think of a fertiliser test. A farmer grows tomatoes with the fertiliser and gets 85 kilos. That number alone proves nothing. Perhaps the soil is good and the plants would give 80 kilos anyway.

So the farmer grows a second bed with the same seeds and soil but no fertiliser, and compares the two beds. The comparison bed is the key. One difference from the field: the farmer cannot grow both beds in the same soil. Here you can run the same task twice on the same fixture, so the two arms start equal.

Two terms are needed. The **pass rate** is the number of passed tasks divided by the number of tasks. A task passes when its score is 1. The **control** is the run without the thing you are testing. Here the control is plain pi with the same model.

**Lift** is the pass rate of the pack run (the treatment) minus the pass rate of the control. Run every task twice, once in each arm, each time in a fresh folder.

Take 20 SQL tasks. Plain pi passes 9 of them. The SQL pack passes 17.

1. Control pass rate: 9 divided by 20 is 0.45, which is 45%.
2. Treatment pass rate: 17 divided by 20 is 0.85, which is 85%.
3. Lift: 85% minus 45% is 40 percentage points.

```inkling
title "The same 20 tasks, two arms"
layout compare
columns "Plain pi (control)", "SQL pack"
row "Pass rate": "45%", "85%"!
row "Refused the delete": no, yes
steps auto
```

A lift of 40 points means the pack earns its place. A lift of 0 means it does not earn its complexity.

Lift also warns you about the task set. Suppose both arms pass 19 of 20. Both pass rates are 95%, so the lift is 0, but the reason is different: the tasks are too easy. Both arms are saturated, which means they pass nearly everything, and the set cannot tell them apart. The fix is to add harder tasks.

In `fleet`, add a flag `--variant control|pack` to `evals/runner.ts`. The pack variant runs the expert as before. The control variant runs plain pi with `--tools read,bash` and no extension, on its own copy of the fixture. Both variants write their scores to `results.jsonl`, tagged with the variant.

> **Key idea:** Lift is the pass rate of the run with the pack minus the pass rate of the control run on the same tasks.

## How pi does it

pi's evals do this for documentation. Each case runs once without the docs and once with them, and each arm runs in a fresh container (packages/evals/README.md:71-78). A run passes when its score is at least 1, and lift is the treatment rate minus the control rate (packages/evals/src/report.ts:381-397). If any pair is missing or errored, pi withholds the headline number and does not report a partial one (report.ts:380; README.md:103). It also reports flags: no-lift, negative-delta, control-saturated, treatment-saturated and flaky (report.ts:337-357).

## What you have now

You can measure what the pack adds, not only how often the expert passes. The control, the fresh folders and the judges are what make the number fair. But each task ran once in each arm, and a model does not answer the same way every time. Can you trust a single run?
