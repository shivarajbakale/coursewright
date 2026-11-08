# Workflow: a script that runs many agents

The agent team lets children share a task board. But the parent still starts each child with one tool call. To review 30 files, it calls the subagent tool 30 times. Then 30 settlement notices arrive in its inbox, each one more text in its history. The model already knows the whole plan before it starts. Could it write that plan once, as a program?

## A recipe card for a kitchen team

Think of a head chef who writes a recipe card for a banquet: "Three cooks each make one sauce at the same time. When a sauce is ready, a fourth cook plates it." The kitchen follows the card. The chef reads only the final note: "3 dishes plated, 1 sauce burned." The chef does not stand beside each cook.

A workflow is that card. The model writes a short JavaScript script and passes it to one `workflow` tool. As you saw with programmatic tool calling, the script runs in a separate process, not in the harness. The script can call a few functions that the harness provides. The main one is `agent(prompt)`: it starts a child, waits for it to finish, and returns the child's final text.

The picture differs in one way. A cook who burns a sauce tells the chef. A child that fails returns `null`, and the script decides what to do with it.

```inkling
title "One workflow call"
layout right
model: box "Parent's model"
script: box "Workflow script"
c1: round "agent: a.ts"
c2: round "agent: b.ts"
c3: round "agent: c.ts"
out: sticky "One tool result"
model -> script : "workflow tool"
script -> c1
script -> c2
script -> c3
c1 --> out
c2 --> out
c3 --> out
step 1: model, script "The model writes the plan as a script"
step 2: c1, c2, c3 "The script starts three children at once"
step 3: out "The parent receives only the script's return value"
```

## A script and its hooks

Here is a script a model might write. `args` holds the input the tool call passed:

```js
phase('review')
const reviews = await parallel(args.files.map(f => () => agent(`Review ${f} for bugs. List each bug.`)))
phase('fix')
const fixes = await pipeline(reviews.filter(Boolean), review => agent(`Fix these bugs:\n${review}`))
return { reviewed: args.files.length, fixed: fixes.filter(Boolean).length }
```

The `parallel` function runs functions at the same time and waits for all of them. The `pipeline` function sends each item through its stages without waiting for the other items. `phase` only labels progress for a person watching.

In mini-dsh, the harness side of `agent()` is in `src/workflow.ts`:

```ts
async function agentHook(prompt: string): Promise<string | null> {
  if (++started > MAX_TOTAL_AGENTS) throw new WorkflowError('agent cap reached', { fatal: true })
  await slots.acquire()   // at most MAX_CONCURRENT children run at once
  try {
    const run = await ctx.get('subagents')!.start({ parent, prompt, delivery: 'caller' })
    const result = await run.result
    return result.stopReason === 'completed' ? textOf(result.output) : null
  } finally {
    slots.release()
  }
}
```

`delivery: 'caller'` is the difference from the subagent tool. The script awaits the result itself, so no settlement notice goes to the parent's inbox. A tripped cap is fatal: it ends the whole script, because a broken plan must fail loudly, not look like one failed child.

Trace the script with 3 files:

1. `parallel` starts 3 review children. The review of `b.ts` ends in an error, so its item is `null`.
2. Keep the 2 reviews that `filter(Boolean)` lets through. Then `pipeline` starts 2 fix children, and both complete.
3. The script returns `{ reviewed: 3, fixed: 2 }`.
4. The `workflow` tool returns that value with `agentsStarted: 5`. The parent's history grows by one tool call and one result.

> **Key idea:** A workflow is a script the model writes once, whose agent() calls start children and return their answers to the script, not to the parent.

## How dsh does it

`packages/workflow/tool-workflow` registers the `workflow` tool, whose description lists the hooks and says "The script has no filesystem, network, timer, or Node.js APIs; the agents do the work." `packages/workflow/workflow-ptc` provides `ctx.workflowEngine` and runs the script in the same kind of separate Node process that programmatic tool calling uses. Its `startChild` calls `ctx.subagents.startActivation` with `delivery: 'caller'` (`host.ts`, line 206). The defaults are 1,000 children per run and at most min(16, max(1, CPU count - 2)) at once (`index.ts`, lines 109 and 142).

```inkling
title "The workflow packages in dsh"
layout down
tool: box "tool-workflow\nworkflow tool"
engine: box "workflow-ptc\nctx.workflowEngine" yellow
proc: box "Separate Node process\nruns the script"
subs: box "subagent\nctx.subagents"
tool -> engine : "start(script, meta, args)"
engine -> proc : "script body"
proc -> engine : "agent(prompt)"
engine -> subs : "startActivation, caller delivery"
step 1: tool "The model's call reaches the tool"
step 2: engine "The engine checks meta and parses the script"
step 3: proc "The script runs away from the harness"
step 4: subs "Each agent() starts one child"
```

## What you have now

You can now run many agents in three ways: one child per tool call, a shared task board, and a script that plans the whole fan-out. All of them finish inside a turn or report back when they finish. Some work lasts longer than any one turn. How does one agent keep track of a long job across many turns?
