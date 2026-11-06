# Subagent: an agent started by another agent

Some tasks are too big for one conversation. Say the person asks the agent to review three large modules. If it reads all three into its own history, the context window fills with file contents it will never need again, and compaction has to throw detail away. The work also splits cleanly: each module can be reviewed without the others. Could the agent hand one piece to a fresh agent and keep only the answer?

## Handing a brief to a colleague

Think of a team lead who writes a short brief and hands it to a colleague. The colleague works at their own desk, with their own notebook, and the lead's notebook only says "asked Sam to review the parser". The lead's head stays clear for the overall picture.

The picture stops holding in two ways. The colleague starts knowing nothing except the brief, so the brief must be complete. And the colleague follows the lead's rules: the same model, the same sandbox. It cannot walk over and ask the person for permission either, so anything that would need approval is refused.

In `minidsh` the helper is started by a tool call, so the model decides when to delegate. Add this to `src/agents.ts`:

```ts
let count = 0

export function subagentTool(parent: Agent): Tool {
  return {
    name: 'subagent',
    description:
      'Start a helper agent on one self-contained task. Write a complete brief. ' +
      'It runs in the background; end your turn instead of waiting for it.',
    parameters: {
      type: 'object',
      properties: { task: { type: 'string' } },
      required: ['task'],
    },
    async execute(args: { task: string }) {
      const name = `child-${++count}`
      const child = new Agent({
        name,
        parent,
        model: parent.model,                       // inherits the model
        session: openSession(`sessions/${name}.jsonl`), // its own event log
        approval: 'never',                         // cannot ask the person
      })
      parent.children.push(child)
      child.followup({ role: 'user', content: args.task })
      return `Started ${name}.`
    },
  }
}
```

Walk through one call. The parent model replies with a tool call: `subagent` with `{"task": "Review src/parser.ts for bugs. Report file and line for each."}`. The tool pipeline runs it like any tool. `execute` builds a new `Agent` with an empty event log in `sessions/child-1.jsonl`, drops the brief into its inbox as a followup, and returns at once. The child's inbox wakes it, and it starts its own turns, reading files and calling tools, all recorded in its own log.

The parent's log gains exactly two events: the `tool/call` and a `tool/result` saying "Started child-1." Everything the child reads stays out of the parent's history.

Why return at once instead of waiting for the child's final text? Waiting is simpler, and many harnesses start that way. But a waiting tool blocks the parent's whole turn, and three helpers would run one after another. Returning at once lets the model start three helpers in one reply, so they run side by side.

There is also a design choice about what the child knows. A fresh child gets only the brief. A forked child starts with a copy of the parent's finished history, which saves rewriting context but costs tokens. `minidsh` uses fresh children.

> **Key idea:** A subagent is a separate agent, with its own event log and inbox, that another agent starts through a tool call to do one self-contained task; it inherits the parent's model and limits but none of its history.

**In DeepSeek Harness:** the tool is `packages/subagent/tool-subagent`. It calls `ctx.subagents.startActivation(...)`, which returns a name at once while the child runs in the background. Providers decide how the child runs: `subagent-spawn-in-process` (fresh), `subagent-fork-in-process` (seeded with the parent's completed turns), and out-of-process ones such as `subagent-codex`, `subagent-claude-code` and `subagent-acp`. A local child gets its own durable session. It inherits provider, model, effort and token limit unless overridden, and the sandbox setting. Its approval policy is pinned to `never`. Tools and prompt sections registered in the parent's agent scope are not inherited. The tool's prompt section tells the model to start parallel helpers in one message, end its turn instead of polling, and give each helper its own files to write.

## What you have now

An agent can now split work across fresh agents, each built from the same inbox, loop and event log, with the parent's history kept small. But the tool returned only "Started child-1". When the child finishes, how does its answer reach the parent, and what wakes the parent to read it?
