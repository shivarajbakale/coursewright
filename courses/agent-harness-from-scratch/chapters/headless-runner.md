# Headless runner: one task without a screen, then exit

You want to run `minidsh` from a script or a nightly job: give it one task, get the answer on standard output, and an exit code that says whether it worked. Nobody is watching, so there is no conversation to keep open. The tricky question is when to stop. The top agent going idle is not enough. It may have ended its turn on purpose because two helpers are still working, and their answers will wake it again. Stop too early and you print "I have started two reviews" and lose the real answer. How do you know the work is truly done?

## Closing time

A restaurant does not close the moment one table goes quiet. It closes when every table has paid and the kitchen has no orders left. A table that looks finished may still be waiting for dessert.

The picture stops holding in one way: here a finished "kitchen order", a helper's answer, wakes the table again. So you cannot check once. You check, wait for whatever is still busy, and check again, until a check finds nothing busy at all.

First, `Agent` needs a way to wait for idle. Keep a list of waiters and release them at the end of `wake`:

```ts
private idleWaiters: (() => void)[] = []
whenIdle(): Promise<void> {
  return this.running ? new Promise(r => this.idleWaiters.push(r)) : Promise.resolve()
}
// last line of wake():  this.idleWaiters.splice(0).forEach(r => r())
```

Then `src/cli.ts`:

```ts
const task = process.argv[2]
const agent = createAgent({ approval: 'never' })   // no person to ask

ctx.on('agent/assistant-stream', (a, chunk) => {
  if (a === agent && chunk.type === 'text-delta') process.stderr.write(chunk.text)
})

async function waitForTree(a: Agent): Promise<boolean> {
  const busy = a.allDescendants().filter(c => c.running)
  await Promise.all(busy.map(c => c.whenIdle()))
  return busy.length > 0
}

agent.followup({ role: 'user', content: task })
while (true) {
  await agent.whenIdle()
  const waited = await waitForTree(agent)
  if (!waited && !agent.running) break
}
await agent.session.flush()
console.log(agent.lastAssistantText())
process.exit(agent.lastTurnEnd()?.reason === 'completed' ? 0 : 1)
```

Run it with `npx tsx src/cli.ts "summarize README.md"`.

## Following the loop

Say the task makes the top agent start two helpers.

1. Turn 1 ends with "I have started two reviews". `whenIdle` resolves.
2. `waitForTree` finds `child-1` and `child-2` running and waits for both. It returns `true`, so the loop goes round again.
3. Each child's answer was delivered as a followup, so the top agent is running turn 2. `whenIdle` waits for it.
4. `waitForTree` now finds no busy descendants and returns `false`. The top agent is idle. The loop breaks.
5. The log is flushed to disk, the final answer goes to standard output, and the process exits 0 because turn 2 ended `completed`.

Two choices here are worth noticing. Live text goes to standard error and only the final answer to standard output, so a script can capture `stdout` cleanly. And since no person is present, approval is set to `never`: as the approval rule says, anything but a clear yes means no, so risky calls are refused rather than hanging forever on a question nobody will answer.

> **Key idea:** A headless runner starts one task with no screen, loops "wait for the agent to be idle, then wait for any busy descendant" until a full pass finds nothing busy, then flushes the log, prints the final answer and exits with a status code.

**In DeepSeek Harness:** `dsh --profile headless "task"` runs `packages/bundle/headless/src/index.ts`. It sends the task with `agent.followup`, then loops on `agent.whenIdle()` and `subagents.waitForTreeWork(agent)`, also checking the session's last `seq` did not change, because "child settlement can wake the parent before the child wait observes it." It flushes the session, prints the final text (or newline-delimited JSON with `--json`, in `json-stream.ts`) and exits 0 only when the turn completed. The headless profile is plain config rows: `packages/bundle/headless/cordis.patch.yml` inserts the runner and patches `sandbox-policy` by id.

## What you have now

`minidsh` can now run one task from a script, wait for its whole tree of agents and exit cleanly, using the inbox, the helper results and the live event stream. A script is one kind of user. How does a person in a browser send prompts and watch the same events?
