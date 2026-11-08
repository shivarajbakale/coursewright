# Subagent: an agent started by another agent

The agent registry lets code create a second agent. Now picture a long task: "find every place that reads the config file, then fix the bug". The search alone may read 40 files. Every file the model reads stays in its history and fills the context window. Could the agent give the search to a helper and keep only the helper's answer?

## A manager and a contractor

Think of a manager who hires a contractor for one job. The manager writes a complete job sheet, because the contractor was not at any earlier meeting. The contractor works at their own desk, with their own notes. The manager receives the finished report, not every note the contractor wrote.

A subagent works the same way. The parent agent calls a tool. The tool creates a child agent with a fresh, empty session and sends it the task as its first message. The child runs its own turns, and its tool results fill its own context window, not the parent's.

The picture differs in one way: a contractor cannot hire more contractors without limit, and neither can a child. Each child knows its depth, the number of parents above it. The harness refuses to start a child deeper than the depth limit.

```inkling
title "Depth in a tree of agents"
layout down
lead: box "Parent agent\ndepth 0" blue
child: box "agent-1\ndepth 1" green
grand: box "Its child\ndepth 2" gray
lead -> child : "subagent tool"
child -> grand : "refused"
cross grand
note grand "depth limit is 1"
step 1: lead "The parent works at depth 0"
step 2: child "Its child gets depth 1 and a fresh session"
step 3: grand "A child at depth 2 would pass the limit"
```

## The subagent tool in mini-dsh

Earlier tools received only their arguments. A delegation tool also needs to know who called it, so the pipeline in mini-dsh now passes a second argument, `exec`, with the calling agent in `exec.agent`. The tool lives in `src/subagent.ts`:

```ts
const MAX_DEPTH = 1

export const subagentTool = defineTool({
  name: 'subagent',
  description: 'Delegate a self-contained task to a separate agent with its own context. '
    + 'It returns its result, not its intermediate steps.',
  parameters: {
    description: { type: 'string', required: true, description: 'A 3-5 word label for the task' },
    prompt: { type: 'string', required: true, description: 'The complete task. The child does not see this conversation.' },
  },
  async execute(args, exec) {
    const parent = exec.agent
    const depth = parent.depth + 1
    if (depth > MAX_DEPTH) throw new Error(`subagent depth ${depth} exceeds maxDepth ${MAX_DEPTH}`)
    const name = `agent-${++parent.childCount}`
    const handle = await exec.ctx.get('agents')!.create({
      sessionId: randomUUID(),
      meta: { parentId: parent.id, depth, name },
    })
    parent.children.set(name, handle)
    handle.agent.followup(userText(args.prompt))
    return { name }
  },
})
```

The depth goes into the child session's metadata, so a resumed child keeps it. Trace one call:

1. The parent, at depth 0, calls `subagent` with the prompt "List every file that reads config.json".
2. The tool computes depth 0 + 1 = 1. That is not more than 1, so the check passes.
3. The registry creates a session with a new id. The parent keeps the handle under the name `agent-1`.
4. The tool sends the prompt as a followup. The child is idle, so its turn 1 opens.
5. The tool returns `{ name: 'agent-1' }` at once. The parent's step ends while the child still works.

Now the child calls `subagent` itself. Its depth is 1, so the new depth is 2, which is more than 1. The tool throws, and as you saw with tool error results, the child's model reads the error and does the work itself.

> **Key idea:** A subagent is a child agent that a tool starts with a fresh session and a complete prompt, refused above the depth limit.

## How dsh does it

The model-facing tool is in `packages/subagent/tool-subagent/src/index.ts`. Its `execute` calls `ctx.subagents.startActivation()` (line 326) and returns only the child's name, which the tool renders as "started subagent agent-1". The `ctx.subagents` service (`packages/subagent/subagent/src/index.ts`) does not build agents; providers do. The `spawn` provider gives the child a fresh session, and the `fork` provider seeds it with the parent's completed turns. `resolveChildDepth()` in `packages/subagent/subagent/src/child-agent.ts` (line 49) adds 1 to the parent's depth and throws `SubagentDepthError` above the cap. The cap defaults to 1 (`index.ts`, line 196).

```inkling
title "The subagent packages in dsh"
layout mindmap
- ctx.subagents (subagent/subagent)
  - called by tool-subagent
  - provider: spawn (fresh session)
  - provider: fork (parent turns copied)
  - providers for outside agents
    - subagent-codex, subagent-claude-code
  - creates local children with ctx.agents
steps auto
```

## What you have now

A parent can now start a child through a tool, and the depth limit stops a chain of children from growing without end. The child runs with the same tools and permissions as any agent. Should a helper the model started have the same power as the agent a person talks to?
