# Background job: work that runs while the agent continues

The goal driver keeps an agent working across turns. But the shell tool waits for its command to finish, and a full build takes 10 minutes. For those 10 minutes the step stays open and the model can do nothing else. A timeout would kill the build instead. How can a command run on while the agent continues with other work?

## A ticket at the dry cleaner

Think of a dry cleaner. You hand in a coat and receive a ticket with a number. You do not wait at the counter; you go and do your other errands. The shop keeps the coat on a rack with that number. When it is ready, the shop sends you a text.

If you are at home, the text makes you go and collect it. If you are busy, you read it at your next break.

A background job is that ticket. The bash tool can start a command as a job and return at once with a job id. The harness keeps the command's output in a buffer for that id. When the command ends, the harness puts a notice in the agent's inbox. The picture differs in one way: the rack holds the whole coat, but the buffer has a size cap and keeps only the newest output, so the start of a very long log is gone.

```inkling
title "One job from start to notice"
layout sequence
model: box "Model"
bash: box "bash tool"
jobs: db "Job registry"
inbox: box "Agent inbox"
model -> bash : "npm run build, in background"
bash -> jobs : "start job"
bash --> model : "job id bash-3f9a0c1d2e4b5a67"
jobs -> jobs : "output into buffer"
jobs -> inbox : "notice when the job ends"
inbox --> model : "next step reads it"
steps auto
```

## Jobs in mini-dsh

The registry is a service in `src/jobs.ts`:

```ts
export class JobRegistry {
  private jobs = new Map<string, Job>()

  start(owner: Agent, kind: string, label: string, run: (out: (t: string) => void) => Promise<Outcome>): string {
    const id = `${kind}-${randomUUID().replaceAll('-', '').slice(0, 16)}`
    const job: Job = { id, owner, label, status: 'running', ring: new OutputRing(256 * 1024) }
    this.jobs.set(id, job)
    owner.session.append('job/registered', { jobId: id, kind, label, startedAt: Date.now() })
    run(text => job.ring.append(text)).then(outcome => this.settle(job, outcome))
    return id
  }

  private settle(job: Job, outcome: Outcome): void {
    job.status = outcome.status
    job.owner.session.append('job/settled', { jobId: job.id, status: outcome.status, finishedAt: Date.now() })
    const notice = userMessage({
      content: [{ type: 'text', text: `background job ${job.id} finished [${outcome.status}]. Output:\n${job.ring.tail(2048)}` }],
      source: { kind: 'jobs', form: 'notice' },
    })
    if (job.owner.status === 'idle') job.owner.followup(notice)
    else job.owner.inject(notice)
  }
}
```

The bash tool gets a `run_in_background` parameter. With it set, the tool calls `start` and returns the id. Two more tools read and control jobs: `job_output` returns the output since the last read, and `job_kill` stops a job. `OutputRing` adds each chunk and drops the oldest chunks when the total passes its cap.

Trace a build:

1. Step 1 calls bash with `npm run build` and `run_in_background: true`. The result is `bash-3f9a0c1d2e4b5a67`.
2. In steps 2 to 6, the model edits the docs. The build writes 300 KiB of log. The ring keeps the newest 256 KiB.
3. The build ends during step 7. The agent is busy, so the notice is an inject.
4. Step 8 claims the notice and reads the last lines of the log.

If the agent was idle, the notice would be a followup, and it would open a new turn.

> **Key idea:** A background job runs a command under an id with a capped output buffer; an inbox notice tells the agent when it ends.

## How dsh does it

Three packages share the work. `packages/jobs/jobs` defines `ctx.jobs` and ids of the form `<kind>-` plus 16 hexadecimal characters. `packages/jobs/jobs-local/src/index.ts` keeps 256 KiB of output per running job and 16 KiB after it ends (lines 37 and 40), and at most 10 jobs per owner (line 34). `packages/jobs/tool-jobs/src/index.ts` registers `job_output`, `job_list` and `job_kill`, and delivers the notice: `owner.followup(message)` for an idle owner under the default `wakeup` delivery, and `owner.inject(message)` otherwise (lines 398-410). Output up to 2,048 bytes goes inline in the notice. Each job writes `job/registered` and `job/settled` to its owner's session.

```inkling
title "The job packages in dsh"
layout down
bashtool: box "shell/tool-bash\nrun_in_background"
jobs: box "jobs/jobs + jobs-local\nctx.jobs" yellow
tooljobs: box "jobs/tool-jobs\njob_output, job_kill"
agent: box "Owner agent's inbox"
bashtool -> jobs : "start a bash job"
tooljobs -> jobs : "read and stop"
jobs -> tooljobs : "settled event"
tooljobs -> agent : "followup or inject"
step 1: bashtool, jobs "bash starts a job in the registry"
step 2: tooljobs "Job tools read its buffer and stop it"
step 3: agent "The settled event becomes a notice"
```

## What you have now

An agent can now start long commands and go on with other work, and the inbox tells it when each one ends. Every job here still starts because the model asked for it in a step. What if the agent must start work at a set time, such as every morning at 9:00, with nobody prompting it?
