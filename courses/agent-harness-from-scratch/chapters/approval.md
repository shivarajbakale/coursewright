# Approval: asking the person before a risky action

The pre-execute hook can allow a call or deny it. But think about `run_command` with `rm -rf build`. That might be exactly what you wanted, or a disaster. No rule written in advance can tell. Only the person at the keyboard knows. How does a tool call pause and wait for that person to decide, and what happens when nobody is there to answer?

## A signature before the cheque clears

Think of a bank that phones you before a large transfer. The transfer waits. If you say yes, it goes through once. If you say no, hang up, or never pick up, it does not go through. Silence is not consent. The picture stops holding in one way: the bank might try calling again later, while here an unanswered question is final for that call, and the model is told so straight away.

Approval means pausing a risky tool call to ask the person, where only a clear yes lets it run. The answer is one of a small, closed set of outcomes, so no code path can invent a fifth answer that slips through:

```inkling
title "A risky call waits for approval"
layout down
call: box "Risky tool call" yellow
person: person "Person"
ask: diamond "Explicit y?"
run: box "Call runs once"
deny: box "Call is denied"
call -> ask : "Ask for approval"
ask -> person : "Show the question"
person -> ask : "Return one outcome"
ask -> run : "y: allowed-once"
ask -> deny : "No, cancel, or unavailable"
circle run
note deny "Silence is not consent"
step 1: call "The model asks for a risky call"
step 2: ask "The call pauses and asks the person"
step 3: person "The person answers yes, no, or nothing"
step 4: run "Only an explicit yes runs the call, once"
step 5: deny "Anything else denies the call"
```

```ts
// src/approval.ts
import * as readline from 'node:readline/promises'

export type Outcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'
export type Policy = 'ask' | 'never'

export async function askPerson(question: string, policy: Policy, signal: AbortSignal): Promise<Outcome> {
  if (policy === 'never') return 'rejected'
  if (!process.stdin.isTTY) return 'unavailable'
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`${question} [y/N] `, { signal })
    return answer.trim().toLowerCase() === 'y' ? 'allowed-once' : 'rejected'
  } catch {
    return 'cancelled'
  } finally {
    rl.close()
  }
}
```

Read it as a list of ways to say no. A `never` policy rejects without asking, which is what you want in continuous integration, where nobody is watching. No terminal means no one can answer: `unavailable`. The person pressing Ctrl+C or the turn being stopped throws, giving `cancelled`. Any typed answer other than `y`, including `yes please`, an empty line or a typo, is `rejected`. Only `y` returns `allowed-once`, and "once" is literal: the next risky call asks again.

The rule enters the pipeline as a pre-execute listener:

```ts
const approvals: Plugin<{ risky: string[]; policy: Policy }> = (ctx, config) => {
  ctx.on('tools/pre-execute', async (call: ToolCall, next: () => Promise<Decision>) => {
    if (!config.risky.includes(call.name)) return next()
    const outcome = await askPerson(`Run ${call.name} ${call.arguments}?`, config.policy, AbortSignal.timeout(600_000))
    if (outcome === 'allowed-once') return next()
    return { action: 'deny', reason: `the user did not approve this call (${outcome}). Stop and explain instead of working around it.` }
  })
}
```

Trace one call. The config marks `run_command` as risky, policy `ask`. The model asks to run `rm -rf build`. The listener prints `Run run_command {"command":"rm -rf build"}? [y/N]`. You type `n`. The outcome is `rejected`, the listener returns a denial without calling `next`, and the model receives `Error: the user did not approve this call (rejected). Stop and explain instead of working around it.` That last sentence matters: without it, a model may try the same deletion through a different tool.

> **Key idea:** Approval pauses a risky call and asks the person; the answer is one of a closed set of outcomes, and only an explicit yes allows the call, once, while a no, a cancel or no one to ask all count as no.

**In DeepSeek Harness:** the outcomes are exactly `'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'` (`packages/interaction/user-approval/src/types.ts`), and "`'allowed-once'` is the only grant". A missing answerer counts as unavailable, which is a denial. The session policy is `ask` or `never`; `never` auto-rejects for unattended runs. The request carries the call's id rather than its arguments, so the screen attaches the question to the tool card it already shows. Audit events `approval/asked` and `approval/decided` are recorded but not shown to the model. There is no built-in "always allow this tool" list; such policies are written as `tools/pre-execute` plugins. The main trigger for a question in dsh is a command asking for wider permission to write files, which a later module covers; a rejection tells the model to "stop and explain instead of working around it".

## What you have now

Risky calls now pause in the pipeline's pre-execute hook and ask the person, and every outcome but an explicit yes denies the call. Calls so far run one at a time, which is right for risky ones. But when the model asks to read five files at once, waiting for each in turn is slow. Which calls can safely run at the same time?
