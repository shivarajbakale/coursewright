/**
 * The mock library: one ready course (Raft) and one still being built, plus a
 * few note pages. The same story the design canvas tells, so every screen has
 * something real-looking to draw with no backend.
 */
import type {
  Chapter,
  CourseDetail,
  CourseSummary,
  NotePage,
  Project,
  Source,
} from '@/api/types';

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

export const RAFT_ID = 'c-raft';
export const BUILDING_ID = 'c-rust';
export const BUILDING_JOB_ID = 'job-rust';

interface ChapterSeed {
  id: string;
  title: string;
  minutes: number;
  done: boolean;
  body: string;
  questions: { prompt: string; options: string[]; answer: number; explanation: string }[];
}

const md = (title: string, keyIdea: string, body: string) =>
  `# ${title}\n\n> **Key idea:** ${keyIdea}\n\n${body.trim()}\n`;

const MODULES: { id: string; title: string; summary: string; chapters: ChapterSeed[]; project?: { id: string; title: string } }[] = [
  {
    id: 'm1',
    title: 'Why consensus is hard',
    summary: 'Replicated state machines, failures you must survive, and why "just use a primary" breaks.',
    chapters: [
      {
        id: 'ch-1-1',
        title: 'Replicated state machines',
        minutes: 9,
        done: true,
        body: md(
          'Replicated state machines',
          'If every server applies the same commands in the same order, every server ends up in the same state.',
          `
## The idea

A **state machine** is anything whose next state depends only on its current state and an input: a key-value store, a bank ledger, a lock service. Run a copy on each of several servers, feed every copy the *same log of commands in the same order*, and the copies stay identical.

Consensus is the part that makes everyone agree on that log, even while servers crash and messages go missing.

## A tiny example

\`\`\`text
log:   [set x=1] [set y=2] [incr x]
state: x=2, y=2   (on every server that applied all three)
\`\`\`

## What can go wrong

- A server crashes halfway through applying the log.
- The network delays or drops messages, or delivers them twice.
- Two servers both believe they are in charge.

The rest of this course is about the last one.
`
        ),
        questions: [
          {
            prompt: 'Two replicas applied the same commands but ended in different states. What must be true?',
            options: ['They used different hardware', 'They applied the commands in a different order', 'One had more memory', 'The network was slow'],
            answer: 1,
            explanation: 'A deterministic state machine fed the same commands in the same order always ends in the same state. Order is the only thing left to differ.',
          },
        ],
      },
      {
        id: 'ch-1-2',
        title: 'Failure models and quorums',
        minutes: 11,
        done: true,
        body: md(
          'Failure models and quorums',
          'With 2f + 1 servers you can lose f and still have a majority, and any two majorities overlap.',
          `
## Crash faults, not lies

Raft assumes servers fail by **stopping** (crash-stop or crash-recover). It does not defend against servers that lie; that is Byzantine fault tolerance, a different and costlier family.

## Majorities

| Cluster size | Majority | Failures tolerated |
| --- | --- | --- |
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

Any two majorities of the same cluster share at least one server. That shared server is how a new leader learns what an old one committed.
`
        ),
        questions: [
          {
            prompt: 'How many failures can a 5-server Raft cluster tolerate and still make progress?',
            options: ['1', '2', '3', '4'],
            answer: 1,
            explanation: 'A majority of 5 is 3, so 2 servers can fail and the remaining 3 still form a majority.',
          },
        ],
      },
    ],
    project: { id: 'p-1', title: 'A replicated key-value store, no failures yet' },
  },
  {
    id: 'm2',
    title: 'Leader election',
    summary: 'Terms, votes and randomised timeouts: how a cluster picks exactly one leader.',
    chapters: [
      {
        id: 'ch-2-1',
        title: 'Terms and roles',
        minutes: 8,
        done: true,
        body: md(
          'Terms and roles',
          'Time in Raft is cut into numbered terms, and each term has at most one leader.',
          `
## Three roles

Every server is a **follower**, a **candidate** or the **leader**. Followers are passive. A follower that hears nothing from a leader for an *election timeout* becomes a candidate.

## Terms

A term is a logical clock. Every message carries the sender's term. A server that sees a higher term steps down to follower and adopts it; a message with a lower term is rejected.
`
        ),
        questions: [
          {
            prompt: 'A leader receives a message carrying a higher term. What does it do?',
            options: ['Ignores it', 'Steps down to follower and adopts the higher term', 'Starts a new election', 'Rejects the message'],
            answer: 1,
            explanation: 'A higher term means the leader is stale. It must update its term and become a follower.',
          },
        ],
      },
      {
        id: 'ch-2-2',
        title: 'Leader election',
        minutes: 12,
        done: false,
        body: md(
          'Leader election',
          'A candidate wins when a majority vote for it in the same term; randomised timeouts make split votes rare.',
          `
## Starting an election

1. Increment \`currentTerm\`, become a candidate, vote for yourself.
2. Send \`RequestVote\` to every other server.
3. Win with votes from a majority, lose if another leader appears, or time out and try again.

## One vote per term

Each server votes for at most one candidate per term, first come first served, so two candidates can't both collect a majority.

\`\`\`inkling
title "Winning a vote"
layout sequence
c: person "Candidate"
a: box "Server A"
b: box "Server B"
c -> a : "RequestVote, term 4"
a --> c : "yes"
c -> b : "RequestVote, term 4"
b --> c : "yes"
c -> c : "majority: leader"
steps auto
\`\`\`

## Randomised timeouts

If every follower timed out at the same instant, they'd all stand at once and split the vote forever. Raft picks each timeout at random (say 150–300 ms), so usually one server times out first and wins before anyone else stands.

\`\`\`go
timeout := 150*time.Millisecond + time.Duration(rand.Intn(150))*time.Millisecond
\`\`\`

## The up-to-date check

A voter refuses a candidate whose log is *less up to date* than its own: compare the last entry's term, then the log length. This is what keeps committed entries from being lost.
`
        ),
        questions: [
          {
            prompt: 'Why are election timeouts randomised?',
            options: ['To save bandwidth', 'To make split votes unlikely', 'To let slow servers catch up', 'To hide the leader'],
            answer: 1,
            explanation: 'Random timeouts spread candidates out in time, so one usually wins before others stand.',
          },
          {
            prompt: 'A voter has a log ending in term 5. A candidate’s log ends in term 4 but is longer. Does the voter grant its vote?',
            options: ['Yes, the log is longer', 'No, its last term is lower', 'Only if no other candidate asked', 'Only in term 6'],
            answer: 1,
            explanation: 'The last entry’s term is compared first. Term 4 < 5, so the candidate is less up to date, whatever its length.',
          },
        ],
      },
      {
        id: 'ch-2-3',
        title: 'Split votes and liveness',
        minutes: 7,
        done: false,
        body: md(
          'Split votes and liveness',
          'Safety never depends on timing; only progress does.',
          `
## When nobody wins

If two candidates split the vote, both time out and start a new term. Randomness makes repeated splits exponentially unlikely.

## The timing requirement

\`broadcastTime ≪ electionTimeout ≪ MTBF\`

Heartbeats must arrive well inside the timeout, and servers must fail far less often than elections take.
`
        ),
        questions: [],
      },
    ],
    project: { id: 'p-2', title: 'Leader election that survives partitions' },
  },
  {
    id: 'm3',
    title: 'Log replication',
    summary: 'AppendEntries, the log matching property and when an entry is committed.',
    chapters: [
      {
        id: 'ch-3-1',
        title: 'AppendEntries',
        minutes: 13,
        done: false,
        body: md(
          'AppendEntries',
          'The leader replicates its log with one RPC that doubles as the heartbeat.',
          `
## The RPC

\`\`\`text
AppendEntries(term, leaderId, prevLogIndex, prevLogTerm, entries[], leaderCommit)
\`\`\`

A follower accepts only if its log has an entry at \`prevLogIndex\` whose term is \`prevLogTerm\`. Otherwise it refuses, and the leader backs up \`nextIndex\` and retries.

## Log matching

If two logs have an entry with the same index and term, the logs are identical up to that entry. The consistency check above keeps this true by induction.
`
        ),
        questions: [
          {
            prompt: 'A follower rejects AppendEntries. What does the leader do?',
            options: ['Steps down', 'Decrements nextIndex for that follower and retries', 'Deletes its own entries', 'Waits for the next term'],
            answer: 1,
            explanation: 'The leader walks nextIndex back until the logs match, then overwrites the follower’s conflicting suffix.',
          },
        ],
      },
      {
        id: 'ch-3-2',
        title: 'Commitment',
        minutes: 10,
        done: false,
        body: md(
          'Commitment',
          'An entry is committed once the leader has stored it on a majority, and only entries from the current term are counted that way.',
          `
## The rule

The leader advances \`commitIndex\` to N when a majority have \`matchIndex ≥ N\` **and** \`log[N].term == currentTerm\`.

## Why the current-term restriction

An entry from an older term can be on a majority and still be overwritten by a later leader (Figure 8 in the paper). Committing a current-term entry commits everything before it indirectly.
`
        ),
        questions: [],
      },
    ],
    project: { id: 'p-3', title: 'Full log replication with a linearizable KV' },
  },
];

