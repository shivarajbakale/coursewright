# Subagent result: how a child reports back

With child isolation, a child runs inside fixed limits and ends with a final reply. But the subagent tool returned the child's name long ago, and the parent's turn may already be over. The child's answer cannot be a tool result, because that call is closed. How does the answer reach the parent?

## A letter in the in-tray

Think again of the manager and the contractor. The manager does not stand at the contractor's desk and wait. When the job is finished, the contractor puts one report in the manager's in-tray. If the manager is free, the report starts their next piece of work. If the manager is in a meeting, the report waits for the next pause. The manager never receives the contractor's notebook.

In a harness, the in-tray is the parent's agent inbox. When the child goes idle, the harness takes the child's final reply and writes a short notice around it. That act of delivering the result is called settlement. The picture differs in one way: the harness writes the notice, not the child, so the notice says it came from the runtime, and the parent cannot mistake it for words the child chose.

```inkling
title "How the notice enters the parent"
layout flow
child: box "Child goes idle"
notice: sticky "Settlement notice"
idle: diamond "Parent idle?"
follow: box "followup: new turn"
steer: box "steer: next step"
child -> notice -> idle
idle -> follow : "yes"
idle -> steer : "no"
step 1: child "The child ends its turn with a final reply"
step 2: notice "The harness wraps that reply in a notice"
step 3: idle, follow "An idle parent gets a followup, which opens a turn"
step 4: steer "A busy parent gets a steer for its next step"
```

## Settlement in mini-dsh

After the subagent tool sends the prompt, it waits for the child in the background, without blocking the parent's step:

```ts
void handle.agent.whenIdle().then(() => settle(parent, name, handle.agent))

function settle(parent: Agent, name: string, child: Agent): void {
  const events = child.session.events
  const output = lastNonEmptyAssistant(events) ?? []
  const stopReason = lastTurnEnd(events)?.reason.kind ?? 'error'
  const head = stopReason === 'completed'
    ? `Background subagent ${name} finished.`
    : `Background subagent ${name} ended early (${stopReason}).`
  const message = userMessage({
    content: [{ type: 'text', text: head }, { type: 'text', text: 'Its closing message:' }, ...output],
    source: { kind: 'subagent-settled', senderSessionId: child.id },
  })
  if (parent.status === 'idle') parent.followup(message)
  else parent.steer(message)
}
```

`lastNonEmptyAssistant` walks the child's events from the end and returns the content of the newest `assistant/message` that is not empty. The parent receives that reply only, not the child's tool results or reasoning. The child's first prompt says so, so the child puts its evidence in that reply.

Trace one delegation:

1. Parent step 1 calls `subagent`. The result is "started subagent agent-1".
2. Parent step 2 replies "A helper searches now." Turn 1 ends and the parent becomes idle.
3. The child runs 3 steps and replies "3 files read config.json: a.ts, b.ts, c.ts".
4. The child goes idle. `settle` builds the notice. The parent is idle, so it is a followup.
5. The followup wakes the parent. Turn 2 opens with the notice as its user message.

If the parent were still in turn 1, the notice would be a steer and join turn 1's next step instead.

> **Key idea:** Settlement turns a child's final reply into a parent inbox notice: a followup when the parent is idle, a steer when busy.

## How dsh does it

`createSettlementMessage()` in `packages/subagent/subagent/src/continuation-messages.ts` (line 141) builds the notice. Its first line comes from `settlementSummary()` (line 106), for example "Background subagent agent-1 finished and will do no further work unless you send it more." The source kind is `subagent-settled`, not `agent-message`, because "a transcript that merged them would credit the child with words it never wrote" (`docs/subsystems/subagent.md`). `notifySettlement()` in `manager.ts` (line 1109) delivers it only to a live direct parent. It uses a followup when that parent is idle and a steer when it runs a turn (line 1123). The output rule, the last non-empty assistant message, is in `assistant-output.ts`.

## What you have now

A parent can now delegate, go on with its own work, and read the child's answer when it arrives, all through the agent inbox. Each child here works alone on its own task. When several children share a list of tasks, how do two of them avoid doing the same one?
