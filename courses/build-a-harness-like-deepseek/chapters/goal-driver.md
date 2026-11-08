# Goal driver: continuing until an objective is met

Plan mode gives the agent an approved plan. Then the model works, and after 12 steps it replies "I fixed the first two parts" and asks for no more tools. The turn ends. The plan has five parts, and nobody is at the keyboard to type "continue". Can the harness send that message itself, and how does it know when to stop?

## A coach with a stopwatch

Think of a swimming coach and a swimmer who must swim until they reach 2 km. Each time the swimmer stops at the wall, the coach says "go on, you are at lap 9 of 80". The coach stops when the swimmer reaches 2 km, or after 80 laps, whatever the distance. The coach never interrupts a swimmer in the middle of a lap.

A goal is a written objective, saved in the session. The goal driver is the coach. It watches for the moment the agent becomes idle, which means no turn runs. Then it sends a followup that names the objective and the round number. A round is one such followup and the turn it opens.

The driver stops in two cases: the model marks the goal complete, or the round count reaches a cap. The picture differs in one way: the coach can see the distance, but the driver cannot judge the work. Only the model, after it checks the evidence, can mark the goal complete.

```inkling
title "The goal driver loop"
layout cycle
center "until complete or the cap"
idle: circle "Agent becomes idle"
check: circle "Driver checks the goal"
send: circle "Followup: round N"
work: circle "Model works a turn"
cycle idle, check, send, work
step 1: idle "A turn ends and the agent is idle"
step 2: check "Active goal, no other prompt, under the cap"
step 3: send "The driver sends the next round as a followup"
step 4: work "The model works, then may mark the goal complete"
```

## The driver in mini-dsh

`src/goal.ts` adds a `create_goal` tool, an `update_goal` tool, and this driver. Each goal change is a `goal/change` event, so a resumed session keeps its goal:

```ts
ctx.on('agent/status', ({ agent, status }) => {
  if (status === 'idle') drive(agent)
})

function drive(agent: Agent): void {
  const goal = goals.get(agent)
  if (goal === undefined || goal.phase !== 'active') return
  if (agent.status !== 'idle' || agent.inbox.hasPending) return   // a person's message goes first
  if (goal.roundsStarted >= goal.maxGoalRounds) {
    goals.block(agent, { code: 'round-limit' })
    return
  }
  const round = goals.startRound(agent)
  agent.followup(userMessage({
    content: [{ type: 'text', text: `<goal_round>\nObjective: ${JSON.stringify(goal.objective)}\n`
      + `Round: ${round}/${goal.maxGoalRounds}\nContinue. Verify before you mark the goal complete.\n</goal_round>` }],
    source: { kind: 'goal', round },
  }))
}
```

The driver uses only the agent inbox and the agent's status. It does not change the loop at all.

Trace a goal "all 40 tests pass" with `maxGoalRounds: 3`:

1. The person's turn ends with 31 tests passing. The agent is idle and the goal is active, so the driver sends round 1 of 3.
2. Round 1 ends with 37 passing. The driver sends round 2.
3. During round 2 the person types a question. When round 2 ends, the inbox holds it, so the driver waits, and the question gets its own turn.
4. After that turn, the driver sends round 3. All 40 pass, and the model calls `update_goal` with `complete`.
5. The agent becomes idle again. The phase is `complete`, so the driver sends nothing.

Without step 4's success, the next check finds 3 started rounds of 3 and marks the goal `blocked` with `round-limit`.

> **Key idea:** A goal driver sends a followup round each time the agent becomes idle, until the model marks the goal complete or rounds reach the cap.

## How dsh does it

The goal group splits the work across four packages. `packages/goal/goal` keeps one goal per session as `goal/change` events (`src/index.ts`, line 612), with a default cap of 256 rounds (line 240). `packages/goal/goal-round-driver/src/index.ts` listens on `agent/status` (line 274), requires the agent to be idle with no competing prompt (line 111), and waits for running subagents first (line 179). It blocks the goal with `round-limit` at the cap (line 184) and otherwise calls `agent.followup(message)` (line 208). If a person stops a round's turn, the driver pauses the goal.

```inkling
title "The goal packages in dsh"
layout mindmap
- ctx.goals (goal)
  - tool-goal: get_goal, create_goal, update_goal
  - command-goal: the /goal command for people
  - goal-round-driver: sends rounds when idle
steps auto
```

## What you have now

An agent can now work across many turns toward one objective, and a cap stops a goal that never finishes. Every round still waits for the model's own steps. Some commands, such as a 10-minute build, take far longer than a step should. How can a command run on while the agent does other work?
