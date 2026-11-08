# Tool batch: calls run together unless one says no

The pi loop keeps a turn alive while the model asks for tools. One reply can ask for several at once. A model that needs three files writes three tool calls into the same reply, instead of taking a new reply for each file. That raises two questions. Does pi run those calls one after another, or at the same time? And in what order does the model read the results?

Picture a cook with three pots on one stove. All three heat at the same time, and the cook stirs each pot in turn. The order the cook checks the pots does not change how they heat. pi works in a similar way, with one difference. The cook sees a pot only when the cook reaches it. The model reads the results in the order it asked for them, even when a later call finishes first.

pi runs calls together by default. It reads the calls in the order the model wrote them, and it checks each one against its rules in that same order. Then it starts every allowed call at the same moment and waits for all of them. The results go back as tool result messages, in the order the model asked. The name for this is **parallel**: two or more jobs run at the same time, and the set finishes when its slowest job finishes.

```inkling
title "A batch runs together, or one by one"
layout compare
columns "All run together", "One call is sequential"
row "Runs at once": "yes", "no"
row "Result order": "as the model asked", "as the model asked"
row "Good for": "reading files", "changing data"
step 1: runs-at-once "By default every allowed call starts at the same moment"
step 2: result-order "Results always come back in the order the model asked"
step 3: one-call-is-sequential "One sequential call makes the whole batch wait its turn"
```

A small case. The model's reply asks to read `a.ts`, read `b.ts`, read `c.ts`, and run a migration command on a database. The reads do no harm, so pi starts all three at the same moment. A read that takes 40 milliseconds does not add 40 milliseconds to the others. The three reads take about as long as the slowest one.

The migration changes data, and two changes to the same table can conflict. So the migration tool carries one extra field:

```ts
executionMode: "sequential"
```

Sequential means one after another. One such call changes the whole batch. When any call in the batch carries this field, pi runs the entire batch one by one, in the order the model asked. The four calls then take the sum of their times, not the time of the slowest. That is the price of a safe order, and it is worth paying when a change is in the batch.

A failure does not end the turn. A tool that throws becomes an error result. The other results in the batch still arrive, and the model reads the error and decides what to do next. The loop does not crash because one tool failed.

> **Key idea:** Tool calls from one reply run in parallel by default, and one sequential call makes the whole batch run in order.

## What you have now

You have the rest of the turn: which calls run, when each starts, and in what order the results return. With the loop, that tells you how pi spends a turn, and it shows the cost of a safe order. The session is still a straight line of messages that only grows, so what happens when you want to return to an earlier point and take another path?

## How pi does it

The message types say it in one phrase: results are emitted "in assistant source order" (packages/agent/src/types.ts:309-317). The switch is a single condition, `if (config.toolExecution === "sequential" || hasSequentialToolCall)`, which runs the calls one by one (packages/agent/src/agent-loop.ts:525-532). A tool that throws becomes an error result at agent-loop.ts:855-863.