const CONCEPTS = [
  { id: 'k-rsm', name: 'Replicated state machine', summary: 'Same commands, same order, same state.' },
  { id: 'k-quorum', name: 'Quorum', summary: 'Any two majorities overlap.' },
  { id: 'k-term', name: 'Term', summary: 'Logical clock; at most one leader per term.' },
  { id: 'k-election', name: 'Leader election', summary: 'Majority vote within one term.' },
  { id: 'k-timeout', name: 'Randomised timeout', summary: 'Spreads candidates out in time.' },
  { id: 'k-append', name: 'AppendEntries', summary: 'Replication and heartbeat in one RPC.' },
  { id: 'k-commit', name: 'Commitment', summary: 'Stored on a majority, current term.' },
];

const FLOW_ELECTION = `title Leader election in Raft

a "Server A" state follower
b "Server B" state follower
c "Server C" state follower

a -> b
a -> c

# Every server starts as a follower, waiting to hear from a leader.
pause "Each one has picked a random election timeout between 150 and 300 ms."

# A's timeout fires first, so A starts term 2 and votes for itself.
a : candidate

# A asks both others for their vote in term 2.
together
  new v1 at a
  new v2 at a
together
  v1 -> b  "RequestVote, term 2"
  v2 -> c  "RequestVote, term 2"

# Neither has voted in term 2, and A's log is up to date, so both say yes.
together
  v1 -> a  "vote granted"
  v2 -> a  "vote granted"
remove v1
remove v2

# Three of three votes is a majority: A is the leader for term 2.
a : leader
pause "One vote per server per term means no other candidate can also reach a majority."
`;

