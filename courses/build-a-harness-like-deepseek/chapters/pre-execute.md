# Pre-execute decision: allow, deny or ask before a tool runs

With batch scheduling, every call in a reply reaches a group and runs. Some calls should never run. A model can ask `bash` to run `rm -rf build` when you only asked it to read the code. The rule against that should not live inside the bash tool. Several plugins may each want a say: one blocks deletions, another logs every call, a third asks a person about anything risky. How do many plugins each decide about a call before its body runs?

## A security desk

Think of a building with a security desk at the entrance. A visitor stops at the desk. Each guard on the desk can wave the visitor on to the next guard, turn the visitor away, or phone upstairs and ask. After the desk, a locked turnstile checks one last list of banned names. The turnstile can only refuse. It has no button that lets anyone in.

In a harness, the visitor is a tool call, the desk guards are listeners on a waterfall hook, and the turnstile is a guard function. The comparison differs in one way. A desk guard can ask the visitor to change their badge. A listener cannot change a call's arguments, because the call is already in the record exactly as the model wrote it.

```inkling
title "Two checks before a tool body"
layout down
call: box "Tool call"
desk: box "pre-execute listeners\n(waterfall)"
d: diamond "Decision"
guards: box "Guards\n(deny only)" yellow
body: box "Tool body" green
err: box "Error result" red
call -> desk -> d
d -> guards : "allow"
d -> err : "deny"
guards -> body : "no reason"
guards -> err : "a reason"
circle guards
step 1: call, desk "Every call first passes the listener chain"
step 2: d, err "Any listener can deny, and the body never runs"
step 3: guards "An allowed call still meets every guard"
step 4: body "Only a call no guard refuses reaches the body"
```

## The smallest pre-execute check

A listener on `tools/pre-execute` receives the call and a `next` function, and returns a decision: `{ kind: 'allow' }`, `{ kind: 'deny', reason }`, or `{ kind: 'ask', reason }`. The ask decision puts the question to a person; the next lesson builds it. A guard is a plain function that returns a reason to refuse, or `undefined`. `tools.guard` adds one and returns its disposer, so the plugin calls it inside an effect.

```ts
// A policy plugin
ctx.on('tools/pre-execute', async (call, next) => {
  if (call.name === 'bash' && String(call.input.command).includes('rm -rf')) {
    return { kind: 'deny', reason: 'rm -rf is not allowed here' }
  }
  return next()
})
const tools = ctx.get<ToolsService>('tools')!
ctx.effect(() => tools.guard(call =>
  call.name === 'write' && String(call.input.path).startsWith('/etc') ? 'writes to /etc are blocked' : undefined))
```

The pipeline in `src/pipeline.ts` runs both checks before the body:

```ts
async function prepare(ctx: Context, call: ToolCall): Promise<Decision> {
  const decision = await ctx.waterfall('tools/pre-execute', call, async () => ({ kind: 'allow' }))
  if (decision.kind !== 'allow') return decision
  const reason = ctx.get<ToolsService>('tools')!.checkGuards(call)
  return reason === undefined ? decision : { kind: 'deny', reason }
}
```

A deny becomes a tool error result with the text `Error: <reason>`, so the model can read why and choose another way. Trace three calls:

1. Check `bash "rm -rf build"`. The policy listener returns deny, so the result is `Error: rm -rf is not allowed here`.
2. Check `write /etc/hosts`. Every listener calls `next`, and the end of the chain returns allow. The guard then returns a reason, so the call is denied.
3. Add a careless plugin whose listener runs first and returns allow without calling `next`. Check `bash "rm -rf build"` again. The policy listener never runs, so the call is allowed.

Step 3 is why guards exist. In a waterfall, a listener that skips `next` stops every listener after it. A **guard** has no allow answer and runs after the whole chain. Because of this, no listener order can turn a guard's refusal back into permission.

> **Key idea:** A pre-execute waterfall decides allow, deny or ask for each call; after an allow, guards can still deny but never allow.

## How dsh does it

`ToolExecutionPipeline.prepare` in `packages/core/tools/src/pipeline.ts` (line 190) runs the `tools/pre-execute` waterfall with a default of allow (line 199). The four decisions, `allow`, `deny`, `cancel` and `ask`, are `PreToolDecision` in `contracts.ts` (line 357), which notes that "Input rewriting is excluded because arguments are already logged". `ctx.tools.guard` (`index.ts`, line 384) registers a `ToolGuard` (`contracts.ts`, line 391), and guards run only when the decision is allow (`pipeline.ts`, line 213). Before any listener runs, the pipeline copies the arguments and deep-freezes them (lines 153-157).

## What you have now

Each call now passes an ordered chain of listeners and then a set of guards, built on the waterfall hook. A denied call returns an error result without running. The third decision, ask, is still open: who answers it, and what happens when nobody can?
