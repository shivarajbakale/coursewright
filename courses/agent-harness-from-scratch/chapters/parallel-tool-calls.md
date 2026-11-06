# Parallel tool calls: running safe requests at the same time

One model reply can hold several tool calls. Say it asks to read five files, each taking 200 milliseconds. Run one after another, that is a full second of waiting. Run together, it is about 200 milliseconds. But if the reply also contains a call that writes one of those files, running everything at once could read the file half-written. Which calls can share the time, and how do the results stay matched to their requests?

## Readers share a table, a writer works alone

Think of a library reading room. Any number of people can read the same reference book at once; reading changes nothing. Someone correcting the book needs it alone, and the readers queued behind them must wait until the correction is done, so they read the new version. The picture stops holding at the door: the reading room has no limit, while your program caps how many calls run together, so a reply with 200 reads does not open 200 files at once.

```inkling
title "How a batch of tool calls runs"
layout down
reply: box "Model reply\nfour calls" blue
step 1: reply "The reply lists four calls in order"
read1: box "read a.ts" green
read2: box "read b.ts" green
reply -> read1 : "safe"
reply -> read2 : "safe"
step 2: read1, read2 "The two reads are safe, so they run together"
read1 -> read2 : "about 200 ms"
edit: box "edit a.ts" orange
read1 -> edit : "reads finish first"
reply -> edit : "not safe"
step 3: edit "The edit runs alone, and nothing after it starts"
last: box "read a.ts" green
edit -> last : "now it starts, sees the new file"
step 4: last "The last read runs after the edit"
out: box "Results\nin call order" yellow
last -> out : "result 4"
note out "each result keeps its call id"
```

Concurrency means several pieces of work in progress at the same time. A tool declares whether its calls are safe to run concurrently, given the arguments. A read is safe; a write or a shell command is not. Parallel tool calls means running a stretch of safe calls together, while every unsafe call runs alone and acts as a barrier: nothing after it starts until it finishes. Results always go back in the order the model asked.

```ts
// src/tools.ts (additions)
// Tool gains: isConcurrencySafe?(args: Record<string, unknown>): boolean

function isSafe(ctx: Context, call: ToolCall): boolean {
  const tool = ctx.get<ToolRegistry>('tools')!.get(call.name)
  const parsed = parseArgs(call.arguments)
  return !!tool && parsed.ok && tool.isConcurrencySafe?.(parsed.args) === true
}

export async function runBatch(ctx: Context, calls: ToolCall[], signal: AbortSignal, maxParallel = 10) {
  const results: string[] = new Array(calls.length)
  let i = 0
  while (i < calls.length) {
    if (!isSafe(ctx, calls[i])) {                       // barrier: runs alone
      results[i] = await runToolCall(ctx, calls[i], signal); i++; continue
    }
    const group: number[] = []
    while (i < calls.length && isSafe(ctx, calls[i])) group.push(i++)
    let next = 0
    const worker = async () => {
      while (next < group.length) { const k = group[next++]; results[k] = await runToolCall(ctx, calls[k], signal) }
    }
    await Promise.all(Array.from({ length: Math.min(maxParallel, group.length) }, worker))
  }
  return calls.map((c, k) => ({ role: 'tool' as const, toolCallId: c.id, content: results[k] }))
}
```

Note `=== true`. A tool that returns nothing, or forgets to say, is treated as unsafe. Guessing wrong in that direction only costs time.

Each result is written into its own slot by index, so the finishing order does not matter. The worker loop is a pool: at most `maxParallel` calls run at once, and each worker takes the next waiting call when it finishes one.

Trace a reply with four calls: `read a.ts`, `read b.ts`, `edit a.ts`, `read a.ts`. The first two are safe, so they form a group and run together, taking about 200 milliseconds in place of 400. The edit is unsafe: it waits for both reads, then runs alone. The last read starts only after the edit, so it sees the edited file. The results go back in the original order, one to four, each paired with its call's id, even if `read b.ts` finished first.

Concurrency adds one subtlety to the person being asked about risky calls: only unsafe calls usually need asking, and they run alone, so two questions never appear on screen at once.

> **Key idea:** Parallel tool calls run each stretch of calls that declare themselves concurrency-safe together, up to a limit, while any other call runs alone as a barrier, and results always return in the order the model asked.

**In DeepSeek Harness:** batching lives in `packages/core/tools/src/batch.ts`. A call that is not concurrency-safe runs alone and is an ordering barrier; runs of safe calls go into a bounded rolling pool, sized by `maxParallelToolCalls`, which must be a positive integer, with a default of 10. A call is parallel only if `isConcurrencySafe(args)` returns exactly `true`; the read tool returns `true`. Results stay in the model's call order. If the turn is cancelled, calls not yet started get a synthetic "tool call aborted before dispatch" result, while a call already running is allowed to finish and is then marked aborted.

## What you have now

The pipeline now runs whole replies: safe reads share the time, writes and commands run alone, and results keep the model's order. This builds on the tool pipeline, since each call in a group still passes every hook. But a fast read of a large log file can return megabytes, far more than the context window holds. What happens to a result that is too big to send?