function chapterList() {
  return MODULES.flatMap((m) => m.chapters.map((c) => ({ m, c })));
}

export function buildChapter(id: string): Chapter | null {
  const all = chapterList();
  const i = all.findIndex((x) => x.c.id === id);
  if (i < 0) return null;
  const { m, c } = all[i];
  const prev = all[i - 1]?.c;
  const next = all[i + 1]?.c;
  return {
    id: c.id,
    courseId: RAFT_ID,
    courseTitle: 'Distributed Systems: consensus with Raft',
    moduleId: m.id,
    moduleTitle: m.title,
    position: m.chapters.indexOf(c) + 1,
    title: c.title,
    markdown: c.body,
    readingMinutes: c.minutes,
    questions: c.questions.map((q, qi) => ({
      id: `${c.id}-q${qi}`,
      ...q,
      conceptIds: [],
      lastAttempt: null,
    })),
    diagrams:
      c.id === 'ch-2-2'
        ? [{ id: 'd-election', kind: 'flow', title: 'An election, step by step', source: FLOW_ELECTION }]
        : c.id === 'ch-3-1'
          ? [
              {
                id: 'd-append',
                kind: 'mermaid',
                title: 'AppendEntries consistency check',
                source:
                  'sequenceDiagram\n  participant L as Leader\n  participant F as Follower\n  L->>F: AppendEntries(prevIndex=7, prevTerm=3)\n  F-->>L: false (no entry 7 in term 3)\n  L->>F: AppendEntries(prevIndex=6, prevTerm=3)\n  F-->>L: true',
              },
            ]
          : [],
    prev: prev ? { id: prev.id, title: prev.title } : null,
    next: next ? { id: next.id, title: next.title } : null,
    startedAt: c.done ? ago(3000) : null,
    finishedAt: c.done ? ago(2000) : null,
  };
}

export const doneChapters = new Set(chapterList().filter((x) => x.c.done).map((x) => x.c.id));

