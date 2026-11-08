# Reasoning block: the model's written thinking

The DeepSeek wire request so far always sends `thinking: { type: 'disabled' }`. With thinking on, the model writes its reasoning text first and then answers. DeepSeek streams that text with one extra string attached. The next request in the same conversation sends the history again, because the model is stateless. What must the program store so that the thinking goes back correctly?

## A sealed working sheet

Think of an exam where you hand in your rough working with your answer. The examiner stamps the working sheet with a seal. If you hand the sheet in again later, it must carry the same seal, and you cannot make a seal yourself.

Here the working sheet is the reasoning text, and the seal is a string that DeepSeek attaches. Handing it in again is the next request. The picture differs in one way. You can read an exam seal, but the program cannot read this string at all. It only keeps it and returns it.

A **reasoning block** is a content block that holds the model's written thinking. A **signature** is the string DeepSeek streams with a reasoning block. The program treats it as opaque: it stores and returns the string without reading it.

## Turning thinking on

mini-dsh still sends `thinking` on every request, as dsh does. Its value now comes from a reasoning effort. `GenerateOptions` in `src/llm.ts` gains one field, `reasoningEffort?: 'off' | 'low' | 'high' | 'max'`. In `toWire`, the fixed `thinking: { type: 'disabled' }` becomes two fields:

```ts
const effort = o.reasoningEffort ?? 'high'
// in the returned body, in place of thinking: { type: 'disabled' }:
thinking: { type: effort === 'off' ? 'disabled' : 'enabled' },
...(effort === 'off' ? {} : { output_config: { effort } }),
```

With effort `off`, the request sends `thinking: { type: 'disabled' }` and no `output_config`, as before. With `low`, `high` or `max`, it sends `thinking: { type: 'enabled' }` and `output_config: { effort }`. The default is `high`. dsh falls back to the same `high` when no effort is set and its settings do not disable thinking (`serialize.ts`, line 147).

With thinking enabled, the reply opens with a `thinking` block. Its pieces arrive as `thinking_delta` events with text and `signature_delta` events with slices of the signature:

```json
{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}
{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"The user wants a count."}}
{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig-abc"}}
{"type":"content_block_stop","index":0}
```

(`sig-abc` stands in for a real signature, which is a long string.)

## Keeping the signature beside the block

The shared reasoning block holds only text, so every provider can use it. The signature belongs to DeepSeek, so mini-dsh keeps it beside the blocks, on the `finish` piece:

```ts
export type ProviderState = { model: string; blocks: { signature?: string }[] }
// StreamChunk:  { type: 'finish'; reason: FinishReason; state?: ProviderState }
// Message:      { role: 'assistant'; content: ContentBlock[]; source?: { model: string; state?: ProviderState } }
```

In `translate`, three cases change:

```ts
// content_block_start with c.type === 'thinking':
blocks.set(e.index, { type: 'reasoning', text: '' }); signatures[e.index] = ''
// content_block_delta:
if (e.delta.type === 'thinking_delta') { yield { type: 'reasoning-delta', index: e.index, text: e.delta.thinking } }
if (e.delta.type === 'signature_delta') { signatures[e.index] += e.delta.signature }   // no piece for the loop
// message_stop:
yield { type: 'finish', reason, state: { model: options.model, blocks: [...blocks.keys()].map(i => signatures[i] ? { signature: signatures[i] } : {}) } }
```

The assembler keeps `chunk.state` from `finish`, and the loop stores it in the assistant message's `source`. On the next request, `assistantBlock` sends the pair back:

```ts
if (b.type === 'reasoning') {
  const signature = m.source?.model === o.model ? m.source.state?.blocks[i]?.signature : undefined
  return [{ type: 'thinking', thinking: b.text, ...(signature ? { signature } : {}) }]
}
```

```inkling
title "A signature goes out and comes back"
layout sequence
loop: box "mini-dsh"
ds: icon cloud "DeepSeek"
loop -> ds : "request 1, thinking on"
ds --> loop : "thinking text + signature"
loop -> loop : "store both in the record"
loop -> ds : "request 2: thinking + same signature"
ds --> loop : "answer"
steps auto
```

Follow one conversation through it:

1. Send request 1 with the default effort, so it carries `thinking: { type: 'enabled' }`. The reply streams "The user wants a count." with signature `sig-abc`, then a tool call.
2. Store the reply. Block 0 is the reasoning text, and `state.blocks[0]` holds `sig-abc`. The record keeps both.
3. Send request 2 with the same model. The assistant message goes out as `{ type: 'thinking', thinking: 'The user wants a count.', signature: 'sig-abc' }`.
4. Change the model and send again. The stored model differs, so the thinking text goes out without a signature.

The program never edits the thinking text or the signature. The dsh source does not say what DeepSeek checks in a signature. It sends the pair back exactly as it arrived, and only to the model that made it.

> **Key idea:** A reasoning block holds the model's thinking; its signature is stored beside it and returned unchanged, but only to the same model.

## How dsh does it

- The file `packages/llm/llm-deepseek/src/translate.ts` maps a `thinking` block to a shared `reasoning` block (line 51), `thinking_delta` to `reasoning-delta` (line 73), and adds `signature_delta` to stored data with no piece (lines 78-80).
- The file `replay.ts` builds `replayState` as `{ response: { kind: 'deepseek-messages', version: 1, model }, blocks }` (line 30). It returns the signatures only when the target model matches (line 63).
- The file `serialize.ts` writes `thinking` with its `signature` (lines 31-34).
- On every request, `serialize.ts` sets `thinking` to `disabled` when the effort is `off` and to `enabled` otherwise. It adds `output_config.effort` only when thinking is enabled (lines 147-156).
- The file `packages/llm/llm/src/assembler.ts` removes a block's stored entry when it drops that block (lines 141-149).

## What you have now

The record now holds each reasoning block with its signature, and every request sends the history back exactly as it was. Each request repeats the whole conversation, so most of its bytes are the same as the previous request. Can the provider reuse work for a start it has already read?
