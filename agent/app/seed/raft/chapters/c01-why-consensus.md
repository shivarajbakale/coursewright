# Why consensus?

A single server is easy to reason about. It holds the data, it handles every request in some order, and if you ask it a question it gives you the answer it currently believes. The trouble is that a single server is also a single point of failure. Disks die, kernels panic, power supplies fail, and someone eventually trips over a cable. If your configuration store, lock service or metadata database lives on one machine, your whole system is down whenever that machine is.

The obvious fix is to run several copies. The hard part is keeping those copies the same while machines crash and the network misbehaves. This chapter explains the standard way of framing that problem, the *replicated state machine*, and why making it work requires solving *consensus*.

## Replicated state machines

A state machine, in this sense, is any deterministic program that takes commands one at a time and updates some state. A key-value store is a good example: the state is a map, and the commands are `Put(k, v)`, `Append(k, v)` and `Get(k)`.

Determinism is the important word. If two copies of the same state machine start in the same state and apply the same commands in the same order, they end in the same state and produce the same outputs. So instead of trying to copy *state* between servers, we copy the *sequence of commands*, which we call the log. Each server keeps its own log and its own state machine, and applies entries from the log in order.

```go
// A tiny deterministic state machine.
type KV struct {
    data map[string]string
}

type Command struct {
    Op    string // "put" | "append" | "get"
    Key   string
    Value string
}

func (kv *KV) Apply(cmd Command) string {
    switch cmd.Op {
    case "put":
        kv.data[cmd.Key] = cmd.Value
    case "append":
        kv.data[cmd.Key] += cmd.Value
    }
    return kv.data[cmd.Key]
}
```

Nothing in `Apply` reads the clock, picks a random number or depends on goroutine scheduling. That is what lets three copies of it stay identical. If a command needed a timestamp, the server that proposes the command would pick the timestamp and put it *inside* the command, so every replica sees the same value.

> **Key idea:** If every replica applies the same commands in the same order, every replica ends in the same state. Replication therefore reduces to one problem: agreeing on the contents and order of a log.

The architecture from the Raft paper has three layers on each server: a consensus module that manages the log, the log itself, and the state machine that consumes it. Clients send commands to the consensus module; it makes sure the command ends up at the same position in every server's log; once the entry is safely replicated, each server applies it and the leader returns the result to the client.

## Why naive replication fails

Suppose we skip consensus and just have clients send every write to all three replicas. Two clients, A and B, write the same key at nearly the same time. Replica 1 receives A's write then B's; replica 2 receives B's then A's. Now the replicas disagree about the value of the key, forever, and nothing in the protocol will notice.

Suppose instead we designate one server as primary, and it forwards writes to the others in order. That fixes ordering, but now ask what happens when the primary stops responding. Has it crashed, or is the network between you and it just slow? If the backups promote one of themselves and the old primary was actually alive, you have two primaries accepting conflicting writes, a condition called *split brain*. If they wait instead, the system is unavailable for as long as the primary stays unreachable. Many early systems resolved this with a human operator or a separate, itself-replicated, coordinator. Consensus algorithms are what those coordinators run.

## What consensus has to guarantee

A consensus algorithm for a replicated log must provide:

- **Safety**: never return an incorrect result. Concretely, no two servers ever apply different commands at the same log index. This must hold under every combination of message delay, loss, duplication and reordering, and under any number of crashes.
- **Availability (liveness)**: keep making progress as long as a majority of servers are running and can talk to each other and to clients. A five-server cluster keeps working with any two servers down.
- **No dependence on timing for safety**: clocks may drift and messages may take arbitrarily long. Bad timing is allowed to make the system slow or temporarily unavailable, but never wrong.

Paxos, from Leslie Lamport, was for decades the standard answer. It is correct, but notoriously hard to understand and leaves many practical details (how to build a full log, how to change membership) to the implementer. Raft, published by Diego Ongaro and John Ousterhout in 2014, gives the same guarantees and similar performance but was designed with understandability as its primary goal. It does this by decomposing the problem into leader election, log replication and safety, and by using a strong leader: log entries flow only from the leader to the other servers.

## FLP: why timing must not be trusted for safety

In 1985 Fischer, Lynch and Paterson proved that in a fully asynchronous system, where messages can be delayed arbitrarily and there is no way to distinguish a crashed process from a slow one, no deterministic consensus algorithm can guarantee that it will always terminate if even one process may crash. This FLP impossibility result does not say consensus is useless. It says you must give something up, and practical algorithms give up *guaranteed* termination: they are always safe, and they make progress whenever the system behaves "reasonably" synchronously for long enough. Raft uses timeouts to detect failed leaders and randomization to break ties, so in an adversarial schedule it could keep holding elections forever, but it will never let two servers apply different commands at the same index.

## Worked example: three replicas, one bank balance

Consider a three-server cluster replicating a single counter, `balance`, starting at 100. Two commands arrive: `withdraw 30` from client A and `deposit 50` from client B.

Without agreement on order, server 1 might apply withdraw then deposit (100 → 70 → 120) while server 2 applies deposit then withdraw (100 → 150 → 120). Here the final values happen to match because addition commutes. Now change B's command to `double`. Server 1 computes 100 → 70 → 140; server 2 computes 100 → 200 → 170. The replicas have diverged, and any read could return either answer.

With a replicated log, the leader assigns `withdraw 30` to index 1 and `double` to index 2. Every server applies index 1 before index 2 and reaches 140. If server 3 is down when this happens, it catches up later by receiving entries 1 and 2 and applying them in order, again reaching 140. The rest of this course is about how Raft decides what goes at each index, and how it ensures that decision is never undone.
