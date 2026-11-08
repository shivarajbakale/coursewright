# Headless approval: refusing when nobody can answer

A gate can block a call by rule. Some calls have no clean rule. Applying a Kubernetes manifest is fine on Monday and a disaster on Friday, and only a person can tell which. Can the gate ask that person? And what happens when the expert runs overnight, with nobody at the screen?

Think of a bank teller who needs a manager's signature for a large transfer. The teller walks to the manager's office. If the manager is there, the manager signs or refuses. If the office is empty, the teller does not sign alone. The teller cancels the transfer.

The picture differs from pi in one way: pi does not know the office is empty by waiting. It is told, through a flag in the call.

pi does not ask for approval before every tool call. Its security document says so on its first line. If you want a question, an extension builds it. In the `tool_call` handler you ask the person with `ctx.ui.confirm`, and you block the call when the answer is no.

The difficulty is the unattended run. In print mode or JSON mode there is no screen. pi then supplies a stand-in screen. Its `confirm` answers false, and its `select` answers undefined. A gate that only checks the answer would block anyway, but by accident. A good gate checks `ctx.hasUI` first and decides on purpose.

```inkling
title "Ask only when a person can answer"
layout flow
call: box "kube_apply call"
screen: diamond "Screen present?"
ask: box "Ask the person"
answer: diamond "Person says yes?"
allow: box "Call runs" green
block: box "Call blocked" red
call -> screen
screen -> ask : "yes"
screen -> block : "no"
ask -> answer
answer -> allow : "yes"
answer -> block : "no"
step 1: call "A risky call reaches the gate"
step 2: screen "The gate checks whether a person can answer"
step 3: ask, answer "If so, it asks and reads the answer"
step 4: allow "A yes lets the call run"
step 5: block "A no, or no screen, blocks the call"
```

Here is the gate for the Kubernetes pack:

```ts
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName !== "kube_apply") return;
  if (!ctx.hasUI) return { block: true, reason: "kube_apply needs a person to approve; none is present." };
  const ok = await ctx.ui.confirm("Apply to cluster?", String(event.input.manifest).slice(0, 400));
  if (!ok) return { block: true, reason: "The operator declined." };
});
```

Trace two runs. In a terminal, `ctx.hasUI` is true. The gate shows the first 400 characters of the manifest and waits. The operator answers, and the call runs or stops.

In an overnight job, `ctx.hasUI` is false. The gate blocks at once, with a reason the model can read. The model can then report that it needs approval, instead of acting.

The rule behind this has a name. A check that **fails closed** refuses when it cannot get an answer. The opposite, failing open, allows the call when the check cannot run. For a risky tool such as `kube_apply`, fail closed.

> **Key idea:** Fail closed: when a gate cannot get an answer, such as with no screen, it refuses the call instead of allowing it.

## How pi does it

pi "does not ask for approval before every tool call" (packages/coding-agent/docs/security.md:3). With no screen, the stand-in UI answers `confirm` with false and `select` with undefined (packages/coding-agent/src/core/extensions/runner.ts:331-333). The flag `ctx.hasUI` is true when a screen is present, as in the terminal UI (packages/coding-agent/src/core/extensions/types.ts:349-352). The pi example `permission-gate.ts` returns `{ block: true, reason: "Dangerous command blocked (no UI for confirmation)" }` when `!ctx.hasUI` (packages/coding-agent/examples/extensions/permission-gate.ts:20-23).

## What you have now

You can now make a risky call wait for a person, and refuse it when no person is there. All your gates run inside pi, though, so they stop only what they were written to stop. What happens to a command that no gate describes?
