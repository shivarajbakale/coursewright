# Todo list: a checklist the model keeps

A workflow suits work the model can plan in advance as a script. Most long tasks are not like that: the model learns what to do next only after each step. A task such as "add dark mode to the settings page" takes 20 steps. By step 15, the first request is far back in the history, and the model can forget a part of the plan. How can the model keep its plan in view, and how can a person see it?

## A checklist on a clipboard

Think of a mechanic with a clipboard. Before starting, the mechanic writes every job: "change oil, check brakes, rotate tyres". After each job, the mechanic does not cross out one line. They copy the whole list again onto a fresh sheet, with the new ticks, and keep the old sheets under it. The top sheet is always the whole truth, and the pile shows how the work went.

The todo list works like that clipboard. The model has one tool, `todo_write`. Each call sends the complete list, and the new list replaces the old one. The harness writes each list to the session record as one event, so the record keeps every version. The picture differs in one way: the mechanic copies by hand, but the model's copy is a tool call, so the newest list also stays in the model's own history, where the model reads it on every later request.

```inkling
title "Every call writes the whole list"
layout timeline
- 1: Three todos, first in progress
- 2: First done, second in progress
- 3: Model adds a fourth todo
- 4: All four completed
span 1..4 "one turn, four todo/write events"
steps auto
```

## The tool in mini-dsh

The tool is in `src/todo.ts`, built with `defineTool`:

```ts
export const todoWrite = defineTool({
  name: 'todo_write',
  description: 'Record and update a task list for multi-step work. '
    + 'Keep exactly one todo in_progress. Mark each todo completed as soon as it is done.',
  parameters: {
    todos: {
      type: 'array', required: true,
      description: 'The COMPLETE task list, replacing any previous list.',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string', required: true },
          status: { type: 'string', required: true, enum: ['pending', 'in_progress', 'completed'] },
        },
      },
    },
  },
  async execute(args, exec) {
    const todos = checkTodos(args.todos)   // non-empty, unique content, at most one in_progress
    exec.agent.session.append('todo/write', { todos })
    const count = (s: string) => todos.filter(t => t.status === s).length
    return `Updated todo list: ${count('pending')} pending, ${count('in_progress')} in progress, ${count('completed')} completed.`
  },
})
```

A screen shows the list with a small projection over the record:

```ts
function currentTodos(events: SessionEvent[]): Todo[] | null {
  let todos: Todo[] | null = null
  for (const e of events) {
    if (e.type === 'todo/write') todos = e.data.todos
    if (e.type === 'turn/start') todos = null
  }
  return todos
}
```

The newest write wins. A new turn clears the list, because a new request usually means a new plan.

Trace the dark-mode task:

1. Step 1: the model writes 3 todos with the first one `in_progress`. The result is "2 pending, 1 in progress, 0 completed".
2. Step 6: the model writes the same 3, with the first `completed` and the second `in_progress`.
3. Step 9: the model finds a missing test and writes 4 todos. Nothing breaks, because the model never refers to old items by number.
4. Step 9 also tries 2 todos `in_progress`. The check in `checkTodos` throws. The model reads the error result and sends a corrected list.

Why the whole list and not "tick item 2"? A partial change depends on the old list, and a model that misremembers the old list makes a wrong change. A whole list has no such dependency, and each event in the record makes sense alone.

> **Key idea:** A todo list is one tool that replaces the whole checklist on each call, and each version becomes one event in the record.

## How dsh does it

The tool is `todo_write` in `packages/todo/tool-todo/src/index.ts` (line 137). Its `todos` parameter is described as "The COMPLETE task list, replacing any previous list." `execute` appends `todo/write` with the list to the calling agent's session (line 200). The `todos` projection takes the latest write and returns `null` on `turn/start` (lines 128-131). The deployment must choose `allowParallelInProgress`: with `false`, a call that marks more than one todo `in_progress` is rejected.

## What you have now

The model now keeps its plan in view, and the record shows how the plan changed. But the model starts to change files at step 1, before it has read enough to plan well. How can a person make the agent plan first, and approve the plan before anything changes?
