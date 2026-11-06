# Sandbox escalation: asking once to widen the fence

The fence now holds, or the command does not run. But sometimes the fence blocks something the task really needs. The model runs `npm install` under `workspace-write`, and npm tries to write its download cache in `~/.npm`, outside the roots. The write is refused. The model has two bad options. It can try to sneak around the fence, for example by writing through another tool. Or you can switch the whole session to a wider mode, which opens the fence for every later command too. Is there a narrower way?

```inkling
title "One wider retry, then fenced again"
layout down
call: box "npm install" red
denied: box "Write refused" red
request: box "Retry with wider sandbox\nand written reason" yellow
person: person "Person"
retry: box "One unfenced retry" yellow
call -> denied : "runs under workspace-write"
denied -> request : "result says how to ask"
request -> person : "approve one call?"
person -> retry : "yes: run once without fence"
retry -> next: box "npm test" green
next -> next : "back under workspace-write"
circle request
step 1: call "The command runs under workspace-write"
step 2: denied "The write to ~/.npm is refused"
step 3: request "The model retries once with a wider mode and a reason"
step 4: person "The person reads the reason and says yes"
step 5: retry "That one call runs with no fence"
step 6: next "The next call is fenced again"
```

## A one-visit pass with a written reason

Picture asking a building manager for a pass to the storeroom. You write down why you need it. The manager reads the reason and says yes or no. The pass works for one visit, then it is void.

The picture stops holding in one way. A real pass names a room. In `minidsh`, the request names a wider mode, and modes are coarse. Here the only mode wider than `workspace-write` is `danger-full-access`, which removes the fence entirely for that one call. The person approving should know that.

## The retry, step by step

First, the refused call's result must teach the model what to do. The shell tool adds two lines to a denied result:

```text
[sandbox: file access denied under workspace-write mode]
[sandbox: escalation available — retry this exact command once with sandbox_permissions + justification]
```

Next, the shell tool's schema gains two optional arguments: `sandbox_permissions`, one of `workspace-write` or `danger-full-access`, and `justification`, one sentence for the person. Before anything runs, the tool judges the request:

```ts
const WIDER: Record<string, SandboxMode[]> = {
  'read-only': ['workspace-write', 'danger-full-access'],
  'workspace-write': ['danger-full-access'],
}
type Outcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

export async function approveEscalation(requested: SandboxMode, justification: string | undefined,
  current: SandboxMode, ask: (reason: string) => Promise<Outcome>): Promise<SandboxMode> {
  if (requested === current) return current
  if (!justification?.trim()) throw new Error('invalid escalation: sandbox_permissions requires a justification')
  if (!(WIDER[current] ?? []).includes(requested))
    throw new Error(`sandbox escalation to "${requested}" is not strictly wider than "${current}"`)
  const outcome = await ask(`escalate sandbox to ${requested}: ${justification}`)
  if (outcome === 'allowed-once') return requested
  if (outcome === 'rejected') throw new Error(
    'the user rejected escalating this command; it stays denied, so stop and explain instead of working around it')
  throw new Error(`sandbox escalation to "${requested}" was not approved (${outcome})`)
}
```

The shell tool then runs `confine(['bash', '-c', args.command], { ...policy, mode })` with the mode this function returned. Trace the `npm install` case:

```text
step 1  bash {command: "npm install"}                       -> denied, plus the two lines above
step 2  bash {command: "npm install",
              sandbox_permissions: "danger-full-access",
              justification: "npm must write its download cache in ~/.npm"}
        prompt: escalate sandbox to danger-full-access: npm must write its download cache in ~/.npm
        person types y -> allowed-once -> this one call runs with no fence
step 3  bash {command: "npm test"}                           -> back under workspace-write
```

Each rule closes a hole. A missing reason is refused, because a person cannot judge a request with no reason. A request for a narrower or equal mode never asks, because it gives nothing away. Only a clear yes widens anything, exactly as with approval. The wider mode is returned for this call and stored nowhere, so step 3 is fenced again. A rejection tells the model to stop and explain, not to find another way.

> **Key idea:** Sandbox escalation lets the model ask, with a stated reason, for a strictly wider sandbox mode for one retry of one call; the person approves it, and the fence returns for every later call.

**In DeepSeek Harness:** `approveEscalation` in `packages/sandbox/sandbox/src/escalation.ts` is shared by the bash and file tools, so their wording cannot drift. `WIDER_MODES` holds the strictly-wider table, checked when the call runs rather than in the schema. The approval reason reads `escalate sandbox to <mode>: <justification>`, and the denial marker is `[sandbox: file access denied under <mode> mode]`. If no approval service or agent exists, the request is refused before anything runs.

## What you have now

You have a fence with a single, recorded, person-approved way through it. This joins approval to the sandbox, its write roots, its runner and failing closed. With commands under control, the next question is about the model's input instead: how is the system prompt it reads put together from many plugins?
