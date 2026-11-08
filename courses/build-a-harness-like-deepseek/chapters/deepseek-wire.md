# The DeepSeek wire: the exact request DeepSeek expects

An adapter seam lets the loop call one `stream` method and read shared pieces. The DeepSeek adapter must fill that method in. It has two jobs: write a request in the exact shape DeepSeek accepts, and read DeepSeek's events back into pieces. What exactly does DeepSeek send and receive?

## Two forms for one parcel

Think of a parcel you send abroad. At home you write the address your way. The foreign post office needs its own form, with fields in its order and its words for each field. The parcel is the same; only the form changes.

Here the parcel is the conversation, and your own notes are the program's shared blocks. The foreign form is DeepSeek's format. The picture differs in one way. The post office never writes back on a form, but DeepSeek answers in its own format too, so the adapter converts in both directions.

The **wire format** is the exact shape of the bytes a provider sends and receives over the network. DeepSeek accepts a subset of the Anthropic Messages format at `https://api.deepseek.com/anthropic/v1/messages`.

```inkling
title "Same facts, two forms"
layout compare
columns "mini-dsh blocks", "DeepSeek wire"
row "Tool call": "tool-call, arguments string", "tool_use, input object"
row "Tool result": "role tool", "tool_result in a user message"
row "Stop names": "stop, tool-calls", "end_turn, tool_use"
row "Pieces": "text-delta", "content_block_delta"
step 1: tool-call "A tool call changes its name and its argument type"
step 2: tool-result "A tool result travels inside a user message"
step 3: stop-names "Stop reasons get the program's own names"
step 4: pieces "Each event becomes one shared piece"
```

## Writing the request

mini-dsh keeps the adapter in `src/deepseek.ts`. Until now, `Message` in `src/llm.ts` held DeepSeek's own blocks. It now holds the shared blocks, with three roles, and only the adapter knows DeepSeek's shape:

```ts
export type Message =
  | { role: 'user' | 'assistant'; content: ContentBlock[] }
  | { role: 'tool'; toolCallId: string; content: ContentBlock[]; isError?: boolean }
```

`toWire` converts one request:

```ts
function toWire(o: GenerateOptions) {
  const messages: { role: 'user' | 'assistant'; content: object[] }[] = []
  for (const m of o.messages) {
    const content = m.role === 'tool'
      ? [{ type: 'tool_result', tool_use_id: m.toolCallId, content: texts(m.content), ...(m.isError ? { is_error: true } : {}) }]
      : m.role === 'assistant' ? m.content.flatMap(assistantBlock) : texts(m.content)
    const role = m.role === 'tool' ? 'user' : m.role
    const last = messages.at(-1)
    if (last?.role === role) last.content.push(...content)
    else messages.push({ role, content })
  }
  return { model: o.model, max_tokens: o.maxTokens ?? 8192, stream: true, thinking: { type: 'disabled' },
    ...(o.system ? { system: o.system } : {}), messages, ...(o.tools ? { tools: o.tools } : {}) }
}

const texts = (blocks: ContentBlock[]) =>
  blocks.flatMap(b => b.type === 'text' && b.text ? [{ type: 'text', text: b.text }] : [])

const assistantBlock = (b: ContentBlock) =>
  b.type === 'text' ? [{ type: 'text', text: b.text }]
  : b.type === 'tool-call' ? [{ type: 'tool_use', id: b.id, name: b.name, input: JSON.parse(b.arguments || '{}') }]
  : []
```

Trace the `count_lines` history through it:

1. Convert the user question. It becomes `{ role: 'user', content: [{ type: 'text', ... }] }`.
2. Convert the assistant reply. The tool call becomes `tool_use`, and the string `'{"path":"notes.txt"}'` becomes the object `{ path: 'notes.txt' }`.
3. Convert the tool result. Its role becomes `user`, and its content becomes one `tool_result` block with `tool_use_id: 'call_1'`.
4. Merge neighbours with one role. Two tool results in a row join one user message, because the wire alternates user and assistant.

Look at the `thinking` field. mini-dsh sends it on every request and never leaves it out, as dsh does. This version always sends `thinking: { type: 'disabled' }`, which turns the model's written thinking off. The next lesson chooses `enabled` or `disabled` for each request.

## Reading the events

