# AppendEntries and log matching

Once a leader is elected, its job is to take client commands, put them in its log, and get every follower's log to look like its own. It does all of this with a single RPC, AppendEntries. The interesting part is not sending entries, which is easy, but repairing followers whose logs have drifted: followers that missed entries, and followers that hold extra entries from a leader that crashed before committing them. This chapter shows how one small consistency check makes the repair automatic.

## The normal case

When a client sends a command, the leader appends a new entry `{Term: currentTerm, Command: cmd}` to its own log, then sends AppendEntries to each follower in parallel. Once the entry is safely replicated (the next chapter defines "safely"), the leader applies it to its state machine and replies to the client. If a follower is slow or a packet is lost, the leader retries indefinitely, even after it has answered the client, until every follower stores every entry.

Batching comes for free. An AppendEntries carries a slice of entries, so a leader that receives ten commands while a previous RPC is in flight can send all ten in the next one.

## The consistency check

Every AppendEntries includes two fields describing the entry *immediately before* the new ones: `PrevLogIndex` and `PrevLogTerm`. The follower accepts the RPC only if its own log contains an entry at `PrevLogIndex` whose term is `PrevLogTerm`. Otherwise it replies `Success: false`.

That single check maintains the **Log Matching Property**:

1. If two entries in different logs have the same index and term, they store the same command.
2. If two entries in different logs have the same index and term, the logs are identical in all preceding entries.

Part 1 holds because a leader creates at most one entry per index in a given term, and entries never change position. Part 2 holds by induction on the consistency check: an empty log trivially satisfies it, and every successful AppendEntries extends a log only when the preceding entry already matches the leader's. So if a follower accepts entries after `(PrevLogIndex, PrevLogTerm)`, its log matches the leader's through `PrevLogIndex`, and therefore through the new entries too.

> **Key idea:** A follower only accepts new entries if it already holds the leader's entry just before them, matched by index and term. By induction, that one check guarantees that two logs agreeing on any single (index, term) agree on everything before it.

## The receiver's rules

Here is the follower side, following Figure 2 of the paper:

```go
func (rf *Raft) AppendEntries(args *AppendEntriesArgs, reply *AppendEntriesReply) {
    rf.mu.Lock()
    defer rf.mu.Unlock()

    if args.Term > rf.currentTerm {
        rf.becomeFollower(args.Term) // also persists
    }
    reply.Term = rf.currentTerm
    if args.Term < rf.currentTerm {
        reply.Success = false // stale leader
        return
    }
    rf.role = Follower           // a candidate steps down to a same-term leader
    rf.resetElectionTimer()

    // 1. Consistency check on the previous entry.
    if args.PrevLogIndex > rf.lastLogIndex() ||
        rf.termAt(args.PrevLogIndex) != args.PrevLogTerm {
        reply.Success = false
        return
    }

    // 2. Append, deleting only entries that actually conflict.
    for i, e := range args.Entries {
        idx := args.PrevLogIndex + 1 + i
        if idx <= rf.lastLogIndex() {
            if rf.termAt(idx) == e.Term {
                continue // already have it
            }
            rf.truncateFrom(idx) // conflict: drop it and everything after
        }
        rf.log = append(rf.log, args.Entries[i:]...)
        break
    }
    rf.persist()

    // 3. Learn the commit index, but never beyond what we know matches.
    if args.LeaderCommit > rf.commitIndex {
        lastNew := args.PrevLogIndex + len(args.Entries)
        rf.commitIndex = min(args.LeaderCommit, lastNew)
        rf.applyCond.Signal()
    }
    reply.Success = true
}
```

Two details catch many implementers.

**Truncate only on a real conflict.** It is tempting to just replace everything after `PrevLogIndex` with `Entries`. But RPCs can be delayed and reordered: an old AppendEntries with fewer entries might arrive after a newer one with more. If the follower blindly truncated, it would delete entries it had already acknowledged, which the leader may have counted toward commitment. Only delete starting at an index whose term actually differs.

**Commit only up to the last new entry.** The follower sets `commitIndex = min(LeaderCommit, index of last new entry)`, not `LeaderCommit` itself. Entries beyond what this RPC verified might be stale leftovers that do not match the leader's log.

## nextIndex and matchIndex

The leader tracks each follower with two numbers:

- `nextIndex[i]`: the index of the next entry to send to follower i. When a leader is elected, it sets every `nextIndex` to its own last index + 1, optimistically assuming followers are up to date.
- `matchIndex[i]`: the highest index known to match on follower i. It starts at 0 and only increases.

When an AppendEntries succeeds, the leader sets `matchIndex[i] = PrevLogIndex + len(Entries)` and `nextIndex[i] = matchIndex[i] + 1`. (Compute from the arguments you sent, not from the current log length, because the log may have grown while the RPC was in flight.) When it fails the consistency check, the leader decrements `nextIndex[i]` and retries. Eventually `nextIndex` reaches a point where the logs agree, the check passes, the follower deletes its conflicting suffix and the leader's entries replace it.

## Fast backup

Decrementing by one per round trip is correct but slow when a follower is far behind or has a long run of conflicting entries. The paper sketches an optimisation, and MIT's 6.5840 course standardises a version of it. On a rejection, the follower returns three hints:

- `XTerm`: the term of its conflicting entry at `PrevLogIndex` (or -1 if its log is too short).
- `XIndex`: the first index it holds with term `XTerm`.
- `XLen`: its log length, which with 1-based indexing is also its last index.

The leader then jumps:

```python
def on_reject(leader, peer, x_term, x_index, x_len):
    if x_term == -1:                       # follower's log is too short
        leader.next_index[peer] = x_len + 1
    elif leader.has_term(x_term):          # leader has entries from XTerm
        leader.next_index[peer] = leader.last_index_of_term(x_term) + 1
    else:                                  # leader never saw XTerm
        leader.next_index[peer] = x_index
```

This skips a whole term of conflicting entries per round trip instead of one entry.

## Worked example: repairing a follower

Leader S1 is in term 6 with log (terms) `1 1 4 4 5 5 6`, indices 1 to 7. Follower S3 has `1 1 4 4 4 4`: it got two extra entries from a term 4 leader that crashed.

1. S1 was just elected, so `nextIndex[S3] = 8`. It sends `PrevLogIndex = 7, PrevLogTerm = 6, Entries = []`. S3 has no index 7. With fast backup it replies `Success: false, XTerm = -1, XLen = 6`.
2. S1 sets `nextIndex[S3] = 7` (one past S3's last entry) and sends `PrevLogIndex = 6, PrevLogTerm = 5, Entries = [6]`. S3's index 6 has term 4, not 5. It replies `XTerm = 4, XIndex = 3`.
3. S1 has entries from term 4; its last one is at index 4. It sets `nextIndex[S3] = 5` and sends `PrevLogIndex = 4, PrevLogTerm = 4, Entries = [5, 5, 6]`.
4. S3's index 4 has term 4: the check passes. At index 5 it holds term 4 but the leader's entry is term 5, a conflict, so it truncates indices 5 and 6 and appends the three new entries. Its log is now `1 1 4 4 5 5 6`, identical to S1's.
5. S1 sets `matchIndex[S3] = 7`, `nextIndex[S3] = 8`.

Three round trips instead of four, and the gap closes regardless of how many stale entries S3 had. The two term 4 entries S3 discarded were never committed; the next chapter explains how Raft guarantees that.
