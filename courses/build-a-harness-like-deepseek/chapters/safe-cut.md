# Safe cut: choosing old history to shorten

With the token meter, the harness knows when the next request is above the threshold. Some of the history must then take less space. The newest messages hold the work in progress, so they must stay word for word. The oldest messages are the best to shorten. But where exactly does "old" end?

## Cutting a film reel

Think of a film editor who must make a reel shorter. The editor keeps the last scenes as they are and trims from the start. But the editor never cuts in the middle of a line of dialogue: a question without its answer makes no sense. So the editor moves the cut back to the nearest place where nobody is speaking.

In the harness, the reel is the list of messages the model sees, the last scenes are the recent messages that stay, and a line of dialogue is a tool call with its tool result. The comparison differs in one way: providers reject a request in which a tool call has no matching result. As you saw with the orphaned tool call, the history must stay valid, so a bad cut is not only ugly but an error.

## Walking back from the newest message

The rule has three parts:

1. Walk back from the newest message and add up token counts. Stop when the total reaches the amount to keep.
2. Move the cut further back while a tool call before it still waits for its result after it.
3. Never include the system prompt at position 0. Everything from position 1 to the message before the cut may be shortened.

How much to keep? The harness keeps 16% of the window that remains after the reply reserve. With the example numbers from the token meter, (10,000 − 1,000) × 0.16 = 1,440 tokens.

In mini-dsh, `src/compaction.ts`:

```ts
export function selectRange(nodes: Priced[], retainTokens: number): { start: number; end: number } | null {
  const first = nodes[0]?.message.role === 'system' ? 1 : 0
  let kept = 0
  let keepFrom = nodes.length
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    kept += nodes[i].tokens
    keepFrom = i
    if (kept >= retainTokens) break
  }
  while (keepFrom > first && !balancedBefore(nodes, keepFrom)) keepFrom -= 1
  if (keepFrom <= first) return null
  return { start: first, end: keepFrom - 1 }
}

function balancedBefore(nodes: Priced[], index: number): boolean {
  const open = new Set<string>()
  for (const { message } of nodes.slice(0, index)) {
    for (const block of message.content) {
      if (block.type === 'tool_use') open.add(block.id)
      if (block.type === 'tool_result') open.delete(block.tool_use_id)
    }
  }
  return open.size === 0
}
```

Trace eight messages with their token counts:

```inkling
title "Where the cut lands"
layout timeline
- 0: system prompt, 300
- 1: user asks, 100
- 2: read call, 50
- 3: read result, 2,000
- 4: bash call, 60
- 5: bash result, 900
- 6: read call, 40
- 7: read result, 600
span 1..3 "may be shortened"
span 4..7 "kept word for word"
steps auto
```

1. Add from the end: 600, then 640, then 1,540 at message 5. 1,540 is at least 1,440, so the cut is before message 5.
2. Check message 4. It is the bash call whose result is message 5, so a cut there splits a pair. Move the cut to before message 4.
3. Before message 4, every call has its result. The cut is safe.
4. The range is messages 1 to 3. Messages 4 to 7 stay, 1,600 tokens.

The rule can split a turn. In this trace, the range may end in the middle of the user's turn, and that is allowed. Only a call and its result must stay together.

> **Key idea:** A safe cut walks back from the newest message to keep a fixed amount and never separates a tool call from its result.

## How dsh does it

The rule is `selectCompactableRange()` in `packages/compaction/compaction-basic/src/region.ts` (lines 117-155). It skips a `system/message` at position 0 (line 131). It walks back adding each message's price from the token meter, then moves back until `toolPairingBalancedBefore()` returns true (lines 143-147). That check comes from `packages/compaction/compaction`. The amount to keep is `floor((W − reply) × 0.16)` (`config.ts`, lines 195-197). With dsh's default numbers this is 126,812 tokens. `docs/subsystems/compaction.md` says the boundaries "preserve tool-call/result pairing but not whole turns".

## What you have now

The harness can now choose a range of old messages that is safe to shorten. It still needs to put something shorter in their place, without losing the facts. As you saw with the append-only log, the record never changes an old fact. How can the model's view lose messages while the record keeps them all?
