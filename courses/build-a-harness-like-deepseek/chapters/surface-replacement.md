# Surface replacement: swapping old messages for a summary

With a safe cut, the harness has a range of old messages to shorten. The plan is to replace them with a short summary. But the record is an append-only log: no event may change or disappear. If the summary takes the place of messages 1 to 3, where do messages 1 to 3 go?

## Two kinds of notebook

Think of a detective who keeps two notebooks. The case file holds every statement, word for word, in the order it came. The pocket notebook holds what the detective needs today. When the pocket notebook is full, the detective writes one page that sums up last week and tears out last week's pages. The case file does not change.

In the harness, the case file is the record, and the pocket notebook is the list of messages the model sees. That list is called the **surface**: the ordered sequence numbers of the message events that the next request is built from. The comparison differs in one way: nothing is torn out. The summary is a new event, and its data says which range of the surface it replaces.

```inkling
title "Record and surface after one summary"
layout compare
columns "Record", "Surface"
row "System prompt": yes, yes
row "Messages 1-3": yes, no
row "Summary message": yes, yes
row "Messages 4-7": yes, yes
steps auto
```

## Appending a replacement

Until now, every message event joined the surface at its end. A replacement is a second way. In mini-dsh, `session.append()` in `src/session.ts` learns one option:

```ts
append(type: string, data: unknown, intent?: { surfaceOp: 'append' | { op: 'replace'; startSeq: number; endSeq: number } }) {
  const seq = this.log.length
  this.log.push({ type, seq, time: Date.now(), data })
  const op = intent?.surfaceOp
  if (op === 'append') this.surface.push(seq)
  else if (op !== undefined) {
    const i = this.surface.indexOf(op.startSeq)
    const j = this.surface.indexOf(op.endSeq)
    this.surface.splice(i, j - i + 1, seq)
  }
}
```

The history the model gets is derived from `surface`, not from the whole log. Then `src/compaction.ts` runs the change as four appends:

```ts
const id = randomUUID()
session.append('compaction/start', { compactionId: id })
const summary = await summarize(session, start, end)
session.append('compaction/summary', { compactionId: id, summary, shadowedSeqs })
session.append('user/message', checkpoint(summary), { surfaceOp: { op: 'replace', startSeq: start, endSeq: end } })
session.append('compaction/end', { compactionId: id })
```

`summarize()` sends one request: the system prompt, messages 1 to 3, and a final user message that asks for a structured summary. That request starts with the same bytes as the last step, so it gets a prefix cache hit.

Trace the range from the safe cut. The surface is `[0, 1, 2, 3, 4, 5, 6, 7]`, and messages 1 to 3 cost 2,150 tokens.

1. Append `compaction/start` as seq 8. It is log-only, so the surface does not change.
2. Call the model. It returns a summary of 250 tokens, which is smaller than 2,150.
3. Append `compaction/summary` as seq 9. It records the summary and the replaced seqs 1, 2 and 3.
4. Append the summary as a `user/message`, seq 10, with a replace of 1 to 3. The surface becomes `[0, 10, 4, 5, 6, 7]`.
5. Append `compaction/end` as seq 11. The record now has 12 events, and none of the first 8 changed.

The next request is 1,900 tokens smaller. The start event comes first and the end event last. If the program stops between them, a start without an end shows that the work did not finish.

> **Key idea:** Surface replacement appends a summary event that takes the place of a range in the surface, while the record keeps every original event.

## How dsh does it

```inkling
title "The compaction service and its parts"
layout mindmap
- ctx.compaction
  - compaction-basic
  - command-compact
  - ctx.tokenMeter
  - ctx.llm
steps auto
```

`packages/compaction/compaction` defines the service `ctx.compaction`. `packages/compaction/compaction-basic` provides it, and `command-compact` lets a person ask for it. `compactSurfaceRegion()` in `compaction-basic/src/region.ts` (line 173) appends `compaction/start` (line 210), then the summary (line 491). It then appends the `user/message` with `surfaceOp: { op: 'replace', startSeq, endSeq }` (lines 506-509), and `compaction/end` last (line 237). Line 418 refuses a summary that is not smaller than the range. `summarizer.ts` puts the instruction as the final user message (line 32) to keep the cached start. It wraps the summary in `<compacted-summary>` tags (line 188). The replace operation is defined in `packages/core/session/src/types.ts` (lines 463-472).

## What you have now

The harness can now make the surface smaller while the record keeps every fact, and it does this before a step when the meter crosses the threshold. But the meter is an estimate, and a guess can be wrong. What does the harness do when the provider itself rejects a request as too large?
