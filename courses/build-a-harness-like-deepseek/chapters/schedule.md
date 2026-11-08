# Schedule: prompts sent at set times

A background job sends a notice when its command ends. But every job, round and turn so far starts because somebody asked: a person, the model, or the goal driver after a turn. Suppose you want "check last night's test run and summarise failures" every weekday at 9:00. Nobody is at the keyboard at 9:00. What sends the prompt, and what happens if the computer was off at 9:00?

## An alarm clock that writes a note

Think of an alarm clock that slides a written note under a door instead of ringing. The note says "Water the plants." You set the time once, and the clock repeats it every morning. If the power was off during three mornings, a sensible clock slides one note when the power returns, not three. Three notes about the same plants help nobody.

A schedule works the same way. A task holds a prompt, a target session, and a pattern of times. A timer in the harness wakes at the next due time. It sends the prompt to the target agent as a followup, so it opens a turn like a person's message.

The picture differs in one way: a clock has a fixed time of day, but the pattern here is cron. Cron is a five-field text pattern for times: minute, hour, day of month, month, and weekday. `0 9 * * 1-5` means minute 0, hour 9, any day of the month, any month, Monday to Friday.

```inkling
title "Missed runs after downtime"
layout timeline
- Fri 9am: delivered
- Fri 6pm: harness stops
- Mon 9am: missed
- Mon 10.30am: harness starts, one delivery for Mon 9am
- Tue 9am: next delivery
span fri-6pm..mon-10-30am "harness off"
circle mon-10-30am
steps auto
```

## The scheduler in mini-dsh

The scheduler in `src/schedule.ts` keeps its tasks in a file of its own, not in any session, because one task can outlive many sessions. It keeps one timer, set for the earliest due task:

```ts
interface ScheduleTask { id: string; prompt: string; cron: string; sessionId: string; nextAt: number }

export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | undefined
  constructor(private ctx: Context, private tasks: ScheduleTask[]) {}

  arm(): void {
    if (this.tasks.length === 0) return
    const next = Math.min(...this.tasks.map(t => t.nextAt))
    this.timer = setTimeout(() => this.deliverDue(), Math.max(0, next - Date.now()))
  }

  private deliverDue(): void {
    const now = Date.now()
    for (const task of this.tasks.filter(t => t.nextAt <= now)) {
      const occurrence = latestMatch(task.cron, task.nextAt, now)   // newest due time, not every one
      this.ctx.get('agents')!.get(task.sessionId)?.followup(userMessage({
        content: [{ type: 'text', text: `[SCHEDULED TASK] due at ${new Date(occurrence).toISOString()}\n${task.prompt}` }],
        source: { kind: 'schedule' },
      }))
      task.nextAt = firstMatchAfter(task.cron, now)
    }
    saveTasks(this.tasks)
    this.arm()
  }
}
```

Each task's `nextAt` is saved. Because of this, after a restart the scheduler finds every task whose `nextAt` already passed, and `deliverDue` runs at once.

Trace the weekday task from the drawing:

1. Friday at 9:00 the timer fires. The task gets the prompt for Friday 9:00, and `nextAt` becomes Monday 9:00.
2. The harness stops Friday at 18:00 and starts Monday at 10:30. Monday 9:00 is past, so the timer fires at once.
3. `latestMatch` returns Monday 9:00, the only due time. The agent receives one followup.
4. `nextAt` becomes Tuesday 9:00, the first match after 10:30.

Now take `0 * * * *`, every hour, and the same 5 hours offline from 5:30 to 10:30. Five times are due. The `latestMatch` function returns 10:00 only, so the agent receives one message instead of five model requests about the same check.

> **Key idea:** A schedule sends a stored prompt to a session as a followup on a cron pattern, and after downtime only the latest missed time.

## How dsh does it

The package `packages/schedule/schedule` stores tasks in the host's own store. It accepts seven timing kinds: after, at, every, daily, weekly, cron and rrule (`src/update.ts`, line 13). `src/runtime.ts` sets one `setTimeout` for the earliest due task (line 221) and delivers with `agent.followup(message)` (lines 333 and 356). The package README says: "After a restart, a recurring task sends only its latest missed occurrence." `validateTarget()` in `src/index.ts` (line 648) refuses a subagent's session, because "subagent routing ... never receives reminder delivery". The model manages tasks with `schedule_create`, `schedule_list`, `schedule_view` and `schedule_edit` from `packages/schedule/tool-schedule`.

## What you have now

The harness can now start work by itself at set times, and a restart costs one catch-up message, not a flood. With the todo list, plan mode, goals, jobs and schedules, an agent's work can outlast one turn. Until now you drove the agent from code. How does a screen show a person what the agent does while it works?
