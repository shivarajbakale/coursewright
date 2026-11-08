# Around-execute wrapper: adding timeouts around a running tool

After the pre-execute decision and approval, an allowed call reaches its body. A body can hang. A tool that fetches a web page can wait for a slow server for minutes, and the whole turn waits with it. You also want to measure how long each tool takes, and perhaps try a flaky call a second time. None of this belongs inside each tool. How does the harness add work around a running tool body, before it starts and after it ends?

## Layers of wrapping paper

Think of a parcel wrapped in several layers. To reach the gift, you open the outer layer, then the next, then the box. When you pack it again, you close the box first and the outer layer last. Each layer surrounds everything inside it.

In a harness, the gift is the tool body, and each layer is a listener on a waterfall hook named `tools/execute`. A listener runs code, calls `next()` to open the layer inside it, and runs more code when `next()` returns. The comparison differs in one way. Paper cannot stop the gift. A wrapper can tell the body to stop, but only through a signal the body must check.

```inkling
title "Wrappers around one tool body"
layout stack
- Timing wrapper
- Timeout wrapper
  - Swaps in a deadline signal
- Tool body
brace timing-wrapper..timeout-wrapper "tools/execute listeners"
step 1: timing-wrapper "The outer wrapper starts a clock and calls next"
step 2: timeout-wrapper "The next wrapper adds a deadline to the call's signal"
step 3: tool-body "The body runs and watches that signal"
```

## The smallest timeout wrapper

A tool declares a time budget with one more defineTool field, `timeoutMs`. Its body passes `exec.signal` to every slow operation. Here is a tool that fetches a page:

```ts
const fetchUrl = defineTool({
  name: 'fetch_url',
  description: 'Fetch a web page as text.',
  parameters: { url: { type: 'string', required: true } },
  timeoutMs: 5000,
  output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
  async execute(args, exec) {
    const response = await fetch(args.url, { signal: exec.signal })
    return response.text()
  },
})
```

The pipeline calls the body inside `ctx.waterfall('tools/execute', call, () => runBody(call))`. The timeout plugin in `src/plugins/timeout.ts` is one listener on that waterfall:

```ts
ctx.on('tools/execute', async (call, next) => {
  const timeoutMs = ctx.get<ToolsService>('tools')!.get(call.name)?.timeoutMs
  if (timeoutMs === undefined) return next()
  const timer = AbortSignal.timeout(timeoutMs)
  const upstream = call.signal
  call.signal = AbortSignal.any([upstream, timer])
  try {
    const result = await next()
    if (!timer.aborted) return result
    return { isError: true, content: [{ type: 'text', text: `Error: tool call timed out after ${timeoutMs}ms` }] }
  } finally {
    call.signal = upstream
  }
})
```

Trace a call to a server that takes 8 seconds to answer:

1. Start the wrapper. It finds `timeoutMs` 5000 and replaces the call's signal with one that also aborts at 5000 ms.
2. Run the body. `fetch` receives the new signal and waits.
3. Reach 5000 ms. The timer aborts the signal, so `fetch` rejects and the body throws.
4. Return to the wrapper. `timer.aborted` is true, so it replaces the error with `tool call timed out after 5000ms`.
5. Restore the old signal in `finally`. Listeners that run later never see this plugin's deadline.

The turn waited 5 seconds, not 8. Now suppose a body runs a loop that never reads its signal. The timer fires at 5000 ms, but nothing in the body checks it, so `next()` returns only when the loop ends. A wrapper in the same process cannot kill code that ignores the signal. This kind of timeout is cooperative: the body agrees to stop.

A **timeout** is a time budget after which a piece of work must stop. A timing wrapper or a retry wrapper has the same shape: work before `next()`, work after it.

> **Key idea:** An around-execute wrapper is a tools/execute listener that surrounds the body, and a timeout works only through a signal the body honours.

## How dsh does it

`dispatch` in `packages/core/tools/src/pipeline.ts` (lines 295-302) runs the `tools/execute` waterfall around `dispatchToolBody`. The body receives a signal that joins the caller's signal with any wrapper's signal (lines 262-263). The timeout plugin is `packages/guard/timeout-policy/src/index.ts`: it reads the tool's `timeoutMs` (line 57), swaps `exec.signal` (line 66), and returns a result with the code `TOOL_TIMEOUT` only when its own timer fired (line 73). `contracts.ts` (line 36) states that the executor "cannot hard-kill same-process code".

## What you have now

Wrappers now surround each body with work before and after it, and a timeout stops a body that watches its signal. The body has returned a result, but that result is not yet final. How can a plugin change or block a result before the model sees it?
