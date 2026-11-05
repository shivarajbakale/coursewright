# Membership changes and clients

The core algorithm is complete: elections, replication, commitment and compaction. Two problems remain before Raft can run a real service. Clusters need to change shape, as machines are replaced or capacity grows, without taking the service down. And clients need guarantees about their requests: that a retried write is not applied twice, and that a read returns the latest committed value. This chapter covers both.

## Why membership changes are dangerous

Configuration is just the list of servers in the cluster. The danger in changing it is that servers cannot all switch at the same instant. Suppose a three-server cluster `{S1, S2, S3}` grows to five by adding S4 and S5, and each server adopts the new configuration whenever it hears about it. For a moment, S1 and S2 may still use the old configuration, where 2 of 3 is a majority, while S3, S4 and S5 use the new one, where 3 of 5 is a majority. S1 could be elected by `{S1, S2}` and S5 by `{S3, S4, S5}` in the same term. Two leaders: Election Safety is broken.

Every safe scheme must ensure that during the transition, there is no moment where the old and new configurations can each form a majority independently.

## Single-server changes

Ongaro's thesis recommends the simplest approach: only add or remove **one server at a time**. If the old and new configurations differ by exactly one server, any majority of the old and any majority of the new must overlap. (With N servers going to N+1, a majority of the old is at least `floor(N/2)+1`, a majority of the new is at least `floor((N+1)/2)+1`, and together they exceed N+1.) So two leaders can never be elected in the same term even if some servers use the old configuration and some use the new.

The mechanics:

1. The leader appends a special configuration entry `C_new` to its log and replicates it like any other entry.
2. Each server uses the **latest configuration in its log**, whether or not that entry is committed. The leader uses `C_new` for counting votes and commits as soon as it appends it.
3. Once `C_new` is committed, the change is complete, and the next change may begin. If the leader was removed, it steps down once `C_new` commits.

A new server usually joins as a non-voting **learner** first, receiving the log (or a snapshot) without being counted in majorities, until it has caught up. Otherwise adding a server with an empty log can stall commits: in a three-server cluster with one slow member, adding an empty fourth means three of four must acknowledge each entry.

There is one subtle bug in the original single-server algorithm, found by Ongaro after the thesis and posted to the raft-dev list in 2015: if leadership changes during a configuration change, two overlapping changes from different terms can lead to disjoint majorities. The fix is the no-op from Chapter 8: a leader must not append a configuration entry until it has committed an entry in its current term.

## Joint consensus

The original paper uses a more general scheme, **joint consensus**, that can change any number of servers at once. The leader first commits a transitional configuration `C_old,new`. While it is in effect, every decision (elections and commits) needs **separate majorities from both** `C_old` and `C_new`. Once `C_old,new` commits, the leader commits `C_new` alone. At no point can `C_old` or `C_new` decide unilaterally. Joint consensus is more complex and most implementations (etcd, Consul, LogCabin) use single-server changes or a joint-consensus variant built on the same log mechanics.

Removed servers cause one more problem: they stop receiving heartbeats, time out, and send RequestVote with higher terms, disrupting the real leader. Raft's fix is that a server ignores RequestVote if it has heard from a current leader within the minimum election timeout. The thesis also describes a **Pre-Vote** phase, where a would-be candidate first checks that it could win before incrementing its term.

## Exactly-once commands with client sessions

A client sends `Append(x, "a")` to the leader. The leader commits and applies it, then crashes before replying. The client times out and retries with the new leader. Without extra care, the command is applied twice, and `x` ends with `"aa"`.

Raft's answer is for the *state machine* to detect duplicates. Each client gets a unique ID and numbers its requests with increasing sequence numbers. The state machine remembers, per client, the highest sequence number applied and its result:

```python
class KVStateMachine:
    def __init__(self):
        self.data = {}
        self.sessions = {}   # client_id -> (last_seq, last_result)

    def apply(self, cmd):
        last = self.sessions.get(cmd.client_id)
        if last and cmd.seq <= last[0]:
            return last[1]                 # duplicate: return cached result, do not re-apply
        if cmd.op == "put":
            self.data[cmd.key] = cmd.value
        elif cmd.op == "append":
            self.data[cmd.key] = self.data.get(cmd.key, "") + cmd.value
        result = self.data.get(cmd.key, "")
        self.sessions[cmd.client_id] = (cmd.seq, result)
        return result
```

This works because deduplication happens *in the replicated state machine*, so every replica makes the same decision and the session table survives leader changes. It must be included in snapshots. Real systems also expire old sessions, which itself must be done deterministically, using times carried in log entries.

## Linearizable reads

A read changes nothing, so it is tempting to have the leader answer from its local state. But a leader may have been deposed without knowing it (say it is partitioned away), and a new leader may already have committed newer writes. Answering locally could return stale data. Putting reads through the log works but costs a disk write and a replication round per read. Raft offers two cheaper options.

**ReadIndex.** The leader:

1. Makes sure it has committed an entry from its current term (the start-of-term no-op), so its `commitIndex` is up to date.
2. Records its current `commitIndex` as the `readIndex`.
3. Sends a round of heartbeats and waits for a majority to acknowledge, proving it was still leader when the read arrived.
4. Waits until `lastApplied >= readIndex`, then answers from the state machine.

This costs one network round trip and no disk write, and is safe under any timing.

**Leases.** The leader uses its heartbeats as a lease: after a majority acknowledges a heartbeat sent at time t, no other leader can be elected until at least t plus the election timeout (since followers will not time out before then). Within that window, the leader can answer reads with no extra round trip. The catch is that leases depend on bounded clock drift; a paused process or a jumping clock can break them. Use them only when that risk is acceptable.

> **Key idea:** Change membership one server at a time so old and new majorities always overlap, deduplicate retries inside the replicated state machine using client IDs and sequence numbers, and confirm leadership (ReadIndex) before serving a read so it can never return stale data.

## Worked example: a retried write and a read

Client C (ID 17) talks to leader S1 in term 8.

1. C sends `Append(x, "a"), seq = 5`. S1 commits it at index 120; every state machine applies it, sets `x = "a"` and records `sessions[17] = (5, "a")`. S1 crashes before replying.
2. S2 wins term 9, appends a no-op at index 121 and commits it.
3. C times out and resends `Append(x, "a"), seq = 5` to S2. S2 commits it at index 122. On apply, every state machine sees `seq 5 <= last_seq 5` and returns the cached `"a"` without changing `x`.
4. C sends `Get(x)`. S2 has committed its no-op, so it records `readIndex = 122`, sends heartbeats, hears back from two followers (a majority with itself), waits until it has applied index 122, and replies `"a"`.

The write was applied exactly once, and the read reflected every write committed before it arrived.
