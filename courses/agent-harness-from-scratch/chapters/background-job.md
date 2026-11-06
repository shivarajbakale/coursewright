# Background job: a command that keeps running meanwhile

The model asks to run `npm test`. On a large project that takes four minutes. A tool call blocks its step, so the agent sits frozen for four minutes and the person sees nothing happen. Worse, some commands never end at all: a development server runs until you stop it. A timeout would kill both. What you want is to start the command, get a handle back at once, keep working, and hear about it when it ends.

## Starting the washing machine

You load the washing machine, press start and go do something else. You can glance at the display whenever you like, and it beeps when it finishes. You do not stand in front of it for an hour.

```inkling
title "A background job"
layout sequence
model: person "Model"
tool: box "bash tool"
proc: box "npm test"
inbox: sticky "Agent inbox"
model -> tool : "run npm test in background"
tool --> model : "Started job-1"
tool -> proc : "start, keep running"
model -> inbox : "the agent keeps working"
proc --> inbox : "exit code and last output"
inbox -> model : "the agent wakes and reads failures"
steps auto
```

The picture stops holding in two places. The machine's display shows a fixed amount, but a command can print without limit, so you must decide how much output to keep. And the beep is not a sound: it is a message, delivered to the agent's inbox, the same way a helper agent's answer arrives.

In `minidsh`, add a small job registry to `src/agents.ts`:

```ts
import { spawn } from 'node:child_process'
import { confine } from './sandbox.ts'

type Job = { id: string; output: string; exitCode?: number }
export const jobs = new Map<string, Job>()
const KEEP = 64_000            // characters of output kept per job
let jobCount = 0

export function startJob(agent: Agent, command: string): Job {
  const job: Job = { id: `job-${++jobCount}`, output: '' }
  const [cmd, ...args] = confine(['bash', '-c', command], agent.sandboxPolicy)
  const proc = spawn(cmd, args)
  const keep = (b: Buffer) => { job.output = (job.output + b).slice(-KEEP) }
  proc.stdout.on('data', keep)
  proc.stderr.on('data', keep)
  proc.on('close', code => {
    job.exitCode = code ?? -1
    deliver(agent, {
      role: 'user',
      content: `<job id="${job.id}" exit="${job.exitCode}">\n${job.output.slice(-2000)}\n</job>`,
    })
  })
  jobs.set(job.id, job)
  return job
}
```

The command still runs inside the same fence as any other: `confine` is the sandbox runner. Then give the bash tool an optional `run_in_background` argument. When it is true, the tool calls `startJob` and returns `Started job-1` at once. A second tool, `job_output`, takes an id and returns the job's kept output so far, so the model can peek. A third, `job_kill`, stops one.

## A trace

1. Step 1: the model calls bash with `npm test` and `run_in_background: true`. The result is "Started job-1".
2. Steps 2 to 4: the model reads and edits files while the tests run.
3. The tests print 200,000 characters. Only the last 64,000 stay in `job.output`, so memory stays bounded.
4. The agent's turn ends; it is idle.
5. The tests exit with code 1. `deliver` sends a followup with the exit code and the last 2,000 characters. The agent wakes and starts a turn to read the failures.

Had the agent still been mid-turn, `deliver` would have steered instead, and the note would join its next step.

> **Key idea:** A background job is a command started without waiting for it: the tool returns an id at once, the output is kept in a bounded buffer the model can read on demand, and the command's completion arrives later as a message in the agent's inbox.

**In DeepSeek Harness:** `ctx.jobs` (`packages/jobs/jobs`) is a registry of background processes. The local version (`packages/jobs/jobs-local`) keeps each job's output in an `OutputRing` (`ring.ts`), a bounded buffer with a read cursor. `packages/jobs/tool-jobs` adds `job_output`, `job_list` and `job_kill`. The bash tool (`packages/shell/tool-bash`) registers every call as a job: `run_in_background` returns the id at once, and a foreground call that times out becomes a job instead of being killed. A completion notice wakes the agent, subject to a wake budget. The same pattern brings in other later work: the goal round driver (`packages/goal/goal-round-driver`) and scheduled tasks (`packages/schedule`) also reach the agent as inbox messages.

## What you have now

Everything that finishes later, a helper agent or a long command, now comes back the same way: a user message in the inbox that wakes the agent and is recorded in its event log. All of this happens inside one process with no screen. How does a person watch the words and tool calls appear while it runs?
