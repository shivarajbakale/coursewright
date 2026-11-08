# Headless runner: one task, then exit

With a live event stream, a screen can follow an agent as it works. Not every user has a screen. A build server wants to run "fix the failing test" at 3 a.m., read the answer from a file, and know if the work succeeded. It cannot click a button or read a chat window. How does a program use the agent with only a command line?

## A note under the door

Think of a repair person you leave a note for. You write one job on the note and leave. The next morning you find two things: a written report, and a green or red tag on the door. You do not talk to them while they work. The tag tells you the result before you read the report.

In the harness, the note is the task text, the report is the final answer on standard output, and the tag is the exit code. An **exit code** is the number a process returns to the program that started it; `0` means success and any other number means failure. The comparison differs in one way: the repair person decides if the tag is green, but the runner reads the result from the record, not from what the model says.

## The runner in mini-dsh

The runner lives in `src/headless.ts`. It starts the plugin tree from a profile, then does six things.

```ts
export async function runHeadless(ctx: Context, task: string): Promise<number> {
  const { agent } = await ctx.agents.create({ sessionId: `session-${randomUUID()}` })
  const firstSeq = agent.session.all().length
  const stopReasoning = ctx.on('agent/assistant-stream', ({ agent: subject, frame }) => {
    if (subject === agent && frame.type === 'chunk' && frame.chunk.type === 'reasoning-delta') {
      process.stderr.write(frame.chunk.text)
    }
  })
  agent.followup(task)
  await agent.whenIdle()
  stopReasoning()
  await ctx.get('sessions')!.flush(agent.session)   // write pending events to the JSONL file
  const { text, reason } = summarize(agent.session.all().slice(firstSeq))
  process.stdout.write(text + '\n')
  if (reason?.kind === 'error') process.stderr.write(`dsh: ${reason.error.code}: ${reason.error.message}\n`)
  return reason?.kind === 'completed' ? 0 : 1
}

function summarize(events: SessionEvent[]) {
  let text = ''
  let reason: TurnEndReason | undefined
  for (const event of events) {
    if (event.type === 'assistant/message') {
      const joined = textOf(event.data.content)
      if (joined !== '') text = joined
    }
    if (event.type === 'turn/end') reason = event.data.reason
  }
  return { text, reason }
}
```

The `sessions` service from the agent registry keeps each session's `SessionFile`, and its `flush(session)` calls `SessionFile.flush()`.

Run it as `mini-dsh --profile headless "How many lines are in notes.txt?"`:

1. Create a fresh agent. The record starts at seq 0, so `firstSeq` is 0.
2. Send live reasoning to standard error. Standard output stays clean for the answer alone.
3. Give the task as a followup. The turn runs: a tool call, a tool result, then a text answer.
4. Wait until the agent is idle. The record now ends at seq 12 with `turn/end`, reason `completed`.
5. Save the record to its JSONL file. A later run can then resume this session.
6. Fold the events from `firstSeq` into one answer. The last non-empty text is "notes.txt has 42 lines.", and the exit code is `0`.

If the model ran out of output tokens, the last `turn/end` reason is `max-tokens`. The runner still prints the text it has, and it returns `1`. A script can then test the code with `if mini-dsh ...; then` and never parse the answer.

> **Key idea:** A headless runner sends one task, waits for idle, prints the final text, and exits with 0 only if the last turn completed.

```inkling
title "One headless run"
layout sequence
shell: person "Script"
runner: box "Runner"
agent: box "Agent"
record: db "Record"
shell -> runner : "task text"
runner -> agent : "followup(task)"
agent -> record : "turn/start ... turn/end"
agent --> runner : "idle"
runner -> record : "read events from firstSeq"
runner --> shell : "answer and exit code 0"
steps auto
```

## How dsh does it

The runner is `packages/bundle/headless/src/index.ts`. Its `run()` function (line 322) creates a `session-<uuid>` agent, keeps `firstSeq` (line 407), sends the task with `agent.followup` (line 420), and waits for idle and for any child work. It flushes the session (line 435), and `summarize()` (line 84) returns the last non-empty `assistant/message` text and the last turn's reason. `io.exit` returns 0 only for `completed` (line 443). With `--json`, `src/json-stream.ts` prints one JSON event per line instead: `session`, `status`, `text`, `thinking`, `tool_call`, `tool_result` and a closing `final`.

## What you have now

A profile gives the harness its plugins, and the live event stream lets the runner print reasoning while it waits. The headless runner turns every part of the harness into one command that a script can call. But it accepts one task and exits. How does another program keep one agent alive and send it many prompts?
