# Agent inbox: where new messages wait

A turn can take many steps. While the agent works, you see it read the wrong folder and you type "only look in src/". Your loop is in the middle of a step. Where does that message go, and when does the model read it?

## A kitchen order rail

Think of the rail above a restaurant kitchen. A waiter clips new order slips to it. The cook finishes the current dish, then looks at the rail before starting the next one. A note that says "no salt on table 4" belongs to the dish in progress. A slip for table 9 is a new order and waits until the cook is free.

The agent has the same rail, called the inbox. It holds two lists. The next-step list holds messages that belong to the work in progress. The next-turn list holds messages that start new work. The picture differs from a kitchen in one way: the loop never reads the rail in the middle of a step. A model request that is already sent cannot change, so a new message always waits for a step boundary.

```inkling
title "Two lists in the inbox"
layout down
you: person "You"
turn: box "Next-turn list"
step: box "Next-step list"
loop: round "The running turn"
you -> turn : "followup"
you -> step : "steer"
step -> loop : "joins the next step"
turn --> loop : "starts a new turn"
highlight step
step 1: you "You type while the agent works"
step 2: turn "A followup waits for a new turn"
step 3: step "A steer waits only for the next step"
step 4: loop "Each step takes the next-step list first"
```

## Three ways in, one way out

In mini-dsh, the inbox is a small class in `src/inbox.ts`:

```ts
export type Target = 'next-turn' | 'next-step'

export class Inbox {
  nextTurn: UserMessage[] = []
  nextStep: UserMessage[] = []

  add(target: Target, message: UserMessage): void {
    if (target === 'next-turn') this.nextTurn.push(message)
    else this.nextStep.push(message)
  }

  // All next-step messages, plus one next-turn message when a turn opens.
  claim(target: Target): UserMessage[] {
    const claimed = this.nextStep.splice(0)
    if (target === 'next-turn') claimed.push(...this.nextTurn.splice(0, 1))
    return claimed
  }

  get hasPending(): boolean {
    return this.nextTurn.length > 0 || this.nextStep.length > 0
  }
}
```

The agent puts messages in through three methods. A followup goes to the next-turn list and wakes the loop if it is idle. A steer goes to the next-step list and also wakes the loop. An inject goes to the next-step list and does not wake the loop, so it rides along with the next step that runs for another reason.

```ts
followup(m: UserMessage) { this.inbox.add('next-turn', m); this.wake() }
steer(m: UserMessage)    { this.inbox.add('next-step', m); this.wake() }
inject(m: UserMessage)   { this.inbox.add('next-step', m) }
```

The turn claims from the inbox at the start of every step. The first step of a turn claims with `'next-turn'`; later steps claim with `'next-step'`. A turn that the model would end stays open while the next-step list is not empty. After the turn ends, the loop starts another turn if `hasPending` is true.

Trace one session:

1. You send "Fix the failing test" as a followup. The agent is idle, so turn 1 opens and step 1 claims it.
2. During step 1 you steer "Only touch src/". The step finishes its tool call first.
3. Step 2 claims the steer. The model now sees it beside the tool result.
4. During step 2 you send "Then update the changelog" as a followup. It waits.
5. Turn 1 ends after step 3. Step 3 ends in text and the next-step list is empty. `hasPending` is true, so turn 2 opens with the changelog message.

```inkling
title "One session through the inbox"
layout timeline
- 1: Followup opens turn 1
- 2: Steer arrives mid-step
- 3: Step 2 claims the steer
- 4: Second followup waits
- 5: Turn 2 opens
span 1..3 "turn 1"
steps auto
```

> **Key idea:** The inbox holds waiting messages in two lists: steer joins the next step of the current turn, and followup starts the next turn.

## How dsh does it

`packages/core/agent-loop/src/agent.ts` defines `followup`, `steer` and `inject` (lines 179-189); each calls `send()`, which splices the message into the inbox and wakes the driver. `preStep()` calls `this.inbox.claim(target, turn)` (line 287), and `packages/core/agent-loop/src/inbox.ts` takes the whole next-step list plus one next-turn message (lines 108-112). Every inbox change is written to the session as an `agent/inbox/spliced` event, so waiting input survives a restart. As you saw with cancellation, `cancel()` clears the inbox too, unless the caller passes `keepInbox`.

## What you have now

A turn now accepts new input between steps, and waiting work starts the next turn by itself. Every message still goes to one agent with one session. A harness can run many agents at once, so how does code create one, and find it again by its id?
