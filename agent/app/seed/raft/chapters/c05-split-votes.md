# Split votes and randomized timeouts

The previous chapter showed a tidy election: one server times out, asks for votes, and wins. Real clusters are not always so tidy. If several followers time out at nearly the same moment, they all become candidates in the same term, each votes for itself, and the votes can scatter so that nobody reaches a majority. This chapter explains why that happens, why it is harmless for safety but bad for availability, and the remarkably simple fix Raft uses.

## Anatomy of a split vote

Take a five-server cluster whose leader has just crashed. The four survivors all reset their timers at the last heartbeat. Suppose every one of them used exactly the same election timeout, say 200 ms. Then:

1. At t = 200 ms all four time out together. Each increments to term 2, votes for itself, and sends RequestVote to the others.
2. Each server has already voted (for itself) in term 2, so every RequestVote it receives for term 2 is refused.
3. Each candidate ends up with one vote. Nobody has three.
4. At t = 400 ms they all time out again, move to term 3, and repeat exactly the same pattern.

Safety is never at risk here. Each server still votes once per term, so no term can have two leaders. But the cluster is stuck without a leader, and with perfectly synchronized timers it could stay stuck forever. That is the FLP result in miniature: a deterministic protocol can be kept from deciding by an unlucky schedule.

Splits need not be all-way ties. With two candidates in a five-server cluster, S1 might collect votes from itself and S2 while S5 collects itself and S4. S3 votes for whichever request arrives first, so one of them gets three votes and wins. But if S3 is the crashed leader, both candidates finish with two votes, and the term ends with no leader.

## Randomized election timeouts

Raft's fix is to have each server choose its election timeout **randomly** from a fixed interval, and to choose a fresh random value each time the timer is reset. The paper suggests 150 to 300 ms.

```go
const (
    electionTimeoutMin = 150 * time.Millisecond
    electionTimeoutMax = 300 * time.Millisecond
    heartbeatInterval  = 50 * time.Millisecond
)

func randomElectionTimeout() time.Duration {
    spread := electionTimeoutMax - electionTimeoutMin
    return electionTimeoutMin + time.Duration(rand.Int63n(int64(spread)))
}

func (rf *Raft) resetElectionTimer() {
    rf.electionDeadline = time.Now().Add(randomElectionTimeout())
}
```

With timeouts spread across a 150 ms window, it is likely that one server times out noticeably earlier than the rest. That server becomes a candidate, sends RequestVote, and collects a majority before anyone else's timer fires. When the others receive its RequestVote they grant the vote and reset their timers, so they never become candidates at all.

If a split does happen, randomization also resolves it: each candidate picks a new random timeout for its retry, so the next round is unlikely to tie again. The Raft paper's experiments showed that with even 5 ms of randomness the median downtime after a leader crash was cut dramatically, and with a 150 to 300 ms range the cluster elected a leader in under 300 ms on average, rarely needing more than one or two rounds.

> **Key idea:** Split votes cannot break safety, only liveness. Randomizing each server's election timeout, and re-randomizing on every reset, makes it likely that one server times out alone and wins before others even start.

Ongaro notes that he first tried a ranking scheme, where each server had a priority and lower-ranked candidates deferred to higher-ranked ones. It had subtle availability problems (a lower-ranked server might need to time out and try again if a higher-ranked one failed mid-election), and randomization turned out to be simpler and more robust. That is a recurring theme in Raft's design: prefer the mechanism that is easiest to reason about.

## The timing requirement

Raft's safety never depends on timing, but its ability to elect and keep a leader does. The paper states the requirement as:

```
broadcastTime  <<  electionTimeout  <<  MTBF
```

- **broadcastTime** is the average time for a server to send RPCs to every other server in parallel and receive replies. This includes writing to stable storage, since RequestVote and AppendEntries handlers persist state before replying. Typically 0.5 to 20 ms.
- **electionTimeout** is the timeout described above, typically 10 to 500 ms.
- **MTBF** is the mean time between failures of a single server, typically months.

The left inequality has to hold by an order of magnitude so that leaders can send heartbeats often enough to keep followers from starting elections, and so that a candidate can complete a round of RequestVote before a competitor's timer fires. If the election timeout were close to the broadcast time, candidates would routinely time out mid-election and split votes would be the norm.

The right inequality keeps the system mostly available. When a leader crashes, the cluster is unavailable for roughly one election timeout. If timeouts are a few hundred milliseconds and servers fail every few months, that is a negligible fraction of the time. If you set the election timeout to ten seconds to be "safe", every leader crash costs ten seconds of downtime.

Heartbeat interval sits below the election timeout: it must be short enough that a follower receives several heartbeats per timeout, so that one lost packet does not trigger an election. A heartbeat every 50 ms with a minimum timeout of 150 ms gives three chances.

## Worked example: a split vote resolved

Five servers. S3 was leader in term 6 and has crashed. The remaining four pick random timeouts after S3's last heartbeat: S1 = 212 ms, S2 = 214 ms, S4 = 281 ms, S5 = 263 ms.

1. At 212 ms S1 times out, becomes candidate in term 7, and sends RequestVote. At 214 ms, before S1's request reaches it, S2 also times out and becomes a candidate in term 7.
2. S4 receives S1's request first and votes for S1. S5 receives S2's request first and votes for S2. S1 refuses S2 and S2 refuses S1; each has already voted for itself.
3. Tally: S1 has 2 (itself, S4); S2 has 2 (itself, S5). Neither has 3. Term 7 ends without a leader.
4. Each candidate re-randomizes: S1 picks 171 ms, S2 picks 288 ms. S4 and S5 reset their timers when they granted votes, to 240 ms and 199 ms.
5. S1 fires first, starting term 8. Its RequestVote reaches S2, S4 and S5 before any of their timers expire. All three see a higher term, adopt it, and grant (logs being equally up-to-date). S1 wins term 8 with 4 votes and sends heartbeats.

Total cost: one wasted term and about 170 ms of extra unavailability. Without randomness, step 4 could have reproduced step 1 indefinitely.
