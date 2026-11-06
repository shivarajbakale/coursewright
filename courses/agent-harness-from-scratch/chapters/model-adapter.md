# Model adapter: one interface over every provider's format

Stream chunks and the message assembler are provider-neutral. Two DeepSeek-shaped jobs are still scattered through the loop: turning your `Message` list into DeepSeek's request JSON, and turning DeepSeek's stream into chunks. To try a second provider you would edit the loop. To test the loop without a network you would have to fake DeepSeek's server. Where should those two jobs live, so the loop never has to know which provider it is talking to?

## A plug adapter for every socket

Think of a travel plug adapter. Your laptop charger has one plug. Each country has its own wall socket. You do not rewire the charger for each trip. You carry a small adapter whose one job is to fit your plug on one side and the local socket on the other.

In code, the plug is an **interface**: a TypeScript type that lists the methods an object must have, without saying how they work. Any object with those methods fits. Here the interface has exactly one method:

```ts
// src/llm.ts
export type ModelRequest = {
  model: string
  messages: Message[]
  tools: ToolSchema[]
  maxTokens?: number
}

export interface ModelAdapter {
  stream(request: ModelRequest): AsyncIterable<StreamChunk>
}
```

`stream` takes a request in your own types and gives back chunks, one at a time, as an async iterable you read with `for await`. Everything provider-specific happens inside: the URL, the headers, renaming `toolCallId` to `tool_call_id`, parsing server-sent events, and translating them into chunks.

```ts
export class DeepSeekAdapter implements ModelAdapter {
  async *stream(req: ModelRequest): AsyncIterable<StreamChunk> {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
                 Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: req.model, thinking: { type: 'disabled' }, messages: req.messages.map(toWire),
                             tools: req.tools.map(toWireTool), max_tokens: req.maxTokens, stream: true }),
    })
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
    const state: { finish?: FinishReason } = {}
    for await (const data of sseData(res.body!)) {          // yields each `data:` payload
      if (data === '[DONE]') { yield { type: 'finish', reason: state.finish ?? 'stop' }; return }
      yield* translate(JSON.parse(data), state)
    }
  }
}
```

`toWire` turns a `Message` into DeepSeek's shape (an assistant's `toolCalls` become `tool_calls` with `type: 'function'`). `toWireTool` wraps a `ToolSchema` the same way. `sseData` splits the body into lines and yields the text after each `data: `.

The plug picture stops holding in one place. A plug adapter passes electricity through unchanged. A model adapter translates, and translation can lose things. Two providers may describe the same reply differently, and the adapter must map both onto the same chunks without inventing or dropping meaning. That is why the chunk rules (usage before finish, raw argument strings) are written down: they are the promise every adapter keeps.

## What the loop looks like now

```ts
const assembler = new Assembler()
for await (const chunk of adapter.stream({ model, messages, tools })) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.text)
  assembler.push(chunk)
}
const { message, finish } = assembler.result()
```

The loop receives an `adapter` and never names DeepSeek. That also makes it testable. A fake adapter that replays fixed chunks fits the same interface:

```ts
export class ScriptedAdapter implements ModelAdapter {
  constructor(private replies: StreamChunk[][]) {}
  async *stream(): AsyncIterable<StreamChunk> { yield* this.replies.shift() ?? [] }
}
```

Give it two replies, first a `count_lines` tool call with `finish: 'tool-calls'`, then a text answer with `finish: 'stop'`, and you can test a whole two-step turn with no network and no API key.

> **Key idea:** A model adapter is an object with one method, `stream(request)`, that takes a request in your own types and returns stream chunks; it hides one provider's URL, request shape and stream format so the rest of the harness works with any provider.

**In DeepSeek Harness:** the interface is the abstract class `LlmAdapter` in `packages/llm/llm/src/index.ts`, whose only required method is `stream(options): AsyncIterable<StreamChunk>`. Its contract adds rules you will meet soon: errors carry a stable code, the adapter honours a stop signal, and an empty reply counts as an error. The DeepSeek adapter in `packages/llm/llm-deepseek` does not use the Chat Completions format shown here. It speaks an Anthropic-style Messages API (a `/messages` endpoint with `thinking` and `tool_use` content blocks), and `src/translate.ts` maps that stream onto the same chunks. The loop cannot tell the difference, which is the point.

## What you have now

The loop now talks to an interface: a model adapter turns your messages into one provider's request and its stream into chunks, which the assembler turns into a message for the event log. Some models stream a second kind of text alongside the answer: their working-out before they reply. Where should that go, so it is neither lost nor confused with the answer?
