# Batch scheduling: running safe calls side by side

The tool registry gives each step a list of tools. One model reply can hold several tool calls at once: read `a.txt`, read `b.txt`, read `c.txt`, then run the tests with `bash`. Running every call one after another is safe but slow. Running them all at once is fast, but two calls can then touch the same file at the same moment, and the result depends on which one finishes first. Which calls may run at the same time?

## A kitchen with one stove

Think of a kitchen with several cutting boards and one stove. Three cooks can chop vegetables side by side, because no cook needs another cook's board. A pan on the stove is different: only one cook uses it at a time, and the others wait until it is free. The head cook decides before any work starts. Chopping goes in parallel, and the stove work goes one at a time.

In a harness, chopping is a call that only reads, and the stove is a call that can change things. The comparison differs in one way. A head cook can look at the vegetables and judge. A harness cannot look inside a tool body. It runs a call next to others only when the tool itself says, for those exact arguments, that the call is safe.

```inkling
title "One at a time versus scheduled"
layout compare
columns "One at a time", "Scheduled"
row "Three reads": "300 ms", "100 ms"!
row "bash tests": "2000 ms", "2000 ms"
row "Total": "2300 ms", "2100 ms"!
row "Results in model order": yes, yes
step 1: three-reads "Safe reads overlap, so three take as long as one"
step 2: bash-tests "A call that can change files runs alone"
step 3: total "The batch finishes sooner"
step 4: results-in-model-order "The model still gets results in the order it asked"
```

## The smallest scheduler

A tool opts in with one more field in defineTool: `isConcurrencySafe(args)`, which returns `true` when this call may overlap with others. `count_lines` and a read tool return `true`. A tool that writes or runs commands leaves the field out.

Here is the scheduler in `src/batch.ts`. It walks the calls in model order and forms groups.

```ts
export async function runBatch(calls: ToolCall[], tools: ToolsService, maxParallel = 10): Promise<ToolResult[]> {
  const results: ToolResult[] = []
  let next = 0
  while (next < calls.length) {
    const group = [calls[next]]
    if (isSafe(tools, calls[next])) {
      while (next + group.length < calls.length && group.length < maxParallel
        && isSafe(tools, calls[next + group.length])) group.push(calls[next + group.length])
    }
    results.push(...await Promise.all(group.map(call => runOne(tools, call))))
    next += group.length
  }
  return results
}

function isSafe(tools: ToolsService, call: ToolCall): boolean {
  try { return tools.get(call.name)?.isConcurrencySafe?.(call.input) === true } catch { return false }
}
```

Trace the reply above. Each read takes 100 ms and the tests take 2000 ms.

1. Classify the first call, read `a.txt`. It is safe, so the group grows with `b.txt` and `c.txt`.
2. Stop the group at `bash`. bash has no `isConcurrencySafe`, so it is not safe.
3. Run the three reads together. They finish after 100 ms.
4. Run `bash` alone in its own group. It finishes 2000 ms later, so the batch takes 2100 ms in all.

Run one after another, the same batch takes 2300 ms. Suppose `b.txt` finishes before `a.txt`. `Promise.all` still returns results in call order, so the record and the model see them in the order the model asked.

`isSafe` only accepts the exact value `true`. A missing field, a thrown error or a value such as `"yes"` all mean "run alone". When the harness is unsure, it chooses the slow, safe path.

**Concurrency** means two or more pieces of work are in progress at the same time. A **batch** is all the tool calls in one model reply.

> **Key idea:** Batch scheduling runs a call next to others only when its tool returns exactly true for its arguments; every other call runs alone.

## How dsh does it

`executeToolBatch` in `packages/core/tools/src/batch.ts` (line 50) schedules each step's calls. Calls that are not safe are "exclusive" and form barriers, and safe calls share a rolling pool. The native executor sets the pool size to 10 (`packages/core/tool-executor-native/src/index.ts`, line 11). `executionMode` in `pipeline.ts` (lines 105-114) returns parallel only when `isConcurrencySafe` returns exactly `true`, and defineTool returns `false` for arguments that fail the check (`schema.ts`, lines 626-631). The `read` tool in `packages/fs/tool-fs/src/read.ts` (line 136) opts in, and `bash` does not.

```inkling
title "Who schedules a batch in dsh"
layout flow
loop: box "agent-loop\nend of a step"
tools: box "dsh-tools\nctx.tools.execute"
native: box "tool-executor-native\npool of 10"
read: box "tool-fs read\nsafe" green
bash: box "tool-bash bash\nruns alone" orange
loop -> tools -> native
native -> read : "parallel"
native -> bash : "exclusive"
circle native
step 1: loop, tools "The loop hands the reply's calls to ctx.tools"
step 2: native "The native executor runs executeToolBatch"
step 3: read "Calls that say they are safe share the pool"
step 4: bash "Every other call runs alone, as a barrier"
```

## What you have now

The harness now runs each reply's calls in safe groups and keeps their results in model order. Every call that reaches a group still runs, whatever it does. How does the harness stop a call it should not run at all?
