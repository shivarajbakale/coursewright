# Child isolation: what a child agent may do

The subagent tool starts a child with a fresh session. But the child has every tool the parent has, and the same approval policy. Suppose the child wants to run `git push`, and a policy answers ask. The person watches the parent's chat, not the child's, so the question waits on a screen nobody looks at. Who decides what a child may do, and when?

## A badge for a visitor

Think of a visitor badge at an office. Reception prints it at the door, before the visitor goes in. It opens the meeting rooms and nothing else. A visitor who needs the server room cannot ask the guard to change the badge; they tell their host, who decides. Reception also keeps a copy of what the badge allowed.

A child agent gets a badge in the same way. The parent decides its permissions at the moment of delegation, and the child cannot widen them from inside. Three things are fixed:

1. The tool list. The child sees a restricted list of tools.
2. Approval. Every ask is rejected at once, because nobody watches the child.
3. The sandbox mode. The child copies the parent's mode at that moment.

The picture differs in one way. Reception keeps its copy in a separate book, but the harness writes the child's policy into the child's own session record. So the record alone shows what the child could do.

```inkling
title "Parent and child permissions"
layout compare
columns "Parent agent", "Child agent"
row "Tools": "every registered tool", "a restricted list"
row "An ask": "goes to a person", "rejected at once"!
row "Sandbox mode": "chosen by the person", "copied at delegation"
row "Can widen its scope": yes, no
steps auto
```

## Isolation in mini-dsh

The subagent tool now passes a `setup` function to `ctx.agents.create`. Setup runs on the child's scoped context before the child takes its first message:

```ts
const CHILD_TOOLS = ['read', 'grep', 'glob', 'bash']
const DELEGATION_NOTE = 'You are a delegated subagent. Your permissions were fixed when you started. '
  + 'Operations that need approval are rejected. If you need more access, say so in your reply.'

async execute(args, exec) {
  const parent = exec.agent
  // Read the parent's state now, before any await: a later change belongs to the parent only.
  const sandboxMode = exec.ctx.get('sandboxPolicy')!.modeOf(parent.session)
  const handle = await exec.ctx.get('agents')!.create({
    sessionId: randomUUID(),
    meta: { parentId: parent.id, depth: parent.depth + 1 },
    setup(childCtx, child) {
      childCtx.tools.restrict({ allow: CHILD_TOOLS })
      childCtx.systemPrompt.context({ name: 'subagent:delegation', text: DELEGATION_NOTE })
      child.session.append('sandbox/mode', { mode: sandboxMode, source: 'delegation' })
      child.session.append('approval/policy', { policy: 'never', source: 'delegation' })
    },
  })
  // ... followup and return the name, as before
}
```

Each line uses something you built. `restrict` is registered on the child's scoped context, as you saw with agent scope. So the parent keeps its full list. The note is runtime context, so the model reads why a call fails. The two appended events change the child's approval service to the policy `never` and fix its sandbox mode.

Trace a child that needs to push:

1. The parent runs in `workspace-write` mode and delegates "fix the test and push it".
2. Setup appends `sandbox/mode` with `workspace-write` and `approval/policy` with `never` to the child's record.
3. The child edits the file inside the workspace. The sandbox allows it.
4. The child calls `bash "git push"`. A policy answers ask, and the approval service returns `rejected` without showing anyone.
5. The child reads the error and the delegation note. Its final reply says the push needs approval, so the parent can ask the person.

> **Key idea:** Child isolation fixes a child's tools, approval and sandbox when it starts, rejects every ask, and logs that policy in the child's record.

## How dsh does it

`packages/subagent/subagent/src/child-agent.ts` holds the rules. `captureDelegatedPolicyOverrides()` (line 249) reads the parent's permission preset and its sandbox override from `ctx.sandboxPolicy`. It pins approval to `never` whenever `ctx.approval` exists. `appendDelegatedPolicyOverrides()` (line 267) writes `sandbox/mode` and `approval/policy` events with `source: 'delegation'`, "so the child's effective policy is reconstructable from its log alone". `SUBAGENT_DELEGATION_CONTEXT` (line 171) is the model-facing note. `applyChildComposition()` (line 187) gives the child its tools. A named agent preset mounts that preset's plugins. Without one, the child joins the parent's current tools.

```inkling
title "Where a child's policy comes from in dsh"
layout down
parent: box "Parent agent"
presets: box "permission-presets"
sandbox: box "sandbox-policy"
approval: box "user-approval"
capture: box "subagent: capture\nat delegation" yellow
log: db "Child's session record"
presets -> capture : "Auto or Full access"
sandbox -> capture : "sandbox override"
approval -> capture : "present, so pin never"
capture -> log : "events with source delegation"
step 1: parent "The parent calls the subagent tool"
step 2: presets, sandbox, approval "The manager reads three services for the parent"
step 3: capture "It captures them before its first await"
step 4: log "The child's record stores the result"
```

## What you have now

A child now runs inside limits that the parent chose, and its own record proves which limits they were. The child finishes its turn with a final reply, such as the note about the push. How does that reply reach the parent, which has already moved on?
