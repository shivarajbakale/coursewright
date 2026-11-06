# Subagent result: the child's answer arriving as a message

The subagent tool returned "Started child-1" and the parent ended its turn. Now the parent is idle and the child is working. When the child finishes, its final answer exists only in the child's own log. The parent could keep calling a "check on child-1" tool, but every check costs a model request and most of them would say "still working". How should the answer travel back, and what makes the parent read it?

## A memo in the tray

The right place for it already exists. Think of the colleague dropping a finished memo into the lead's inbox tray. If the lead is free, the memo starts new work. If the lead is in the middle of something, it is passed in at the next pause. Nobody has to keep walking over to ask.

That is exactly the followup and the steer from the agent inbox. The picture stops holding on one detail: the memo is not a special object. It is an ordinary user-role message, recorded in the parent's event log like anything the person types, so the derived history and session resume handle it with no new code.

Add a small hook to `Agent`: when `wake` finishes its `while` loop, call `this.onIdle?.()`. Then wire it in the subagent tool, right after creating the child:

```ts
export function deliver(agent: Agent, message: Message) {
  if (agent.running) agent.steer(message)   // joins the current turn
  else agent.followup(message)              // starts a new turn
}

child.onIdle = () => {
  const failed = child.lastTurnEnd()?.reason !== 'completed'
  deliver(parent, {
    role: 'user',
    content:
      `<subagent name="${child.name}" status="${failed ? 'failed' : 'completed'}">\n` +
      `${child.lastAssistantText()}\n</subagent>`,
  })
}
```

`lastTurnEnd()` reads the newest `turn/end` event from the child's log, and `lastAssistantText()` reads its newest assistant message. The tags make it plain to the model that this text came from a helper, not from the person.

## Two children, two paths

1. Parent turn 1: the model calls `subagent` twice, for `child-1` and `child-2`. Both results say "Started". The model replies "I have started two reviews" and the turn ends. The parent is idle.
2. `child-1` finishes. `deliver` sees the parent idle and sends a followup. That wakes the parent, and turn 2 begins with child-1's report as its input.
3. During turn 2, while the model is reading files to check child-1's findings, `child-2` finishes. The parent is running, so `deliver` steers. Before its next step, the parent claims the report and the model sees it in the same turn.
4. Turn 2 ends with a combined answer.

Notice what a failure does. If `child-2` crashed or was cancelled, the parent still gets a message, marked `failed`, with whatever text the child managed. A parent that never hears back would wait forever.

> **Key idea:** A subagent result is the child's final answer delivered as a user message into its direct parent's inbox, as a followup if the parent is idle or a steer if it is running, so the result both wakes the parent and is recorded in its log.

**In DeepSeek Harness:** the subagent manager (`packages/subagent/subagent/src/manager.ts`) builds a user message whose source kind is `subagent-settled`, defined in `continuation-messages.ts`. It carries a summary, the child's closing text, an optional structured result and a diagnostic for failures. It goes only to the direct parent, as a followup if idle or a steer if running, and the parent is woken. Because it is a logged user message, a resumed session still contains every result the parent saw.

## What you have now

Parents and children now talk through the same inbox and event log that the person uses, with no polling. But a child also has the subagent tool, so it can start children of its own. What stops a confused model from building an endless tree of agents?