export function raftSummary(): CourseSummary {
  const total = chapterList().length;
  return {
    id: RAFT_ID,
    title: 'Distributed Systems: consensus with Raft',
    topic: 'Raft consensus',
    status: 'ready',
    colour: 'lime',
    icon: '🛰️',
    createdAt: ago(60 * 24 * 9),
    moduleCount: MODULES.length,
    chapterCount: total,
    projectCount: MODULES.filter((m) => m.project).length,
    chaptersDone: doneChapters.size,
    jobId: null,
    lastOpenedChapterId: 'ch-2-2',
    outlineReady: false,
  };
}

export function raftDetail(): CourseDetail {
  return {
    ...raftSummary(),
    summary:
      'Build a working mental model of Raft: why consensus is hard, how a leader is elected, and how the log is replicated and committed. Every module ends in a Go project.',
    brief: {
      topic: 'Raft consensus',
      answers: [
        { question: 'What do you already know?', answer: ['I know networking and have used etcd'] },
        { question: 'What is the goal?', answer: ['Implement Raft myself'] },
      ],
      level: 'Intermediate',
      goal: 'Implement Raft from the paper',
      pace: '4 hours a week',
    },
    modules: MODULES.map((m, mi) => ({
      id: m.id,
      position: mi + 1,
      title: m.title,
      summary: m.summary,
      chapters: m.chapters.map((c, ci) => ({
        id: c.id,
        position: ci + 1,
        title: c.title,
        readingMinutes: c.minutes,
        done: doneChapters.has(c.id),
      })),
      project: m.project
        ? { id: m.project.id, title: m.project.title, milestonesDone: mi === 0 ? 3 : mi === 1 ? 1 : 0, milestonesTotal: 3 }
        : null,
    })),
    concepts: CONCEPTS,
    edges: [
      { from: 'k-rsm', to: 'k-quorum' },
      { from: 'k-quorum', to: 'k-election' },
      { from: 'k-term', to: 'k-election' },
      { from: 'k-timeout', to: 'k-election' },
      { from: 'k-election', to: 'k-append' },
      { from: 'k-append', to: 'k-commit' },
    ],
    weakSpots: [
      { conceptId: 'k-commit', name: 'Commitment', wrong: 3 },
      { conceptId: 'k-timeout', name: 'Randomised timeout', wrong: 2 },
    ],
  };
}

export function buildingSummary(): CourseSummary {
  return {
    id: BUILDING_ID,
    title: 'Rust ownership and borrowing',
    topic: 'Rust ownership',
    status: 'building',
    colour: 'orange',
    icon: '🦀',
    createdAt: ago(4),
    moduleCount: 0,
    chapterCount: 0,
    projectCount: 0,
    chaptersDone: 0,
    jobId: BUILDING_JOB_ID,
    lastOpenedChapterId: null,
    outlineReady: false,
  };
}

export function buildProject(id: string): Project | null {
  const mi = MODULES.findIndex((m) => m.project?.id === id);
  if (mi < 0) return null;
  const m = MODULES[mi];
  return {
    id,
    courseId: RAFT_ID,
    courseTitle: 'Distributed Systems: consensus with Raft',
    moduleId: m.id,
    moduleTitle: m.title,
    title: m.project!.title,
    brief: `Build it in Go, one milestone at a time. Each milestone has a command that tells you when you're done.\n\nYou'll use what **${m.title}** taught: ${m.summary.toLowerCase()}`,
    starter: [
      { path: 'raft/raft.go', note: 'Your Raft peer. Start here.' },
      { path: 'raft/rpc.go', note: 'RequestVote and AppendEntries argument structs.' },
      { path: 'raft/raft_test.go', note: 'The tests the milestones run. Read, don’t edit.' },
      { path: 'labrpc/', note: 'A simulated network that drops and delays messages.' },
    ],
    hints: [
      'Hold one mutex for all of a peer’s state. Fine-grained locking can come later.',
      'Reset the election timer only when you grant a vote or hear from the current leader.',
      'Never hold the lock while sending an RPC.',
    ],
    rubric: [
      { criterion: 'Exactly one leader per term under a stable network', chapterId: 'ch-2-2' },
      { criterion: 'A new leader is elected within 5 seconds of a failure', chapterId: 'ch-2-3' },
      { criterion: 'Votes respect the up-to-date check', chapterId: 'ch-2-2' },
    ],
    milestones: [
      { id: `${id}-ms1`, position: 1, title: 'Elect a leader', body: 'Implement RequestVote and the election timer.', checkCmd: 'go test -run 3A/initial', doneAt: mi <= 1 ? ago(900) : null },
      { id: `${id}-ms2`, position: 2, title: 'Re-elect after failure', body: 'Disconnect the leader; a new one must take over.', checkCmd: 'go test -run 3A/reelection', doneAt: mi === 0 ? ago(800) : null },
      { id: `${id}-ms3`, position: 3, title: 'Many elections', body: 'Survive repeated partitions without two leaders.', checkCmd: 'go test -run 3A/many', doneAt: mi === 0 ? ago(700) : null },
    ],
    submissions:
      mi === 1
        ? [
            {
              id: 'sub-1',
              projectId: id,
              milestoneId: `${id}-ms1`,
              repoUrl: 'https://github.com/you/raft-go',
              focus: 'election timer',
              status: 'done',
              jobId: 'job-review-1',
              createdAt: ago(600),
              error: null,
              findings: [
                { kind: 'pass', title: 'One vote per term', body: '`votedFor` is reset only when the term advances. Correct.', chapterId: 'ch-2-2' },
                { kind: 'fix', title: 'Timer reset on every AppendEntries', body: 'You reset the election timer even when the request has a stale term. A deposed leader can keep a follower from ever standing.', chapterId: 'ch-2-3' },
                { kind: 'idea', title: 'Pre-vote', body: 'A pre-vote round stops a partitioned server from bumping terms when it rejoins.', chapterId: null },
              ],
            },
          ]
        : [],
  };
}

