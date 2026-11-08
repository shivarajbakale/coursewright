# Permission presets: a mode and an approval policy together

A session now has two separate settings. Its sandbox mode says where commands may write. Its approval policy, `ask` or `never`, says whether a question goes to a person or is rejected at once. Some pairs make sense and some do not. `read-only` with `never` gives an agent that can change nothing and can never ask to. A person who wants "let it work in the project, and ask me for anything more" must set two settings correctly. How can one named choice set both?

## Settings on a washing machine

Think of a washing machine. Inside, it has separate settings: water temperature, spin speed, rinse count. The front has a dial with names: "Cotton", "Wool", "Quick". Turning the dial to "Wool" sets cold water and a slow spin at once. A technician can still change one setting by hand, and then the dial shows none of its names.

In a harness, the inner settings are the sandbox mode and the approval policy, and the names on the dial are presets. The comparison differs in one way. A washing machine forgets the dial when it is switched off. A harness writes every change as an event in the session record, so a resumed session returns with the same settings.

```inkling
title "The two default presets"
layout compare
columns "workspace-write", "danger-full-access"
row "Sandbox mode": "workspace-write", "danger-full-access"
row "Approval policy": "ask", "never"
row "Write outside the project": "after a yes", yes
row "Approval questions": yes, no
step 1: sandbox-mode "Each preset sets one sandbox mode"
step 2: approval-policy "and one approval policy"
step 3: write-outside-the-project "Together they decide what a command may change"
step 4: approval-questions "and whether a person is ever asked"
```

## The smallest preset table

A **permission preset** is a named pair of a sandbox mode and an approval policy. Here is the table and its switch in `src/presets.ts`. A switch writes the preset's name, then each setting that changed, each as its own event.

```ts
const PRESETS: Record<string, { sandbox: SandboxMode; approval: 'ask' | 'never' }> = {
  'workspace-write': { sandbox: 'workspace-write', approval: 'ask' },
  'danger-full-access': { sandbox: 'danger-full-access', approval: 'never' },
}

export function currentPreset(session: Session): string {
  for (const [name, spec] of Object.entries(PRESETS)) {
    if (spec.sandbox === session.lastSandboxMode() && spec.approval === session.lastApprovalPolicy()) return name
  }
  return 'custom'
}

export function setPreset(session: Session, name: string): void {
  const spec = PRESETS[name]
  if (spec === undefined) throw new Error(`unknown preset "${name}" (available: ${Object.keys(PRESETS).join(', ')})`)
  if (currentPreset(session) !== name) session.append('permission/preset', { preset: name })
  if (session.lastSandboxMode() !== spec.sandbox) session.append('sandbox/mode', { mode: spec.sandbox })
  if (session.lastApprovalPolicy() !== spec.approval) session.append('approval/policy', { policy: spec.approval })
}
```

The bash tool, the file tools and the approval service never read the preset. They keep reading the `sandbox/mode` and `approval/policy` events, as before. The preset is a name for people.

Trace one session:

1. Create the session with the default preset `workspace-write`. The record gets 3 events: the preset, `sandbox/mode` and `approval/policy`.
2. Type `/permission danger-full-access`. Both settings differ, so the record gets 3 more events.
3. Type `/permission danger-full-access` again. Nothing differs, so nothing is written.
4. Switch only the sandbox mode to `read-only`, with a `sandbox/mode` event. The pair `read-only` and `never` matches no preset.
5. Ask for the current preset. `currentPreset` returns `custom`.

`custom` is only a report. You cannot switch to it, because it names no pair.

> **Key idea:** A permission preset is a named sandbox mode and approval policy; switching writes each changed setting as its own event.

## How dsh does it

`PermissionPresetService` is in `packages/interaction/permission-presets/src/index.ts` (line 174). Its default table (lines 182-191) has `workspace-write` (workspace-write and ask) and `danger-full-access` (danger-full-access and never), with the description "Full file access without approval prompts." Unmatched settings report `custom` (line 73), and the name `auto` is kept for an experimental review mode. `apply` appends `permission/preset` only when the preset changed, then calls `setSandboxMode` and `setApprovalPolicy` from the two other packages for each setting that changed. The `/permission` command (line 255) is the write path a person uses.

```inkling
title "One switch, two settings, in dsh"
layout flow
cmd: person "/permission name"
presets: box "permission-presets" yellow
sp: box "sandbox-policy\nsetSandboxMode"
ua: box "user-approval\nsetApprovalPolicy"
log: db "Session record"
cmd -> presets
presets -> log : "permission/preset"
presets -> sp
presets -> ua
sp -> log : "sandbox/mode"
ua -> log : "approval/policy"
circle presets
step 1: cmd, presets "A person picks a preset by name"
step 2: log "The preset's name is recorded"
step 3: sp "The sandbox package records the mode"
step 4: ua "The approval package records the policy"
```

## What you have now

You have the whole fence around a command: file tools that refuse stale edits, a shell tool with a clean environment, modes enforced by the operating system, one approved retry, and presets that set mode and policy together. It limits writes only, and dsh's `SAFETY.md` warns that it has not been audited. The model must also be told which mode and policy it works under, next to the instructions of many other plugins. How do many plugins each add their own part to one system prompt?
