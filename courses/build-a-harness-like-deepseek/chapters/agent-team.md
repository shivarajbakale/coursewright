# Agent team: a shared task board

With subagent results, each child does one task and reports back to its parent. Now a parent starts three children and writes five tasks for them to share. Two children read the list at the same moment, both see "task-1: fix the parser" as free, and both start it. How does the harness make sure each task has exactly one owner?

## A board with numbered cards

Think of a kitchen whiteboard of chores in a shared flat. Each card shows a chore, who took it, and a small number in the corner. Every time anybody changes a card, they cross out the number and write the next one. The rule is: before you change a card, say the number you saw. If the number on the board is different, somebody changed the card after you looked, so you must read it again.

That rule is compare-and-set: change a value only if it still equals what you read, and fail otherwise. In an agent team, each task has a revision number. A change names the revision it expects. The picture differs in one way. On a whiteboard two people can write at the same moment. The harness applies changes to the board one at a time, so the check and the write cannot interleave.

```inkling
title "Two agents claim the same task"
layout sequence
a1: box "agent-1"
board: db "Task board"
a2: box "agent-2"
a1 -> board : "list: task-1 is revision 1"
a2 -> board : "list: task-1 is revision 1"
a1 -> board : "claim task-1, expect 1"
board --> a1 : "ok, now revision 2"
a2 -> board : "claim task-1, expect 1"
board --> a2 : "stale: current revision is 2"
steps auto
```

## The board in mini-dsh

The board lives in `src/team.ts`. It stores every task change as a `team/task` event in the lead agent's session record, with the whole task each time. The current board is the newest snapshot for each id:

```ts
interface Task {
  id: string
  revision: number
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
  ownerId?: string
}

export class TaskBoard {
  constructor(private lead: Agent) {}

  update(caller: Agent, req: { taskId: string; expectedRevision: number; action: 'claim' | 'complete' }): Task {
    const current = this.read(req.taskId)
    if (current.revision !== req.expectedRevision) {
      throw new Error(`stale task ${current.id} revision ${req.expectedRevision}; current revision is ${current.revision}`)
    }
    let next: Task
    if (req.action === 'claim') {
      if (current.ownerId !== undefined) throw new Error(`task ${current.id} is owned by another member`)
      next = { ...current, status: 'in_progress', ownerId: caller.id }
    } else {
      if (current.ownerId !== caller.id) throw new Error('only the owner can complete a task')
      next = { ...current, status: 'completed' }
    }
    const task = { ...next, revision: current.revision + 1 }
    this.lead.session.append('team/task', { task })
    return task
  }
}
```

The model reaches the board through tools such as `team_task_list` and `team_task_update`. Trace the race from the drawing.

1. The lead creates task-1 at revision 1, with status `pending` and no owner.
2. agent-1 and agent-2 both list the board and both read revision 1.
3. agent-1 claims with `expectedRevision: 1`. The check passes. task-1 becomes revision 2, owned by agent-1.
4. agent-2 claims with `expectedRevision: 1`. The board holds revision 2, so the call throws.
5. agent-2's model reads the tool error result, lists the board again, and claims task-2.

A change on the board wakes nobody. If agent-1 must act on a new task, the lead sends it a message, which goes to its agent inbox.

> **Key idea:** An agent team shares a durable task board where each change must name the task's current revision, so each task has one owner.

## How dsh does it

The board is `ctx.agentTeams` in `packages/team/agent-team`. In `task-board.ts`, `updateTask` throws `TEAM_TASK_STALE_REVISION` when `current.revision !== request.expectedRevision` (line 128). Only the task's owner or the lead may change a claimed task. In `journal.ts` (line 63), the board appends `team/task` with the whole snapshot to the lead's session and flushes it. A per-lead queue runs the changes one at a time.

Tasks may also list `blockedBy` tasks. Such a task is not ready to claim until those are completed. `docs/subsystems/agent-team.md` says "Task changes do not end inbox waits, add inbox messages, or start idle agents".

```inkling
title "The team packages in dsh"
layout down
tools: box "tool-agent-team\nteam_task_* tools"
service: box "agent-team\nctx.agentTeams" yellow
names: box "subagent\nnames of members"
log: db "Lead agent's session"
tools -> service : "createTask, updateTask"
service -> names : "who is the caller"
service -> log : "team/task snapshot"
step 1: tools "The model calls a team_task tool"
step 2: service "The service checks the revision and the owner"
step 3: names "Member names come from the subagent tree"
step 4: log "Each change becomes one durable event"
```

## What you have now

Agents now share work through a board, and compare-and-set keeps one owner per task. The model still starts each child with one tool call per step. When the work has 50 independent pieces, can the model describe the whole plan once and let the harness run it?
