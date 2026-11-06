# Stream chunk: one small typed piece of a streamed reply

The agent loop reads DeepSeek's streaming format directly. It splits server-sent events into `data: {...}` lines, digs into `choices[0].delta.content` and `delta.tool_calls`, and watches for `finish_reason`. Now suppose you want to try another provider. Its stream uses different event names and nests text, tool calls and stop reasons in different places. If every part of your program reads DeepSeek's JSON, every part has to change. What should the rest of `minidsh` read instead?

## A standard box for every kind of cargo

Think of shipping containers. Goods from any factory in any country go into boxes of a few standard sizes. Cranes, ships and trucks are built for the boxes, not for the goods, so a port handles a container from anywhere the same way. The work of packing happens once, at the factory.

Do the same with a streamed reply. Define a few kinds of small piece that cover everything a streamed reply can contain, and translate each provider's stream into them at one place. The rest of the program only ever sees these pieces:

```ts
// src/types.ts
export type FinishReason = 'stop' | 'tool-calls' | 'max-tokens'

export type StreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-delta'; index: number; id?: string; name?: string; argumentsDelta: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'finish'; reason: FinishReason }
```

A **union** type like this says "a chunk is exactly one of these shapes", and the `type` field tells you which. TypeScript then checks that code handling chunks deals with each shape correctly.

Each kind has a reason. `text-delta` is a few more characters of the answer. `tool-call-delta` is a piece of a tool call. The model may ask for two tools at once and their pieces can arrive interleaved, so `index` says which call a piece belongs to. `id` and `name` usually come with the first piece of each call. The arguments stay a raw string fragment such as `{"pa`, because half a JSON object cannot be parsed yet. `usage` reports token counts. `finish` carries the stop reason, renamed into one vocabulary: DeepSeek's `length` becomes `max-tokens`, and `tool_calls` becomes `tool-calls`.

The container picture stops holding in one way: containers can arrive in any order, but chunks cannot. Two rules keep the order meaningful. `usage` comes before `finish`, and nothing comes after `finish`. Code reading chunks can then treat `finish` as "this reply is complete".

## Translating one DeepSeek stream

```ts
// src/llm.ts
const FINISH: Record<string, FinishReason> = { stop: 'stop', length: 'max-tokens', tool_calls: 'tool-calls' }

export function* translate(json: any, state: { finish?: FinishReason }): Generator<StreamChunk> {
  const choice = json.choices?.[0]
  const delta = choice?.delta ?? {}
  if (delta.content) yield { type: 'text-delta', text: delta.content }
  for (const call of delta.tool_calls ?? []) {
    yield { type: 'tool-call-delta', index: call.index, id: call.id,
            name: call.function?.name, argumentsDelta: call.function?.arguments ?? '' }
  }
  if (json.usage) yield { type: 'usage', inputTokens: json.usage.prompt_tokens,
                          outputTokens: json.usage.completion_tokens }
  if (choice?.finish_reason) state.finish = FINISH[choice.finish_reason]
}
// on the line `data: [DONE]`:  yield { type: 'finish', reason: state.finish ?? 'stop' }
```

Notice that `translate` does not emit `finish` when it sees `finish_reason`. DeepSeek may send usage with or after that line, so the translator remembers the reason and emits `finish` only at `[DONE]`. That is how the "usage before finish" rule is kept.

Trace a short tool-calling reply. Four `data:` lines arrive: the first carries `tool_calls` with `index 0`, `id 'call_1'`, `name 'count_lines'` and arguments `{"pa`; the second carries `th":"notes.txt"}`; the third has `finish_reason: 'tool_calls'` and a usage object; the fourth is `[DONE]`. Out come four chunks: two `tool-call-delta` chunks for index 0, one `usage`, and one `finish` with reason `tool-calls`.

> **Key idea:** A stream chunk is one piece of a streamed reply in a small provider-neutral union (text, tool-call piece, usage, finish); each provider's stream is translated into chunks in one place, and the rest of the program reads only chunks.

**In DeepSeek Harness:** the union is `StreamChunk` in `packages/llm/llm/src/types.ts`. It has `text-delta`, `tool-call-delta {index, id, name?, argumentsDelta}`, `usage` and `finish`, plus `block-start` and `block-end` chunks that mark where each piece of content begins and ends. Its rules match these: usage before finish, nothing after finish, tool arguments kept as raw JSON strings, and indexes in first-seen order. Its stop reasons are `stop`, `tool-calls` and `max-tokens`, plus `aborted` and `error` for replies that did not end normally.

## What you have now

The streaming reply is now a sequence of typed chunks that carry the same stop reasons and tool-call pieces whichever provider sent them. A list of chunks is not a message, though. How do you join a stream of chunks, including tool calls split across many pieces, into one finished assistant message for the event log?
