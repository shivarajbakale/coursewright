# Elections and timeouts

Raft is a strong-leader algorithm: only the leader accepts client commands, and log entries only ever flow from leader to followers. That makes everything else simpler, but it means the cluster spends its life asking one question over and over: is there a working leader, and if not, who should it be? This chapter walks through how an election starts, how votes are cast, and how a winner keeps everyone else in line.

## Heartbeats and the election timeout

A leader proves it is alive by sending AppendEntries RPCs to every follower. When it has no new entries to send, it sends empty ones, called **heartbeats**, at a regular interval (tens of milliseconds is typical).

Every follower runs an **election timer**. Each time it receives a valid AppendEntries from the current leader, or grants a vote to a candidate, it resets the timer. If the timer reaches the **election timeout** without either happening, the follower assumes there is no viable leader and starts an election.

The follower cannot know *why* it stopped hearing from the leader. The leader may have crashed, it may be partitioned away, or it may just be slow. Raft does not need to know. Starting an election when the old leader is still alive is safe, because the new leader will be in a higher term and the old one will step down the moment it hears about it.

## Becoming a candidate

When the timer fires, the follower:

1. Increments `currentTerm`.
2. Transitions to candidate.
3. Votes for itself (`votedFor = self`).
4. Persists `currentTerm` and `votedFor`.
5. Resets its election timer.
6. Sends RequestVote RPCs in parallel to every other server.

It then waits for one of three outcomes:

- **It wins**: votes from a majority of the full cluster (including its own) arrive. It becomes leader and immediately sends heartbeats to every server to establish authority and stop new elections.
- **Another server wins**: it receives an AppendEntries from a leader whose term is at least its own `currentTerm`. It recognises that leader as legitimate and returns to follower. (If the AppendEntries carries a smaller term, it rejects it and remains a candidate.)
- **Nobody wins**: its election timer fires again with no majority. It starts a new election in the next term. The next chapter is about making this case rare.

## Granting a vote

The receiver's side is short, but every line matters:

```go
func (rf *Raft) RequestVote(args *RequestVoteArgs, reply *RequestVoteReply) {
    rf.mu.Lock()
    defer rf.mu.Unlock()

    if args.Term > rf.currentTerm {
        rf.currentTerm = args.Term
        rf.votedFor = -1          // new term, no vote cast yet
        rf.role = Follower
        rf.persist()
    }
    reply.Term = rf.currentTerm

    if args.Term < rf.currentTerm {
        reply.VoteGranted = false // stale candidate
        return
    }

    canVote := rf.votedFor == -1 || rf.votedFor == args.CandidateId
    if canVote && rf.candidateLogIsUpToDate(args.LastLogIndex, args.LastLogTerm) {
        rf.votedFor = args.CandidateId
        rf.persist()              // must hit disk before we reply
        rf.resetElectionTimer()
        reply.VoteGranted = true
    }
}
```

Three details deserve attention.

**First-come-first-served.** A server grants at most one vote per term, to whichever eligible candidate asks first. Re-granting to the *same* candidate (`votedFor == CandidateId`) is allowed, because the candidate may resend after a lost reply.

**Persist before replying.** If the vote lived only in memory, a crash and restart would let the server vote again in the same term, potentially for a different candidate. That is the bug that produces two leaders.

**Reset the timer only on a granted vote.** If a follower reset its timer on every RequestVote, a server with a hopelessly stale log could keep everyone else from timing out and starting elections they could win. The up-to-date check (`candidateLogIsUpToDate`) is the subject of Chapter 6; for now, treat it as a filter that rejects candidates missing entries the voter has.

> **Key idea:** Each server casts at most one vote per term and records it durably before answering, and a candidate needs votes from a majority of the cluster. Since any two majorities overlap, two candidates can never both win the same term. This property is called Election Safety.

## The candidate's side

Counting votes is simple, but a correct implementation has to handle replies that arrive late:

```go
func (rf *Raft) startElection() {
    rf.mu.Lock()
    rf.currentTerm++
    rf.role = Candidate
    rf.votedFor = rf.me
    rf.persist()
    rf.resetElectionTimer()
    term := rf.currentTerm
    args := RequestVoteArgs{term, rf.me, rf.lastLogIndex(), rf.lastLogTerm()}
    rf.mu.Unlock()

    votes := 1
    for peer := range rf.peers {
        if peer == rf.me { continue }
        go func(p int) {
            var reply RequestVoteReply
            if !rf.sendRequestVote(p, &args, &reply) { return }
            rf.mu.Lock()
            defer rf.mu.Unlock()
            if reply.Term > rf.currentTerm {
                rf.becomeFollower(reply.Term)
                return
            }
            // Ignore replies from an election we are no longer running.
            if rf.role != Candidate || rf.currentTerm != term { return }
            if reply.VoteGranted {
                votes++
                if votes > len(rf.peers)/2 {
                    rf.becomeLeader() // init nextIndex/matchIndex, send heartbeats now
                }
            }
        }(peer)
    }
}
```

The check `rf.currentTerm != term` is the one most often forgotten. Without it, a vote granted for term 4 that arrives after the candidate has moved on to term 5 would be counted toward the term 5 election.

## Worked example: five servers, one timeout

Five servers, S1 to S5, are all followers in term 1. The term 1 leader has just crashed, so heartbeats stop. Each follower's election timer is counting down, each set to a different random value.

1. S1's timer fires first. S1 increments its term to 2, becomes a candidate, votes for itself and persists `currentTerm = 2, votedFor = S1`. Its vote count is 1.
2. S1 sends `RequestVote{Term: 2, CandidateId: 1, LastLogIndex, LastLogTerm}` to S2, S3, S4 and S5.
3. S2 receives it. Term 2 is greater than its term 1, so it adopts term 2 and clears its vote. S1's log is at least as up-to-date as its own, so it sets `votedFor = S1`, persists, resets its timer and replies `VoteGranted: true`. S3 does the same.
4. S1 now has 3 votes out of 5, a majority. It becomes leader for term 2.
5. S4's and S5's grants arrive a moment later. They change nothing; S1 has already won.
6. S1 immediately sends empty AppendEntries with `Term: 2` to all four followers. Each one resets its election timer, so none of them starts a competing election.

From that point on, S1's heartbeats keep resetting every follower's timer, and the cluster stays quiet until S1 fails. The diagram for this chapter animates exactly this sequence.
