# Tool pipeline: fixed checks before and after each tool

A tool call now needs several things done around it. It should be recorded in the event log before it runs. Some plugin may want to block it. Its arguments must be validated. It should time out if it hangs. Its result might need trimming, and the result must be recorded too. If each of these is written inline in the agent loop, the loop grows into a tangle, and a plugin cannot add a check without editing it. Where do these checks live, and in what order?

## The same stations, every time

Think of airport security. Every passenger passes the same stations in the same order: ticket check, bag scan, body scan, then the gate. A station can stop you. Nobody skips one, and new rules are added at a station, not by redesigning the airport. The picture stops holding in one detail: at the airport the record of your passage is kept by the staff, while here the log entry is written by the pipeline itself, before and after, whatever any station decides.

A tool pipeline is a fixed sequence of steps every tool call goes through, with waterfall hooks before and after the tool runs, and the call and its result logged. Plugins add behaviour by listening on the hooks; the sequence itself never changes.

```ts
// src/tools.ts (addition)
type Decision = { action: 'allow' } | { action: 'deny'; reason: string }

export async function runToolCall(ctx: Context, call: ToolCall, signal: AbortSignal): Promise<string> {
  const session = ctx.get<Session>('session')!
  const tools = ctx.get<ToolRegistry>('tools')!
  session.append('tool/call', call)                                   // 1. log first
  let content: string
  const decision = await ctx.waterfall<Decision>('tools/pre-execute', call,
    async () => ({ action: 'allow' }))                                // 2. may deny
  const tool = tools.get(call.name)
  const parsed = parseArgs(call.arguments)
  if (decision.action === 'deny') content = `Error: ${decision.reason}`
  else if (!tool) content = `Error: unknown tool "${call.name}"`
  else if (!parsed.ok) content = `Error: ${parsed.error}`
  else {
    const bad = checkArgs(tool.parameters, parsed.args)               // 3. validate
    content = bad ? `Error: ${bad}` : await ctx.waterfall<string>('tools/execute', call,
      () => tool.execute(parsed.args, signal)).catch((e) => `Error: ${e.message}`)   // 4. run, wrapped
  }
  content = await ctx.waterfall<string>('tools/post-execute', call, content,
    async () => content)                                              // 5. may replace result
  session.append('tool/result', { toolCallId: call.id, content })     // 6. log result
  return content
}
```

Walk through it. The call is logged before anything can go wrong, so a crash halfway still leaves a recorded request. The pre-execute hook runs next; its innermost action answers "allow", so with no listeners every call is allowed. A listener can return a denial without calling `next`. Validation and execution follow; the execute hook wraps the tool body, which is where a timeout or a timer belongs. The post-execute hook gets the finished text, and a listener may return different text. Finally the result is logged with the call's id, and every path reaches that line.

A timeout plugin is now a few lines, and the loop never changes:

```ts
const timeout: Plugin<{ ms: number }> = (ctx, config) => {
  ctx.on('tools/execute', (call: ToolCall, next: () => Promise<string>) =>
    Promise.race([next(), new Promise<string>((_, no) =>
      setTimeout(() => no(new Error(`${call.name} timed out after ${config.ms} ms`)), config.ms))]))
}
```

With `ms: 30000`, a tool still running at 30 seconds produces `Error: run_command timed out after 30000 ms`. (A complete version would also abort the tool's signal and clear the timer.)

One rule keeps the pipeline honest: hooks may block or replace a result, but never change the arguments. The arguments in the log, the ones shown on screen and the ones the tool runs with must be the same.

> **Key idea:** A tool pipeline is a fixed sequence around every call: log the call, run the pre-execute hook, validate, execute inside a wrapping hook, run the post-execute hook, log the result; plugins extend it only through those hooks.

**In DeepSeek Harness:** `docs/tool-execution-pipeline.md` and `packages/core/tools/src/pipeline.ts` define ten stages. The `tool/call` session event is logged first; `tools/pre-execute` may answer allow, deny, cancel or ask; guards that can only deny follow; `tools/execute` wraps the body for timeout, retry and metrics; `tools/post-execute` may accept, replace content, block or add context; `tools/result` is observe-only; the `tool/result` event is logged last. Hooks cannot rewrite arguments "because history, audit, UI, and execution must agree". The timeout guard is a `tools/execute` wrapper producing `TOOL_TIMEOUT`.

## What you have now

Every tool call now flows through one fixed pipeline built from waterfall hooks, with validation in the middle and the event log at both ends. Plugins add rules by listening, not by editing the loop. The pre-execute hook can allow or deny, but some calls are neither clearly fine nor clearly wrong. What should happen when only the person at the keyboard can decide?
