# Depth limit: a cap on agents starting more agents

A child agent gets the same tools as its parent, and that includes the subagent tool. So a child can start a child, which can start another. Usually that is harmless. But a model that misreads its brief may decide the best way to "review the parser" is to delegate the review, and its child may decide the same. Each level is a fresh agent making paid model requests, and nothing in the inbox or the loop says stop. The step limit caps how long one turn runs; nothing yet caps how deep the tree grows. What should?

## Levels of management

Picture a company rule: "a team lead may hand work to a colleague, but that colleague does the work themselves." Work can be split once, and then someone has to actually do it. Each extra level allowed by the rule adds one more layer of handing off.

```inkling
title "How the depth cap stops delegation"
you: person "You"
top: box "Top agent\ndepth 0" green
child: box "Child agent\ndepth 1" yellow
check: diamond "parent.depth >= MAX_DEPTH?"
deep: box "Child agent\ndepth 2" gray
work: round "Does the work itself"

you -> top : "you talk to it"
top -> check : "calls subagent"
check -> child : "0 >= 1 is false"
child -> check : "calls subagent anyway"
check -> work : "1 >= 1 is true, error result"
note check "MAX_DEPTH = 1 allows two levels"
step 1: you, top "The agent you talk to has depth 0"
step 2: check "It calls subagent, so the check runs"
step 3: child "The child starts with depth 1 and its prompt says do the work"
step 4: work "A second call is refused, so the child works itself"
circle check
```

The picture stops holding because a model, unlike a colleague, does not read the company handbook unless you put the rule in front of it. So the cap needs two parts: a hard check that refuses, and a plain sentence in the prompt so the model does not waste a step trying.

Give every `Agent` a `depth`: `0` for the agent the person talks to, and the parent's depth plus one for each child. Then in `src/agents.ts`:

```ts
const MAX_DEPTH = 1

// inside subagentTool's execute, before creating the child:
if (parent.depth >= MAX_DEPTH) {
  throw new Error(
    `Delegation depth: current ${parent.depth}, maximum ${MAX_DEPTH}, ` +
    `remaining levels 0. Carry out the work directly.`)
}
const child = new Agent({ /* as before */ depth: parent.depth + 1 })

// a prompt section, rendered per agent:
export const depthSection = (agent: Agent) =>
  agent.depth < MAX_DEPTH ? '' :
  `You are at delegation depth ${agent.depth} of ${MAX_DEPTH}. ` +
  `Do not call subagent; do the work directly.`
```

The thrown error becomes a tool error result through the tool pipeline, so the model reads why and can recover. The prompt section means a well-behaved model never tries.

## Counting it through

With `MAX_DEPTH = 1`:

1. The agent you talk to has depth 0. It calls `subagent`. The check is `0 >= 1`, false, so `child-1` starts with depth 1.
2. `child-1`'s system prompt includes the depth sentence, because `1 < 1` is false.
3. If `child-1` calls `subagent` anyway, the check is `1 >= 1`, true. The call gets an error result and `child-1` does the review itself.

So `MAX_DEPTH = 1` allows two levels of agents in all: you and your helpers. Setting it to 2 allows helpers of helpers, three levels. Setting it to 0 turns delegation off.

One detail matters for session resume. The depth must be saved in the child's session file, not only held in memory. Otherwise a child resumed after a restart would be rebuilt with depth 0 and could delegate as if it were the top agent.

> **Key idea:** A depth limit counts how many levels of agents sit above an agent (0 at the top, parent plus one for each child) and refuses the subagent tool at the maximum, while a prompt section tells the model in advance to do the work itself.

**In DeepSeek Harness:** depth is counted in `packages/subagent/subagent/src/depth.ts`: "zero for a top-level agent and parent depth + 1 for a child". The value saved in the session header is authoritative and "may DEEPEN the count but can never lower it", because "a resumed child arrives with fresh options". The default maximum is 1 (`packages/subagent/subagent/src/index.ts`, around line 196). Going over it raises `SubagentDepthError`. At the limit, `packages/subagent/tool-subagent/src/index.ts` adds: "Delegation depth for `subagent`: current 1, maximum 1, remaining levels 0. Do not call `subagent` at this depth; carry out the work directly."

## What you have now

Delegation is now bounded: a tree of agents built from inboxes and separate logs, at most a fixed number of levels deep. The same inbox trick works for any work that finishes later. What about a single command, like a four-minute test run, that should keep going while the agent does something else?
