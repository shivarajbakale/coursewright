# The election restriction

So far, any server can win an election as long as it collects a majority of votes. That is enough for Election Safety (one leader per term), but it is not enough for the replicated log to be correct. This chapter explains the problem, the one-line rule Raft adds to RequestVote to fix it, and how that rule gives the property that holds the whole algorithm together: Leader Completeness.

## The problem: a leader that is missing committed entries

In Raft, log entries flow in one direction only: from the leader to followers. A leader never deletes or overwrites entries in its own log (the **Leader Append-Only** property); instead, it forces followers' logs to match its own, deleting any follower entries that conflict.

That design is what keeps Raft simple, but it has a sharp consequence. Suppose an entry at index 5 was committed, meaning it was stored on a majority and some state machines may already have applied it. Now suppose a server that never received index 5 is elected leader. It will happily replicate its own, different, entry at index 5 to everyone, overwriting the committed one. Some state machines have already applied the old index 5; others will now apply the new one. The replicas have diverged, which is exactly what consensus exists to prevent.

Other consensus algorithms, including some Paxos variants and Viewstamped Replication, allow a leader to be elected without all committed entries and then have it fetch the missing ones from other servers during or after the election. Raft takes a simpler route: it makes it impossible to elect such a leader in the first place.

> **Key idea:** A voter refuses any candidate whose log is less up-to-date than its own. Because a committed entry sits on a majority, and a winner needs votes from a majority, at least one voter holds that entry and will block any candidate that lacks it. So every new leader already has every committed entry.

## What "up-to-date" means

The comparison uses the two log-summary fields that RequestVote carries, `LastLogIndex` and `LastLogTerm`. Raft defines it precisely:

1. If the last entries have **different terms**, the log whose last entry has the **later term** is more up-to-date.
2. If the last entries have the **same term**, the **longer** log is more up-to-date.

A candidate is acceptable if its log is *at least as* up-to-date as the voter's.

```go
func (rf *Raft) candidateLogIsUpToDate(candLastIndex, candLastTerm int) bool {
    myLastIndex := rf.lastLogIndex()
    myLastTerm := rf.lastLogTerm()
    if candLastTerm != myLastTerm {
        return candLastTerm > myLastTerm
    }
    return candLastIndex >= myLastIndex
}
```

Notice that term is compared *first*. A short log ending in term 5 beats a long log ending in term 3. This surprises people, so it is worth saying why. Log length alone tells you nothing about which entries are committed: a stale leader in term 3, isolated in a minority partition, can append hundreds of uncommitted entries that will never be committed. A log whose last entry is from term 5 must have been updated by the term 5 leader, and by the Log Matching Property (Chapter 7) it agrees with that leader's log up to that point. The last term is a much better signal of freshness than raw length.

## Why this gives Leader Completeness

The property Raft needs is:

**Leader Completeness**: if a log entry is committed in a given term, that entry will be present in the logs of the leaders for all higher-numbered terms.

Here is the intuition. Suppose entry `e` was committed by the leader of term T, so it is stored on some majority M1. Later, a candidate C wins an election for a term U > T, with votes from a majority M2. Because majorities overlap, at least one server V is in both M1 and M2. V stored `e` and also voted for C. V only votes for candidates whose log is at least as up-to-date as its own, so C's log is at least as up-to-date as V's. Either C's last term is greater than V's, in which case the leader that wrote C's last entry must itself have had `e` (applying the argument inductively to earlier leaders), and by Log Matching C has `e` too; or the last terms are equal and C's log is at least as long, in which case C's log contains everything V's does, including `e`.

The paper turns this into a full proof by contradiction, and Ongaro's thesis includes a machine-checked TLA+ specification. One subtlety is that the proof only works when "committed" is defined carefully. A leader must not consider an entry from an *earlier* term committed just because it is now on a majority; Chapter 8 walks through the scenario (Figure 8 in the paper) that shows why, and the extra rule that closes the gap.

Leader Completeness, together with Log Matching, then gives **State Machine Safety**: if a server has applied the entry at some index, no other server will ever apply a different entry for that index.

## Worked example: who can win?

Five servers have these logs, written as the term of each entry, index 1 first:

```
S1: 1 1 2 3 3
S2: 1 1 2 3
S3: 1 1 2
S4: 1 1 2 2 2 2
S5: 1 1
```

The entry at index 4 (term 3) is on only S1 and S2, two servers out of five, so it cannot have been committed. Assume the entry at index 3 (term 2) was committed by the term 2 leader; it is on S1, S2, S3 and S4. Which servers could win the next election?

Rank by (last term, last index): S1 = (3, 5), S2 = (3, 4), S4 = (2, 6), S3 = (2, 3), S5 = (1, 2).

- **S1** is at least as up-to-date as everyone. It can collect all five votes.
- **S2** beats S3, S4 and S5 (last term 3 beats 2 and 1), but loses to S1 (same term, shorter). With S3, S4, S5 and itself it has four votes. It can win.
- **S4** has the *longest* log, but its last term is 2. S1 and S2 refuse it. It can get S3, S5 and itself: exactly three, a majority. It can win.
- **S3** loses to S1, S2 and S4 (S4 has the same last term and is longer). It can get only S5 and itself. It cannot win.
- **S5** loses to everyone. It cannot win.

Check against the committed entry at index 3: every server that can win (S1, S2, S4) has it. S4 winning would mean the term 3 entries on S1 and S2 get overwritten, but those were never committed, so no client was ever told they succeeded. The restriction protects exactly what it must, and nothing more.
