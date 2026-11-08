# Escalation: one retry with a reason

The sandbox backend refuses writes outside the write roots. Most of the time that is right. Sometimes it is not: you asked the agent to install the TypeScript compiler, and `npm install -g typescript` must write to `/usr/local/lib`. Switching the whole session to full access would open every later command too. Refusing would make the task impossible. How can the model ask for a wider mode for one command, with a person's agreement?

## A pharmacy prescription

Think of a medicine that a pharmacist may only give out with a doctor's note. You ask, and the pharmacist says no. You go back with a note naming the medicine and the reason you need it. The pharmacist checks the note and gives you one box. Next week you need a new note.

In a harness, the pharmacist is the bash tool, and the note is two extra arguments on the same call. The doctor is a person who answers an approval question. The comparison differs in one way. A doctor writes the note. Here the model writes the reason, and the person only says yes or no to it.

```inkling
title "From denial to one wider call"
layout down
deny: box "Call denied\nunder workspace-write" red
hint: sticky "Hint: retry this exact\ncommand once"
retry: box "Same command\n+ sandbox_permissions\n+ justification"
wider: diamond "Strictly\nwider?"
ask: box "Approval question"
run: box "This call runs\nin the wider mode" green
deny -> hint -> retry -> wider
wider -> ask : "yes"
ask -> run : "allowed-once"
circle ask
step 1: deny, hint "The denial tells the model it may retry once"
step 2: retry "The retry names a mode and gives one sentence of reason"
step 3: wider "The tool checks that the mode is wider than the current one"
step 4: ask "A person answers the question"
step 5: run "A yes covers this one call only"
```

## The smallest escalation

When the session's mode confines commands, the bash tool gains two optional parameters. The parameter `sandbox_permissions` names a wider mode, and `justification` is one sentence for the person. The check runs before the command starts, in `src/sandbox.ts`:

```ts
const WIDER: Record<string, SandboxMode[]> = {
  'read-only': ['workspace-write', 'danger-full-access'],
  'workspace-write': ['danger-full-access'],
}

export async function approveEscalation(ctx: Context, call: ToolCall, current: SandboxMode, wanted: string, justification: string): Promise<SandboxMode> {
  if (wanted === current) return current
  if (!(WIDER[current] ?? []).includes(wanted as SandboxMode)) throw new Error(`"${wanted}" is not wider than "${current}"`)
  if (justification.trim() === '') throw new Error('justification must be a non-empty sentence')
  const outcome = await ctx.get<ApprovalService>('approval')!.request({ session: call.session, toolName: 'bash', reason: `escalate sandbox to ${wanted}: ${justification}` })
  if (outcome !== 'allowed-once') throw new Error(`escalation to "${wanted}" was not approved; stop and explain instead of working around it`)
  return wanted as SandboxMode
}
```

The bash tool then builds this call's policy with the approved mode. It does not change the session's mode.

Trace the install, in a session whose mode is `workspace-write`:

1. Run `npm install -g typescript`. The runner refuses the write to `/usr/local/lib`. The result ends with the denial line and the hint `retry this exact command once with sandbox_permissions ... + justification`.
2. Retry with `sandbox_permissions: "danger-full-access"` and a justification. It says "Install the TypeScript compiler globally so tsc is on PATH, as you asked."
3. Check the mode. `danger-full-access` is in `WIDER["workspace-write"]`, so the tool asks.
4. Answer yes. The outcome is `allowed-once`, so this call runs without the runner, and the install succeeds.
5. Run the next command. It has no `sandbox_permissions`, so it runs in `workspace-write` again.

Each step closes one gap. A narrower or unknown mode fails before anyone is asked. A person's no is final, and the error tells the model to stop and explain. Under the approval policy `never`, every ask is rejected, and the model is told not to set `sandbox_permissions`. Nothing counts the retries. The safety comes from one rule: every wider call needs its own yes.

A **justification** is the one-sentence reason the model gives a person for a wider mode.

> **Key idea:** Escalation lets the model retry a denied call with a wider mode and a justification; a person's allowed-once applies to that call only.

## How dsh does it

The vocabulary is in `packages/sandbox/sandbox/src/escalation.ts`. The table `WIDER_MODES` (line 29) is the table above. The function `validateEscalationArgs` (line 52) requires both arguments together and a non-empty justification. The function `escalationHintMarker` (line 85) writes the hint.

The function `approveEscalation` (line 172) asks `ctx.approval` with the reason `escalate sandbox to <mode>: <justification>`. It returns the mode, "consumed by the one call that asked". The bash tool calls it before it starts the command (`packages/shell/tool-bash/src/index.ts`, lines 482-487), and the file tools use the same function for writes and edits.

## What you have now

A denied command can now be retried once with a wider mode, a reason and a person's yes, and the session's own mode stays the same. A session now has two separate settings, its sandbox mode and its approval policy, and a person must set both. How can one named choice set them together?
