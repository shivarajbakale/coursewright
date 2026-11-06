# Reasoning block: the model's working-out kept apart

Every request so far has sent `thinking: { type: 'disabled' }`. Change it to `{ type: 'enabled' }`, which is also what `deepseek-flash` does when the option is left out, and the stream changes. Before any answer text arrives, the deltas carry a different field, `reasoning_content`, full of sentences like "The user wants the line count. I should call count_lines first." Your model adapter ignores that field, so it vanishes. Should it? It is useful to see, but it is not the answer. Where does it belong?

## Working in the margin

Think of a maths exam where you may do rough work in the margin. The examiner can look at it to see how you got there. But the answer is what you write in the answer box, and nobody would mark the margin as the answer.

Some models, often called thinking models, do the same. They generate a stretch of working-out first, then the answer and any tool calls. Providers stream the two separately so you can treat them differently. Your program keeps them apart all the way through: a separate chunk type, a separate field in the finished message, a separate place on screen.

Add one shape to the chunk union:

```ts
// src/types.ts
export type StreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call-delta'; index: number; id?: string; name?: string; argumentsDelta: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'finish'; reason: FinishReason }

export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  reasoning?: string          // working-out, never part of the answer
  toolCalls?: ToolCall[]
  toolCallId?: string
}
```

The adapter's `translate` gains one line, and the assembler gains a second text tray:

```ts
// translate, in src/llm.ts
if (delta.reasoning_content) yield { type: 'reasoning-delta', text: delta.reasoning_content }

// Assembler.push, in src/assembler.ts
if (chunk.type === 'reasoning-delta') this.reasoning += chunk.text
// Assembler.result: if (this.reasoning) message.reasoning = this.reasoning
```

## Following one reply through

The stream for "How many lines in notes.txt?" sends three `reasoning_content` deltas ("The user wants", " a line count.", " Call count_lines."), then a tool call, then `finish_reason: 'tool_calls'`. The adapter yields three `reasoning-delta` chunks, two `tool-call-delta` chunks, `usage` and `finish`. The assembler returns:

```ts
{ role: 'assistant', content: '',
  reasoning: 'The user wants a line count. Call count_lines.',
  toolCalls: [{ id: 'call_1', name: 'count_lines', arguments: '{"path":"notes.txt"}' }] }
```

Three places use the split. The terminal prints reasoning in a dim colour while it streams, so the person sees the model is working but can tell it apart from the reply. The event log stores the whole message, reasoning included, as `assistant/message`, so you can later read why the model chose a tool. And anything that reads "the answer", such as the final text you print or return, reads `content` only.

The margin picture stops holding at one question: does the working-out go back to the model on the next request? On paper, nobody hands your margin notes back to you. With models, providers differ. DeepSeek is strict: when a request carries tools, the `reasoning_content` of every earlier assistant message must be sent back, or the API answers with a 400 error. That is why earlier lessons switched thinking off. Other providers ignore old reasoning or reject it, so check your provider's documentation. The design that keeps both options open: always log the reasoning, and let the adapter decide when `toWire` includes it. The log keeps the fact; the provider-specific rule stays in the provider-specific code.

For DeepSeek with thinking on, that rule is one line in `toWire` for assistant messages:

```ts
if (m.role === 'assistant' && m.reasoning) wire.reasoning_content = m.reasoning
```

> **Key idea:** A reasoning block is the model's working-out, streamed as its own kind of chunk and kept in its own field, so it can be shown and logged without ever being mistaken for the answer, and each adapter decides whether to send it back.

**In DeepSeek Harness:** reasoning is a separate content block type (`ReasoningBlock` in `packages/llm/llm/src/types.ts`), alongside text and tool calls, streamed as `reasoning-delta` chunks. The DeepSeek adapter's `packages/llm/llm-deepseek/src/translate.ts` maps the provider's `thinking_delta` to `reasoning-delta`. It also keeps the provider's `signature` for that thinking as adapter-private replay state, sent back on later requests. The rest of the harness never reads it.

## What you have now

Replies now carry three separable things, reasoning, answer text and tool calls, each assembled from its own chunks and logged together, with the model adapter deciding what goes back. Everything so far assumes the request succeeds. What should the harness do when the provider answers with "too many requests" or the connection drops halfway?
