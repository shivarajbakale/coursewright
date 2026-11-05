# Terms, roles and the two RPCs

Raft's specification fits on a single page (Figure 2 of the paper). That page is dense, but it is built from a small vocabulary: terms, three server roles, two RPCs, and a short list of state each server keeps. This chapter introduces each piece so that the rest of the course can use them freely.

## Terms: a logical clock

Raft divides time into **terms**, numbered with consecutive integers. Each term begins with an election. If a candidate wins, it serves as leader for the rest of that term. If the election ends in a split vote, the term ends with no leader and a new term (and new election) begins shortly after.

Raft guarantees **at most one leader per term**. That is why the term number is so useful: it acts as a logical clock that lets servers detect stale information without any synchronized physical time.

Each server stores a `currentTerm`. Terms are exchanged in every RPC, and three rules govern them:

1. If a server sees a term larger than its own, in any request *or* response, it updates `currentTerm` to that value and immediately becomes a follower.
2. If a server receives a request carrying a term *smaller* than its own, it rejects the request and replies with its current term, so the sender learns it is stale.
3. `currentTerm` only ever increases.

Rule 1 is how a deposed leader finds out it has been replaced: the first message it exchanges with a server in the newer term carries a higher number, and it steps down on the spot.

## The three roles

At any moment each server is in exactly one of three roles:

- **Follower**: passive. It responds to requests from leaders and candidates but issues none of its own. All servers start as followers. If a client contacts a follower, the follower redirects it to the leader.
- **Candidate**: a server trying to become leader. It got here because it heard nothing from a leader for an *election timeout*.
- **Leader**: handles all client requests, appends them to its log, and replicates the log to everyone else. It sends periodic heartbeats to keep followers from starting elections.

The transitions are few. A follower whose election timer fires becomes a candidate. A candidate that receives votes from a majority becomes leader. A candidate whose own timer fires again (because the election split) starts a fresh election in a new term. A candidate or leader that discovers a higher term, or a candidate that hears from a legitimate leader of its own term, becomes a follower. There is no transition from leader directly to candidate.

> **Key idea:** The term number is Raft's logical clock. Every RPC carries one, any server that sees a higher term immediately becomes a follower, and because each server votes at most once per term there can be at most one leader per term.

## The two RPCs

Basic Raft needs only two RPCs. (A third, InstallSnapshot, appears in Module 4.)

```go
// Sent by candidates to gather votes.
type RequestVoteArgs struct {
    Term         int // candidate's term
    CandidateId  int // candidate requesting the vote
    LastLogIndex int // index of candidate's last log entry
    LastLogTerm  int // term of candidate's last log entry
}

type RequestVoteReply struct {
    Term        int  // receiver's currentTerm, so a stale candidate can update itself
    VoteGranted bool // true means the candidate received this vote
}

// Sent by the leader to replicate entries; with no entries it is a heartbeat.
type AppendEntriesArgs struct {
    Term         int        // leader's term
    LeaderId     int        // so followers can redirect clients
    PrevLogIndex int        // index of the entry immediately before the new ones
    PrevLogTerm  int        // term of that entry
    Entries      []LogEntry // entries to store (empty for heartbeat)
    LeaderCommit int        // leader's commitIndex
}

type AppendEntriesReply struct {
    Term    int  // receiver's currentTerm
    Success bool // true if follower contained an entry matching PrevLogIndex and PrevLogTerm
}

type LogEntry struct {
    Term    int         // term in which the leader created the entry
    Command interface{} // opaque command for the state machine
}
```

Notice that the log entry stores the term in which it was created. Together with its position (index), the pair `(index, term)` uniquely identifies an entry across the whole cluster, a fact the log replication chapters lean on heavily. The `LastLogIndex`/`LastLogTerm` fields in RequestVote and the `PrevLogIndex`/`PrevLogTerm` fields in AppendEntries will each get a chapter of their own.

RPCs are idempotent by design. If a reply is lost, the sender simply retries, and processing the same RequestVote or AppendEntries twice has the same effect as processing it once.

## Persistent and volatile state

Each server keeps this state:

| State | Kept on | Persisted? | Meaning |
| --- | --- | --- | --- |
| `currentTerm` | all | yes | latest term this server has seen, starts at 0 |
| `votedFor` | all | yes | candidate that received this server's vote in `currentTerm`, or null |
| `log[]` | all | yes | the log entries, first index is 1 |
| `commitIndex` | all | no | highest index known to be committed |
| `lastApplied` | all | no | highest index applied to the state machine |
| `nextIndex[]` | leader | no | for each follower, the next log index to send it |
| `matchIndex[]` | leader | no | for each follower, highest index known to be replicated there |

The persistent three must be written to stable storage **before** the server responds to any RPC. The reasons are sharp. If `votedFor` were lost in a crash, a server could restart and vote for a second candidate in the same term, allowing two leaders. If `currentTerm` were lost, a server could go back in time and accept messages from a stale leader. If log entries were lost, a server could acknowledge an entry, help commit it, then forget it, and a committed entry might disappear.

The volatile state is safe to lose. `commitIndex` can be relearned from the leader. `lastApplied` resets to 0 on restart and the state machine is rebuilt by replaying the log (or loading a snapshot). The leader reinitialises `nextIndex` and `matchIndex` after every election.

## Worked example: a stale leader steps down

S2 was leader in term 5, then got partitioned. The rest of the cluster elected S4 in term 6. The partition heals, and S2, still believing it is leader, sends a heartbeat to S3:

1. S2 sends `AppendEntries{Term: 5, LeaderId: 2, ...}` to S3.
2. S3 has `currentTerm = 6`. Since 5 < 6, S3 rejects it and replies `{Term: 6, Success: false}`.
3. S2 sees reply term 6 > 5. It sets `currentTerm = 6`, clears `votedFor`, persists both, and becomes a follower.
4. The next heartbeat from S4 (term 6) reaches S2, which accepts S4 as leader and resets its election timer.

No clocks were compared and no one had to declare S2 dead. The term number alone did the work.
