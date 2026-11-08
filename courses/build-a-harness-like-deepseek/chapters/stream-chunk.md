# Stream chunk: one small piece of a streamed reply

With streaming, a reply arrives as a series of server-sent events. With a tool call, one reply can hold a sentence of text and then a request to run a function. DeepSeek gives its events its own names, and another provider uses different names. If the agent loop reads DeepSeek's event names directly, it must change for every provider. How can the loop read every reply the same way?

## Labelled boxes

Think of a bookcase that a shop sends in parts. Each parcel has a label in the same fixed words: "item 0, shelves, part 2". A last slip says "delivery complete". Any courier can carry the parcels, and the person at the door still knows what each one holds.

Here the parcels are the pieces of a reply. The item number says which part of the reply a piece belongs to, and the last slip is the stop reason. The picture differs in one way. A courier brings whole shelves, but a stream brings a part in thin slices, and the program must join the slices.

A reply's content is a list of blocks: a text block, a tool-call block, or a block of reasoning text. Reasoning text is the thinking the model writes before it answers. A **delta** is one slice of a block: only the new text since the previous slice.

## The seven piece types

mini-dsh defines one shared list of piece types in `src/llm.ts`. Code that talks to a provider converts that provider's events into these pieces, and the loop reads only these.

```ts
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; id: string; name: string; arguments: string }

export type FinishReason =
  | { kind: 'stop' } | { kind: 'tool-calls' } | { kind: 'max-tokens' }
  | { kind: 'aborted'; failure: { code: string; message: string } }
  | { kind: 'error'; failure: { code: string; message: string } }

export type StreamChunk =
  | { type: 'block-start'; index: number; blockType: ContentBlock['type'] }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: string; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: ContentBlock }
  | { type: 'usage'; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'finish'; reason: FinishReason }
```

Here is the reply "Let me count." followed by a call to `count_lines`, as ten pieces:

```ts
{ type: 'block-start', index: 0, blockType: 'text' }
{ type: 'text-delta', index: 0, text: 'Let me ' }
{ type: 'text-delta', index: 0, text: 'count.' }
{ type: 'block-end', index: 0, block: { type: 'text', text: 'Let me count.' } }
{ type: 'block-start', index: 1, blockType: 'tool-call' }
{ type: 'tool-call-delta', index: 1, id: 'call_1', name: 'count_lines', argumentsDelta: '{"path":' }
{ type: 'tool-call-delta', index: 1, id: 'call_1', argumentsDelta: '"notes.txt"}' }
{ type: 'block-end', index: 1, block: { type: 'tool-call', id: 'call_1', name: 'count_lines', arguments: '{"path":"notes.txt"}' } }
{ type: 'usage', usage: { inputTokens: 120, outputTokens: 18 } }
{ type: 'finish', reason: { kind: 'tool-calls' } }
```

```inkling
title "One reply as pieces"
steps auto
layout timeline
- 1: block-start 0
- 2: text-delta 0
- 3: block-end 0
- 4: block-start 1
- 5: tool-call-delta 1
- 6: block-end 1
- 7: usage
- 8: finish
span 1..3 "text block"
span 4..6 "tool-call block"
```

Read the pieces in order:

1. Match each piece to its block by `index`. Pieces 1 to 4 belong to block 0, the text block.
2. Join the text deltas. `'Let me '` and `'count.'` become `'Let me count.'`, the same text that `block-end` carries.
3. Keep the tool arguments as a string. The first slice, `{"path":`, is not valid JSON, so nothing parses it until the block ends.
4. Read the token counts from `usage`. It always comes before `finish`.
5. Stop at `finish`. Nothing comes after it, and `tool-calls` tells the loop to run a tool.

The finish names are the program's own, not the provider's. DeepSeek says `end_turn` and `tool_use`; the code that reads DeepSeek converts them to `stop` and `tool-calls`. Two kinds, `aborted` and `error`, carry a failure with a code. A failed request then ends the stream in the same shape as a good one.

> **Key idea:** A stream chunk is one piece of seven shared types, tied to its block by an index, so every provider's reply reads the same way.

## How dsh does it

The `StreamChunk` union is in `packages/llm/llm/src/types.ts` (line 496), with the same seven types. Its `FinishReason` kinds are `stop`, `tool-calls`, `max-tokens`, `aborted` and `error` (line 163). The file `docs/subsystems/llm-streaming.md` states the rules every provider must keep: `usage` before `finish`, nothing after `finish`, and tool arguments as raw JSON strings from start to end. dsh's `finish` can also carry extra data for the provider to read later.

## What you have now

You have one vocabulary for a streamed reply: blocks, their deltas, a usage count and a finish reason. It sits between the model's events and the agent loop. The loop still needs whole blocks to store in the record and to run tools from. What turns ten pieces back into two complete blocks?