export const NOTES: NotePage[] = [
  {
    id: 'n-raft',
    parentId: null,
    position: 0,
    title: 'Raft',
    icon: '🛰️',
    cover: null,
    properties: {},
    courseId: RAFT_ID,
    chapterId: null,
    updatedAt: ago(30),
    markdown: '# What I want out of this\n\nImplement Raft in Go and actually understand Figure 8.\n\n- [x] Module 1\n- [ ] Module 2\n- [ ] Module 3\n',
    backlinks: [],
  },
  {
    id: 'n-election',
    parentId: 'n-raft',
    position: 0,
    title: 'Leader election, my words',
    icon: '🗳️',
    cover: null,
    properties: {},
    courseId: RAFT_ID,
    chapterId: 'ch-2-2',
    updatedAt: ago(12),
    markdown:
      '> **Key idea:** a candidate wins with a majority in one term.\n\nThe random timeout is the whole trick: it turns a symmetric problem into an asymmetric one.\n\n## Questions\n\n- Why compare the last *term* before the length?\n',
    backlinks: [{ id: 'n-raft', title: 'Raft', icon: '🛰️' }],
  },
  {
    id: 'n-fig8',
    parentId: 'n-raft',
    position: 1,
    title: 'Figure 8 confusion',
    icon: '🤔',
    cover: null,
    properties: {},
    courseId: RAFT_ID,
    chapterId: 'ch-3-2',
    updatedAt: ago(200),
    markdown: 'Old-term entries on a majority can still be overwritten. Only count current-term entries.\n',
    backlinks: [],
  },
  {
    id: 'n-reading',
    parentId: null,
    position: 1,
    title: 'Reading list',
    icon: '📚',
    cover: null,
    properties: {},
    courseId: null,
    chapterId: null,
    updatedAt: ago(2000),
    markdown: '- In Search of an Understandable Consensus Algorithm (Ongaro, Ousterhout)\n- Designing Data-Intensive Applications, ch. 9\n',
    backlinks: [],
  },
];

export const SOURCES: Source[] = [
  ...chapterList().map(({ c }) => ({
    id: `s-${c.id}`,
    kind: 'chapter' as const,
    title: c.title,
    uri: null,
    courseId: RAFT_ID,
    status: 'indexed' as const,
    chunkCount: 3 + (c.body.length % 5),
    error: null,
    updatedAt: ago(2000),
  })),
  ...NOTES.map((n) => ({
    id: `s-${n.id}`,
    kind: 'note' as const,
    title: n.title,
    uri: null,
    courseId: n.courseId,
    status: 'indexed' as const,
    chunkCount: 1,
    error: null,
    updatedAt: n.updatedAt,
  })),
  {
    id: 's-paper',
    kind: 'url',
    title: 'In Search of an Understandable Consensus Algorithm',
    uri: 'https://raft.github.io/raft.pdf',
    courseId: RAFT_ID,
    status: 'indexed',
    chunkCount: 41,
    error: null,
    updatedAt: ago(5000),
  },
];
