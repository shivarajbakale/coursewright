# Snapshots and log compaction

Everything so far assumes the log can grow forever. In a real system it cannot. A key-value store that processes ten thousand writes a second accumulates almost a billion log entries a day, most of which are long obsolete: if key `x` has been overwritten a million times, only the last write matters. An unbounded log also means a restarted server must replay the entire history to rebuild its state machine, and a brand-new server must be sent all of it. Raft needs a way to throw old entries away. The simplest and most common is **snapshotting**.

## What a snapshot contains

A snapshot captures the state machine's state at some log index, so that every entry up to and including that index can be discarded. Along with the state itself, the snapshot records two pieces of metadata:

- `lastIncludedIndex`: the index of the last entry the snapshot replaces.
- `lastIncludedTerm`: the term of that entry.

The metadata exists so the AppendEntries consistency check keeps working. The first entry after a snapshot still needs a `PrevLogIndex` and `PrevLogTerm`; those are now `lastIncludedIndex` and `lastIncludedTerm`. To support membership changes (next chapter), the snapshot also includes the latest cluster configuration as of `lastIncludedIndex`.

Each server snapshots **independently**, covering only entries that are already committed (and in practice, already applied). There is no coordination: committed entries are identical on every server, so each server's snapshot of them is equivalent. This keeps data flowing from leader to followers in the normal case and means compaction never needs to be agreed on.

```go
type Snapshot struct {
    LastIncludedIndex int
    LastIncludedTerm  int
    Config            []int  // cluster membership as of LastIncludedIndex
    State             []byte // serialized state machine, incl. client dedup table
}

// Called by the service once it has applied up to index and serialized its state.
func (rf *Raft) Snapshot(index int, state []byte) {
    rf.mu.Lock()
    defer rf.mu.Unlock()
    if index <= rf.lastIncludedIndex || index > rf.lastApplied {
        return // stale, or covers entries not yet applied
    }
    term := rf.termAt(index)
    rf.log = rf.entriesAfter(index)   // keep only the suffix
    rf.lastIncludedIndex = index
    rf.lastIncludedTerm = term
    rf.persistStateAndSnapshot(state) // write both atomically
}
```

Once the log is compacted, a server's log no longer starts at index 1. Every place that indexes into the log must now translate between *log indices* (global, ever-increasing) and *slice positions* (offset by `lastIncludedIndex`). Getting this translation right everywhere is the most common source of bugs in snapshotting code; wrap it in helper functions like `termAt(i)` and `entryAt(i)` and never index the slice directly.

## When to snapshot

The paper suggests snapshotting when the log reaches a fixed size in bytes. If the threshold is much larger than the expected snapshot size, the disk bandwidth spent writing snapshots stays small. Writing a snapshot can take a long time for a large state machine, so production systems use copy-on-write: Ongaro's LogCabin and many others fork the process or use persistent data structures so that client operations continue while a consistent image is written in the background.

## InstallSnapshot

Snapshots create one new situation. Suppose the leader has discarded everything up to index 1000, and a follower that was offline comes back with a log ending at index 400. The follower needs entry 401, but the leader no longer has it. Decrementing `nextIndex` will never find a match. The leader must instead send its snapshot, using a third RPC:

```go
type InstallSnapshotArgs struct {
    Term              int    // leader's term
    LeaderId          int
    LastIncludedIndex int    // snapshot replaces all entries up to and including this
    LastIncludedTerm  int    // term of LastIncludedIndex
    Offset            int    // byte offset of this chunk in the snapshot file
    Data              []byte // raw chunk
    Done              bool   // true if this is the last chunk
}

type InstallSnapshotReply struct {
    Term int // currentTerm, for the leader to update itself
}
```

The leader sends it whenever `nextIndex[i] <= lastIncludedIndex`. Large snapshots are sent in chunks; each chunk also counts as a heartbeat, so the follower resets its election timer while receiving it.

The follower's rules, from the paper's Figure 13:

1. Reply immediately if `Term < currentTerm`.
2. Create a new snapshot file if this is the first chunk (`Offset == 0`).
3. Write the data at the given offset.
4. If `Done` is false, reply and wait for more chunks.
5. Save the snapshot, discarding any existing or partial snapshot with a smaller index.
6. If the follower's log already has an entry at `LastIncludedIndex` with term `LastIncludedTerm`, keep the log entries *after* it and reply. The snapshot is a prefix of what it already has; throwing away later entries would lose data the leader may be counting on.
7. Otherwise, discard the entire log.
8. Reset the state machine from the snapshot contents, and load the snapshot's cluster configuration.

The follower should also set `commitIndex` and `lastApplied` to at least `LastIncludedIndex`, since everything in the snapshot was committed. And it must ignore a snapshot whose `LastIncludedIndex` is not newer than what it already has, which can happen with delayed, duplicated RPCs.

> **Key idea:** A snapshot replaces a committed prefix of the log with the state it produced, plus the index and term of the last entry it covers. Servers snapshot independently, and the leader sends its snapshot with InstallSnapshot only to a follower that needs entries the leader has already discarded.

## What belongs in the state machine snapshot

Everything that affects how future commands are applied. For a key-value store this means the key-value map, but also the client deduplication table described in the next chapter. If you snapshot the map but not the table, a server restored from a snapshot will happily re-execute a retried request it has already applied, breaking exactly-once semantics.

## Worked example: catching up a stale follower

A three-server cluster: leader S1 in term 7, followers S2 and S3. S1 has snapshotted through index 1000 (`lastIncludedTerm = 6`) and its log holds entries 1001 to 1040. S3 crashed long ago; its log ends at index 400 with no snapshot.

1. S3 restarts. S1's heartbeat to it uses `PrevLogIndex = 1040`; S3 rejects, reporting its log length as 400.
2. S1 sets `nextIndex[S3] = 401`. That is at or below `lastIncludedIndex = 1000`, so S1 cannot send entries. It sends `InstallSnapshot{Term: 7, LastIncludedIndex: 1000, LastIncludedTerm: 6, Offset: 0, Data: ..., Done: false}` and further chunks until `Done: true`.
3. S3 assembles the snapshot. Its log has no entry at index 1000, so it discards its whole log, loads the snapshot into its state machine, and sets `lastIncludedIndex = 1000`, `commitIndex = lastApplied = 1000`.
4. S1 sets `nextIndex[S3] = 1001`, `matchIndex[S3] = 1000`, and sends `AppendEntries{PrevLogIndex: 1000, PrevLogTerm: 6, Entries: 1001..1040}`. S3 checks its snapshot metadata, finds `lastIncludedTerm = 6`, accepts, and is fully caught up.

S3 never saw entries 401 to 1000 individually, and did not need to: their combined effect was in the snapshot.
