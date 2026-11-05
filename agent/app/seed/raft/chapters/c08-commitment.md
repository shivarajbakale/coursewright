# Commitment and the current-term rule

The leader now knows how to get entries onto followers. The remaining question is the one clients care about: when is an entry *done*? Raft calls such an entry **committed**. A committed entry is durable (it will never be lost or overwritten) and will eventually be applied by every available state machine. This chapter defines exactly when an entry becomes committed, and walks through the scenario that forced Raft to make that definition stricter than it first appears.

## commitIndex and lastApplied

Every server tracks two indices:

- `commitIndex`: the highest log index it knows to be committed.
- `lastApplied`: the highest log index it has applied to its state machine.

Always `lastApplied <= commitIndex <= lastLogIndex`. Whenever `commitIndex > lastApplied`, the server increments `lastApplied` and applies `log[lastApplied]`, in order, one at a time. Followers learn the leader's `commitIndex` through the `LeaderCommit` field of every AppendEntries, including heartbeats. The leader's own `commitIndex` is advanced by the rule below.

```go
// Runs in its own goroutine; signalled whenever commitIndex moves.
func (rf *Raft) applier() {
    rf.mu.Lock()
    defer rf.mu.Unlock()
    for !rf.killed() {
        for rf.lastApplied >= rf.commitIndex {
            rf.applyCond.Wait()
        }
        rf.lastApplied++
        msg := ApplyMsg{Index: rf.lastApplied, Command: rf.log[rf.lastApplied].Command}
        rf.mu.Unlock()
        rf.applyCh <- msg // never hold the lock while blocking on a channel
        rf.mu.Lock()
    }
}
```

## The first-draft rule, and why it is wrong

The natural definition is: an entry is committed once it is stored on a majority of servers. For entries created in the *leader's current term*, that is exactly right. Any future leader needs votes from a majority, the voter majority overlaps the storing majority, and the election restriction (Chapter 6) ensures the winner's log contains the entry.

But a new leader also inherits entries from earlier terms that its predecessor replicated only partially. It will replicate those too, and at some point one of them will reach a majority. Is it committed then? The answer is **no**, and the Raft paper's Figure 8 shows why.

## Figure 8, step by step

Five servers. Each log is written as the term of its entries, index 1 first. Index 1 (term 1) is committed everywhere.

**(a)** S1 is leader in term 2. It appends an entry at index 2 and replicates it to S2 only, then crashes.

```
S1: 1 2      S2: 1 2      S3: 1      S4: 1      S5: 1
```

**(b)** S5 is elected leader for term 3 with votes from S3, S4 and itself. Their logs all end at (index 1, term 1), so S5's log is as up-to-date as theirs. S5 accepts a client command and appends it at index 2 with term 3, then crashes before replicating it.

```
S1: 1 2      S2: 1 2      S3: 1      S4: 1      S5: 1 3
```

**(c)** S1 restarts and is elected for term 4 with votes from S1, S2 and S3. It continues replicating its old term 2 entry and gets it onto S3. It also accepts a new command at index 3 in term 4, stored only on itself so far.

```
S1: 1 2 4    S2: 1 2      S3: 1 2    S4: 1      S5: 1 3
```

The term 2 entry at index 2 is now on S1, S2 and S3, a majority. Under the first-draft rule, S1 would mark it committed and might apply it and reply to a client.

**(d)** S1 crashes. S5 times out and runs for leader in a new term. Its last entry is (index 2, term 3). S2, S3 and S4 have last terms 2, 2 and 1, all lower than 3, so S5's log is more up-to-date than each of theirs and they all grant their votes. S5 wins and, as leader, forces its log on everyone: index 2 becomes its term 3 entry on all servers.

```
S1: 1 3      S2: 1 3      S3: 1 3    S4: 1 3    S5: 1 3
```

The term 2 entry that had been "committed" in (c) is gone. If S1 had applied it, its state machine has diverged from everyone else's. Being on a majority was not enough, because the election restriction compares *last terms*, and a server holding an old-term entry can lose to one holding a newer-term entry that is not on a majority at all.

## The current-term rule

Raft's fix is to never commit an entry from a previous term by counting replicas. A leader only advances `commitIndex` by counting replicas of an entry from its **own current term**. Once such an entry is committed, every entry before it is committed indirectly, by the Log Matching Property.

```go
func (rf *Raft) advanceCommitIndex() {
    for n := rf.lastLogIndex(); n > rf.commitIndex; n-- {
        if rf.log[n].Term != rf.currentTerm {
            break // older-term entries are only committed indirectly
        }
        count := 1 // the leader itself
        for peer := range rf.peers {
            if peer != rf.me && rf.matchIndex[peer] >= n {
                count++
            }
        }
        if count > len(rf.peers)/2 {
            rf.commitIndex = n
            rf.applyCond.Signal()
            return
        }
    }
}
```

The loop scans downward and stops at the first older-term entry it meets; since terms in a log never decrease, everything below that point is from an earlier term too.

> **Key idea:** A leader may only commit an entry by counting replicas if that entry is from its current term. Committing it then commits every earlier entry too, because logs that agree on an entry agree on everything before it.

Now replay step (c) under the new rule. S1 does not consider index 2 committed. Two futures are possible:

**(d)** S1 crashes before replicating index 3. S5 can still win and overwrite index 2, but index 2 was never committed, so no client was told it succeeded and no state machine applied it. No harm.

**(e)** S1 replicates its term 4 entry at index 3 to S2 and S3 before crashing. That entry is from S1's current term and is on a majority, so it is committed, and so is index 2 beneath it.

```
S1: 1 2 4    S2: 1 2 4    S3: 1 2 4  S4: 1      S5: 1 3
```

Can S5 win now? Its last term is 3; S1, S2 and S3 have last term 4 and refuse it. It can get only S4 and itself. It cannot win, and the committed entries are safe.

## The cost, and the no-op

The rule has a liveness consequence. A new leader cannot commit inherited entries until it commits something from its own term. If no clients send commands, it might sit for a long time without knowing what is committed. Raft's answer, described in Section 8 of the paper, is for every new leader to append a **no-op entry** at the start of its term. Once the no-op commits, everything before it is committed too, and the leader learns its true `commitIndex` right away. The no-op returns in Chapter 10, where it also makes linearizable reads possible.

## Worked example: when does the leader commit?

A leader in term 5 has log terms `3 3 4 5 5` (indices 1 to 5), `commitIndex = 2`, and in a five-server cluster `matchIndex = {S2: 5, S3: 3, S4: 4, S5: 2}`.

- Index 5 (term 5): stored on leader and S2. Two of five. Not committed.
- Index 4 (term 5): stored on leader, S2 and S4. Three of five, current term. Committed.
- So `commitIndex` jumps from 2 to 4, committing index 3 (term 4) along with it, even though index 3 was itself on a majority before and the leader correctly refused to commit it on its own.

The leader applies indices 3 and 4, replies to the clients waiting on them, and on its next heartbeat sends `LeaderCommit = 4` so the followers apply them too.
