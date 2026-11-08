# Agent registry: creating and finding live agents

The agent inbox lets you send a steer or a followup to an agent. But a harness can run several agents in one process: one for each open chat window, and later one for each helper an agent starts. When a message arrives for session `s-2`, which agent object receives it? And who is allowed to stop that agent?

## A hotel reception desk

Think of the reception desk in a hotel. The desk gives each guest a room and writes the room number in a book. Anybody can ask the desk who is in room 12. A guest who returns after a trip gets the same room, and the luggage from storage goes back into it. Only the guest with the key card can end the stay.

In a harness, the registry is the desk. The room number is the session id, and one live agent owns each session. The luggage is the session file you saved as JSONL. The key card is a handle: an object that holds the agent and a `dispose` function that stops it.

The picture differs in one way. A hotel can give a guest a new room number, but an agent keeps its session id forever. The id is also the name of its file.

```inkling
title "What the registry does"
layout mindmap
- Agent registry
  - create a new agent and session
  - resume an agent from its file
  - get one agent by session id
  - list every live agent
  - dispose through the handle only
steps auto
```

## The registry in mini-dsh

The registry is a service in `src/agents.ts`. It keeps one map from session id to agent:

```ts
export interface AgentHandle {
  agent: Agent
  dispose(): Promise<void>
}

export class AgentRegistry {
  private store = new Map<string, Agent>()
  constructor(private ctx: Context) {}

  async create(options: { sessionId: string }): Promise<AgentHandle> {
    if (this.store.has(options.sessionId)) throw new Error(`agent "${options.sessionId}" already exists`)
    return this.publish(await this.ctx.get('sessions')!.create(options.sessionId))
  }

  async resume(options: { sessionId: string }): Promise<AgentHandle> {
    return this.publish(await this.ctx.get('sessions')!.open(options.sessionId))
  }

  get(id: string): Agent | undefined { return this.store.get(id) }
  list(): Agent[] { return [...this.store.values()] }

  private publish(session: Session): AgentHandle {
    const agent = new Agent(this.ctx, session)
    this.store.set(session.id, agent)
    this.ctx.emit('agent/created', { agent })
    return {
      agent,
      dispose: async () => {
        agent.cancel({ kind: 'disposed' })
        await agent.whenIdle()
        this.store.delete(session.id)
        agent.scope.dispose()
        this.ctx.emit('agent/disposed', { agent })
      },
    }
  }
}
```

The `sessions` service keeps one `SessionFile` from `src/store.ts` for each session. Its `create(id)` and `open(id)` return the `Session`, and its `flush(session)` calls that session's `SessionFile.flush()`.

`new Agent` also makes the agent's own scoped context, as you saw with agent scope. Tools and listeners added for this agent stay with it. Trace four calls:

1. `create({ sessionId: 's-1' })` and `create({ sessionId: 's-2' })` return two handles. `list()` now returns 2 agents.
2. A web request for `s-2` calls `get('s-2').followup(message)`. The registry gives the bare agent, not the handle, so the caller can send input but cannot stop it.
3. The owner of the `s-2` handle calls `dispose()`. The loop stops, the map entry goes, and the scope removes the agent's tools. `list()` returns 1.
4. Later, `resume({ sessionId: 's-2' })` opens `s-2.jsonl`. The new agent rebuilds its history and its waiting inbox messages from the events in the file.

> **Key idea:** An agent registry creates, resumes and finds live agents by session id; only the handle from create or resume can dispose one.

## How dsh does it

The registry is `AgentRegistry`, mounted as `ctx.agents`, in `packages/core/agent/src/index.ts` (line 246). It keeps `store = new Map<SessionId, AgentEntry>()`; `get(id)` (line 580) and `list()` (line 588) read it. The registry does not build agents itself. `create()` (line 410) and `resume()` (line 429) call a factory. The loop package registers it with `ctx.agents.setFactory(this)` (`packages/core/agent-loop/src/index.ts`, line 335). The package README says the handle's disposer "is a capability: among consumers, only its holder can tear the agent down".

```inkling
title "Who builds an agent in dsh"
layout down
caller: box "Caller\n(web, SDK, a tool)"
agents: box "core/agent\nctx.agents" yellow
loop: box "core/agent-loop\nthe factory"
session: db "core/session\nthe session log"
caller -> agents : "create or resume"
agents -> loop : "createAgent()"
loop -> session : "new or loaded session"
loop --> caller : "AgentHandle"
step 1: caller, agents "A caller asks the registry for an agent"
step 2: loop "The registry hands the work to the loop's factory"
step 3: session "The factory makes or opens the session"
```

## What you have now

The registry joins three earlier ideas: the session file, the inbox, and the agent scope. Code can now make a second agent beside the first and send it messages. What happens when an agent itself wants a helper agent for part of its task?
