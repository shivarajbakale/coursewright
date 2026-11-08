# Plan mode: planning before changing anything

The todo list keeps the model's plan in view. But the model often starts to edit files in its first step, before it has read enough of the code to plan well. A wrong first edit costs more steps to undo. How can a person ask the agent to explore and write a plan first, and approve that plan before the agent changes anything?

## An architect's drawing

Think of building a house extension. First the architect visits, measures and draws. The owner reads the drawing and either signs it or says "move the window". Only after the signature do the builders arrive. The architect may still open cupboards and test the walls while drawing; the rule is about what happens first, not about locked doors.

Plan mode is the drawing stage. While it is on, every model request carries extra guidance in the system prompt: explore, design, and present a plan. The model presents the plan through one tool, and a person approves it or sends it back. The picture differs in one way: builders cannot start without the signature, but plan mode does not block any tool. It only guides. The sandbox mode and the approval policy still enforce the limits, and they never read plan mode.

```inkling
title "Plan mode from start to approval"
layout right
enter: box "/plan selected"
plan: round "Explore and plan" yellow
show: diamond "exit_plan_mode"
work: box "Carry out the plan" green
enter -> plan : "logged at next pre-step"
plan -> show : "plan as markdown"
show -> plan : "keep planning, with feedback"
show -> work : "approved"
step 1: enter "A person turns plan mode on"
step 2: plan "Guidance joins each request while it is on"
step 3: show "The model presents its plan to the person"
step 4: work "After approval, plan mode turns off"
```

## Plan mode in mini-dsh

In `src/plan.ts`, a plugin adds one prompt section and one pre-step listener. As you saw with runtime context, a pre-step listener runs before each step, and it is the one place where the loop accepts new facts for that step:

```ts
ctx.get('systemPrompt')!.section({
  name: 'plan:policy',
  order: 50,
  text: ({ agent }) => (selectedActive(agent) ? GUIDANCE : ''),
})

ctx.on('agent/pre-step', async ({ agent }, next) => {
  const decision = await next()
  const pending = pendingSelections.get(agent)
  if (decision.kind === 'enter' && pending !== undefined) {
    agent.session.append('plan/mode', { active: pending })
    pendingSelections.delete(agent)
  }
  return decision
})
```

A selection waits until a step begins, and then becomes one `plan/mode` event. Because of this, a resumed or forked session knows whether plan mode was on: the record holds the answer.

The `exit_plan_mode` tool takes a markdown plan that starts with a `#` heading and shows it to the person. Approval returns `{ approved: true }` and selects plan mode off. If the person asks for more planning instead, the call fails with their feedback. The model reads it as an error result and revises.

Trace one session:

1. The person types `/plan Add dark mode`. Plan mode is selected, and the text goes to the agent as a steer.
2. Step 1's pre-step appends `plan/mode` with `active: true`. The request now includes the plan guidance.
3. In steps 1 to 4 the model reads 6 files and runs the tests. No tool is blocked.
4. Step 5 calls `exit_plan_mode` with "# Dark mode plan". The person answers "Also cover the print styles". The call fails with that text.
5. Step 7 presents a revised plan, and the person approves. Step 8's pre-step appends `plan/mode` with `active: false`, and the model starts to edit, often with a todo list made from the plan.

> **Key idea:** Plan mode is logged per-agent guidance that asks the model to plan first, and a person approves the plan through one tool.

## How dsh does it

The package is `packages/plan/plan-mode`, which provides `ctx.planMode`. In `src/index.ts`, the `plan:policy` section (line 198) returns the deployment's guidance text only while the selected state is active. The `agent/pre-step` listener (line 211) calls `next()` first and appends the pending selection only after the step is accepted. The approved result tells the model "Plan approved — plan mode exited; carry out the plan starting with your next step." `docs/subsystems/plan.md` calls it "soft guidance": sandbox mode and approval policy "enforce restrictions independently".

## What you have now

A person can now make the agent plan first and agree to the plan before work starts. Every step of that work still needs a turn, and a turn ends when the model asks for no more tools. A big plan can need far more than one turn. How can the harness keep the agent working toward a goal after its turn ends?
