# Failures and majority quorums

Before designing a fault-tolerant protocol you have to say precisely which faults it tolerates. A protocol that is "fault tolerant" against the wrong failure model is not fault tolerant at all. This chapter pins down Raft's failure model and then introduces the single tool that the whole algorithm leans on: the majority quorum.

## The failure model

Raft assumes a **non-Byzantine** environment. Servers may fail, but they fail by stopping, not by lying.

- **Crash-stop**: a server halts and never comes back. From everyone else's point of view it simply stops responding.
- **Crash-recover**: a server halts and later restarts. Anything in memory is lost, but anything it wrote to stable storage (and flushed with `fsync`) survives. Raft is designed for this model, which is why a few pieces of state must be persisted before a server replies to an RPC.
- **Unreliable network**: messages can be lost, delayed by arbitrary amounts, duplicated and reordered. Nothing is ever *corrupted* undetectably, and a server never receives a message that nobody sent.
- **Partitions**: the network can split into groups that can talk internally but not to each other. A partition is indistinguishable from a set of crashes, from the inside.

What Raft does **not** handle is **Byzantine** failure: a server that sends conflicting messages to different peers, forges votes, or runs buggy code that misreports its log. Byzantine fault tolerance is possible (PBFT is the classic algorithm) but costs more: tolerating `f` Byzantine servers needs at least `3f + 1` servers, and the protocols need extra message rounds and usually cryptographic signatures. Crash fault tolerance needs only `2f + 1`. Inside a single data centre run by one organisation, crash faults dominate, so Raft, Paxos and Zab all use the cheaper model.

A practical consequence: a bug that corrupts a server's disk, or an operator who restores an old backup of one server's Raft state, is effectively a Byzantine fault. Raft's guarantees assume this never happens.

## Why majorities

A Raft cluster has a fixed membership of `N` servers (we will relax "fixed" in the last module). Every decision in Raft, whether electing a leader or committing a log entry, requires agreement from a **majority**: more than `N/2` servers, which is `floor(N/2) + 1`.

The reason is one simple fact:

> **Key idea:** Any two majorities of the same set of servers share at least one server. So any information that a majority has accepted is guaranteed to be known by at least one member of every future majority.

The proof is a counting argument. If majority `A` and majority `B` were disjoint, then `|A| + |B| <= N`. But each has more than `N/2` members, so `|A| + |B| > N`. Contradiction.

This overlap is what replaces "wait until you are sure the old leader is dead", which FLP tells us we can never be sure of. Two different leaders cannot both be elected in the same term, because each would need votes from a majority, the majorities would overlap, and the overlapping server only votes once per term. A committed log entry cannot be forgotten, because it is stored on a majority, and any future leader needs votes from a majority that includes at least one of those servers.

```python
def majority(n: int) -> int:
    """Smallest number of servers that forms a quorum in a cluster of n."""
    return n // 2 + 1

def tolerated_failures(n: int) -> int:
    """How many servers can be down while a majority remains."""
    return n - majority(n)   # == (n - 1) // 2

for n in range(1, 8):
    print(n, majority(n), tolerated_failures(n))
# 1 1 0
# 2 2 0
# 3 2 1
# 4 3 1
# 5 3 2
# 6 4 2
# 7 4 3
```

## Odd cluster sizes

Look at the table. A four-server cluster tolerates the same single failure as a three-server cluster, but needs three acknowledgements per write instead of two, and has one more machine that can fail. Even sizes buy nothing, which is why Raft clusters are almost always 3 or 5 servers. Five is the common production choice: it tolerates two failures, so you can take one server down for maintenance and still survive an unexpected crash. Seven is occasionally used; beyond that, every write pays the latency of the slowest server in an ever-larger majority, and the extra fault tolerance is rarely worth it.

## Partitions and the minority side

Quorums also give a clean story for network partitions. When a five-server cluster splits into a group of three and a group of two, only the group of three can form a majority. It can elect a leader and commit entries. The group of two can do neither: a server there may try to become leader, but it can never collect three votes, and an old leader stranded there cannot commit anything because it can never get three acknowledgements.

The minority side is therefore *unavailable* but never *inconsistent*. This is the CAP trade-off in concrete form: during a partition, Raft chooses consistency over availability for the minority.

## Worked example: a five-server partition

Servers S1 to S5. S1 is leader in term 3. The network partitions into `{S1, S2}` and `{S3, S4, S5}`.

1. S1 keeps accepting client commands and appends them to its log. It sends AppendEntries to everyone, but only S2 answers. Two acknowledgements, counting itself, is less than the three a majority needs, so none of the new entries commit. Clients of S1 see their requests hang.
2. On the other side, S3, S4 and S5 stop hearing heartbeats. One of them, say S4, times out, starts an election for term 4, and wins with votes from S3, S4 and S5.
3. S4 accepts and commits new commands, because three acknowledgements is a majority.
4. The partition heals. S1 receives a message carrying term 4, notices that 4 is greater than its own term 3, and steps down to follower. S4 then overwrites the uncommitted entries in S1's and S2's logs with its own.

No client ever saw a committed result that was later lost. The clients that talked to S1 during the partition got timeouts, retried, and eventually found S4. Every piece of that recovery depends on the overlap argument: there was never a moment where two disjoint majorities could each commit something.
