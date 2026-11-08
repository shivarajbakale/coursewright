# Block assembler: joining pieces into whole blocks

A stream chunk is one small piece of a reply, tied to its block by an index. The record and the agent loop do not want ten pieces. They want two whole blocks: the text "Let me count." and one tool call with complete arguments. Which part of the program joins the pieces, and what does it do when the stream ends in a strange way?

## Pigeonholes for the post

Think of a clerk in a block of flats who sorts the post into pigeonholes by flat number. Each item goes into the hole for its number, in the order it arrives. When the post is sorted, each hole holds the post for one flat. Here the flat number is the index, and each pigeonhole is one block that is still being built. The picture differs in one way: a letter arrives whole, but a delta is a strip of a letter. The clerk tapes the strips together, and a `block-end` piece is a sealed copy of the whole letter that replaces the taped strips.

## The smallest assembler

mini-dsh keeps the assembler in `src/llm.ts`. It has one method that takes the next piece and one method that returns the finished blocks.

```ts
type Partial = { blockType: string; text: string; id?: string; name?: string; args: string; block?: ContentBlock }

export class BlockAssembler {
  private partials = new Map<number, Partial>()
  private order: number[] = []
  usage?: { inputTokens: number; outputTokens: number }
  private reason?: FinishReason

  push(chunk: StreamChunk): void {
    switch (chunk.type) {
      case 'block-start': this.ensure(chunk.index, chunk.blockType); return
      case 'text-delta':
      case 'reasoning-delta': {
        const p = this.ensure(chunk.index, chunk.type === 'text-delta' ? 'text' : 'reasoning')
        if (!p.block) p.text += chunk.text
        return
      }
      case 'tool-call-delta': {
        const p = this.ensure(chunk.index, 'tool-call')
        if (p.block) return
        p.id = chunk.id
        if (chunk.name) p.name = chunk.name
        p.args += chunk.argumentsDelta
        return
      }
      case 'block-end': { const p = this.ensure(chunk.index, chunk.block.type); p.block ??= chunk.block; return }
      case 'usage': this.usage = chunk.usage; return
      case 'finish': this.reason = chunk.reason; return
    }
  }

  get finish(): FinishReason { return this.reason ?? { kind: 'stop' } }

  blocks(): ContentBlock[] {
    const all = this.order.map(i => this.assemble(this.partials.get(i)!))
    return this.finish.kind === 'max-tokens' ? all.filter(b => b.type !== 'tool-call') : all
  }

  private ensure(index: number, blockType: string): Partial {
    let p = this.partials.get(index)
    if (!p) { p = { blockType, text: '', args: '' }; this.partials.set(index, p); this.order.push(index) }
    return p
  }

  private assemble(p: Partial): ContentBlock {
    if (p.block) return p.block
    if (p.blockType === 'tool-call') return { type: 'tool-call', id: p.id ?? '', name: p.name ?? '', arguments: p.args }
    return { type: p.blockType as 'text' | 'reasoning', text: p.text }
  }
}
```

The assembler makes four decisions:

```inkling
title "Folding pieces into blocks"
layout down
pieces: box "Pieces in order"
holes: box "One partial per index"
closed: diamond "block-end arrived?"
sealed: box "Use the sealed block"
taped: box "Join the deltas"
cut: diamond "Finish is max-tokens?"
out: box "Whole blocks" green
pieces -> holes -> closed
closed -> sealed : "yes"
closed -> taped : "no"
sealed -> cut
taped -> cut
cut -> out : "drop tool calls"
step 1: pieces, holes "Each piece goes to the partial for its index"
step 2: closed, sealed, taped "A sealed block wins over the joined deltas"
step 3: cut "A cut-off reply loses its tool calls"
step 4: out "The loop gets complete blocks"
```

1. Keep blocks in first-seen order. `order` records each new index once, so block 0 comes before block 1.
2. Let the first `block-end` win. A delta that arrives after its block closed changes nothing, so a faulty stream cannot damage a finished block.
3. Build an open block from its deltas. A stream with no `block-end` still gives text.
4. Drop tool calls when the finish is `max-tokens`.

The last decision needs a reason. Suppose the model reaches its output limit while it writes `{"path":"no`. The arguments are cut off, and the program cannot know what the model meant. Running that call is unsafe, so the assembler drops it and keeps only the text.

Feed it the ten pieces for "Let me count." and `count_lines`. `blocks()` returns two blocks, `finish` is `tool-calls`, and `usage` holds 120 input and 18 output tokens.

> **Key idea:** A block assembler sorts pieces by index into blocks, keeps the first block-end, and drops tool calls from a reply cut at the token limit.

## How dsh does it

dsh has one shared `BlockAssembler` class in `packages/llm/llm/src/assembler.ts` (line 38), and the agent loop feeds it the same pieces it writes to the record. Deltas for a closed index are ignored (lines 65 and 71), and the first `block-end` wins (lines 79-82). The `max-tokens` rule is at lines 137-140. When no `finish` piece arrived, `finish` returns `{ kind: 'stop' }` (line 188).

## What you have now

You can now turn a stream of shared pieces into the blocks the loop stores and runs. The pieces still have to come from somewhere: some code must speak to DeepSeek and produce them. How does the loop ask for a stream without knowing which provider sends it?