DeepSeek streams server-sent events. The event `message_start` carries input tokens. The events `content_block_start`, `content_block_delta` and `content_block_stop` open, grow and close one block at a wire index. The event `message_delta` carries `stop_reason` and output tokens. The event `message_stop` ends the reply. The function `translate` converts them:

```ts
async function* translate(events: AsyncIterable<any>): AsyncIterable<StreamChunk> {
  const blocks = new Map<number, ContentBlock>()
  const usage = { inputTokens: 0, outputTokens: 0 }
  let reason: FinishReason = { kind: 'stop' }
  for await (const e of events) {
    if (e.type === 'message_start') usage.inputTokens = e.message.usage?.input_tokens ?? 0
    if (e.type === 'content_block_start') {
      const c = e.content_block
      const block: ContentBlock = c.type === 'tool_use'
        ? { type: 'tool-call', id: c.id, name: c.name, arguments: '' } : { type: 'text', text: '' }
      blocks.set(e.index, block)
      yield { type: 'block-start', index: e.index, blockType: block.type }
      if (block.type === 'tool-call') yield { type: 'tool-call-delta', index: e.index, id: block.id, name: block.name, argumentsDelta: '' }
    }
    if (e.type === 'content_block_delta') {
      const block = blocks.get(e.index)!
      if (e.delta.type === 'text_delta' && block.type === 'text') {
        block.text += e.delta.text
        yield { type: 'text-delta', index: e.index, text: e.delta.text }
      }
      if (e.delta.type === 'input_json_delta' && block.type === 'tool-call') {
        block.arguments += e.delta.partial_json
        yield { type: 'tool-call-delta', index: e.index, id: block.id, argumentsDelta: e.delta.partial_json }
      }
    }
    if (e.type === 'content_block_stop') yield { type: 'block-end', index: e.index, block: { ...blocks.get(e.index)! } }
    if (e.type === 'message_delta') {
      if (e.delta.stop_reason) reason = e.delta.stop_reason === 'tool_use' ? { kind: 'tool-calls' }
        : e.delta.stop_reason === 'max_tokens' ? { kind: 'max-tokens' } : { kind: 'stop' }
      if (e.usage?.output_tokens !== undefined) usage.outputTokens = e.usage.output_tokens
    }
    if (e.type === 'message_stop') { yield { type: 'usage', usage }; yield { type: 'finish', reason }; return }
  }
  throw new Error('DeepSeek stream ended before message_stop')
}
```

`usage` and `finish` wait for `message_stop`, so usage always comes before finish. A stream that closes early throws, and the shared `stream` function turns that throw into a `finish` with kind `error`. The adapter itself sends the request:

```ts
registerAdapter('deepseek', {
  async *stream(options) {
    const response = await fetch('https://api.deepseek.com/anthropic/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream',
        'x-api-key': process.env.DEEPSEEK_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(toWire(options)),
    })
    if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${await response.text()}`)
    yield* translate(readEvents(response.body!))
  },
})
```

The function `readEvents` is the server-sent-event reader. It splits the body at blank lines and parses each `data:` line as JSON.

> **Key idea:** The DeepSeek wire is a subset of the Anthropic Messages format; the adapter writes it from shared blocks and reads its events into pieces.

## How dsh does it

- The file `packages/llm/llm-deepseek/src/wire-types.ts` (line 24) declares `WireRequest`, with `stream: true` and a required `thinking` field.
- The serializer in `serialize.ts` always sets `thinking` to `enabled` or `disabled` (line 155), so dsh never leaves the field out.
- The serializer sends a tool message as role `user` (line 125) and merges neighbours with one role (lines 126-128). It also refuses a history where a `tool_use` has no `tool_result` in the next user message (lines 131-146).
- The file `translate.ts` maps `end_turn` and `stop_sequence` to `stop` (line 92), and a reply with no blocks to the error code `EMPTY_RESPONSE` (line 149).
- The file `adapter.ts` sends the headers at lines 142-153.
- The file `config.ts` (line 116) holds the address `https://api.deepseek.com/anthropic`.

## What you have now

mini-dsh can now talk to DeepSeek through its adapter, with the loop unchanged. Every request sends `thinking: { type: 'disabled' }`. When thinking is enabled, DeepSeek streams that thinking with extra data, and later requests must carry it back. What is that data, and why must it return unchanged?
