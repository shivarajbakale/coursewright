# Message assembler: joining pieces into one finished reply

A streamed reply now arrives as stream chunks: text deltas, tool-call pieces, usage, finish. The terminal can print each text delta as it lands. But the event log needs one finished assistant message, and the agent loop needs whole tool calls with complete arguments it can parse and run. Something has to collect the pieces and say, at the end, "here is the message". What does that code have to get right?

## Collecting pieces into finished parts

Think of a jigsaw puzzle where pieces arrive by post, a few at a time, from several puzzles at once. Each piece says which puzzle it belongs to. You keep one tray per puzzle and drop each piece into its tray. When the last envelope arrives, each tray holds a finished picture.

Text is one tray: append each `text-delta`. Each tool call is another tray, keyed by its `index`: the first piece usually brings the `id` and `name`, and every piece adds to the arguments string. Usage is noted. `finish` closes the reply.

```ts
// src/assembler.ts
import type { FinishReason, Message, StreamChunk, ToolCall } from './types.ts'

export class Assembler {
  private text = ''
  private calls = new Map<number, ToolCall>()   // index -> call; Map keeps first-seen order
  private finish: FinishReason | undefined

  push(chunk: StreamChunk): void {
    if (chunk.type === 'text-delta') this.text += chunk.text
    if (chunk.type === 'tool-call-delta') {
      const call = this.calls.get(chunk.index) ?? { id: '', name: '', arguments: '' }
      if (chunk.id) call.id = chunk.id
      if (chunk.name) call.name = chunk.name
      call.arguments += chunk.argumentsDelta
      this.calls.set(chunk.index, call)
    }
    if (chunk.type === 'finish') this.finish = chunk.reason
  }

  result(): { message: Message; finish: FinishReason } {
    const finish = this.finish ?? 'stop'
    const toolCalls = finish === 'max-tokens' ? [] : [...this.calls.values()]
    const message: Message = { role: 'assistant', content: this.text }
    if (toolCalls.length) message.toolCalls = toolCalls
    return { message, finish }
  }
}
```

The puzzle picture stops holding at the end. A jigsaw with a missing piece is still mostly a picture. A tool call with missing arguments is worse than nothing, which brings us to the one rule here that is not bookkeeping.

## The max-tokens rule

When the reply hits the output limit, the stop reason is `max-tokens` and generation was cut off mid-stream. Text cut short is still readable. A tool call cut short is not. Its arguments might end at `{"path":"no`. That string does not parse, or worse, it parses into something other than what the model meant: imagine a path cut down to a parent folder in a delete command. So when the finish reason is `max-tokens`, the assembler drops every tool call and keeps the text. The model gets another step to try again with a shorter reply.

Two smaller rules. If the stream ends with no `finish` chunk at all, treat it as `stop`. Tool calls come out in the order their index was first seen, which is the order the model asked for them, because a JavaScript `Map` keeps insertion order.

Now walk through a reply. Feed in these six chunks:

```text
text-delta       "Let me count."
tool-call-delta  index 0, id 'call_1', name 'count_lines', '{"pa'
tool-call-delta  index 0, 'th":"notes.txt"}'
tool-call-delta  index 1, id 'call_2', name 'count_lines', '{"path":"todo.txt"}'
usage            inputTokens 120, outputTokens 31
finish           'tool-calls'
```

`result()` returns the text `"Let me count."` and two tool calls: `call_1` with arguments `{"path":"notes.txt"}` and `call_2` with `{"path":"todo.txt"}`. If the last chunk had said `max-tokens` instead, the message would hold only the text.

In the loop, the step becomes: push every chunk into a fresh `Assembler`, call `result()`, append the message as `assistant/message`, and only then run its tool calls. The log then records the exact message the tools follow.

> **Key idea:** A message assembler joins stream chunks into one finished assistant message: text deltas are concatenated, tool-call pieces are gathered by index into whole calls, and a reply cut off by max-tokens loses its tool calls because a truncated call is unsafe to run.

**In DeepSeek Harness:** the assembler is `packages/llm/llm/src/assembler.ts`. It keeps a map from index to partial block, concatenates text, and appends argument pieces. When a `block-end` chunk arrives the finished block it carries is authoritative, and "first close wins". Its max-tokens rule drops tool calls, described in its own comment as calls "that cannot be executed safely". With no finish chunk, the reason is `stop`. The agent loop appends the assembled message as `assistant/message` before any tool runs.

## What you have now

Chunks in, one finished message out, with tool calls rebuilt from interleaved pieces and dropped when the reply was truncated. Together with stream chunks, the loop now has a provider-neutral path from stream to event log. The only DeepSeek-specific code left is the part that sends the request and translates its stream. How do you put that behind one interface, so swapping providers means swapping one object?
