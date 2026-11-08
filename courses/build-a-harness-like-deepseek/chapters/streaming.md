# Streaming: the reply arrives in small pieces

A model writes its reply one token at a time, but a model API call returns one JSON reply only after the last token. A reply of 800 tokens can take many seconds. During that time your program shows nothing, and the person in front of it wonders if it froze. Can the program receive the tokens as the model writes them?

## A live text commentary

Think of a football match followed on a live text page. You do not wait for the final report. A new line appears every few minutes: "12 min: corner kick", "14 min: goal". At the end, a last line says "Full time" and gives the reason the match ended, such as the referee's whistle.

**Streaming** works the same way. You add `"stream": true` to the request body. The provider keeps the HTTP connection open and sends the reply as a series of small messages, each sent as soon as it is ready.

The format is **server-sent events**, a plain text format. Each message in it is an `event:` line and a `data:` line with JSON. An empty line ends each message. The comparison differs in one way: the commentary page writes in sentences, but each streamed message carries a few tokens, often less than a word.

## One streamed reply

Here is a full streamed reply to "Name the capital of France." Each pair of lines arrives separately:

```text
event: message_start
data: {"type":"message_start","message":{"id":"msg_02","usage":{"input_tokens":14,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"The capital"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" is Paris."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}

event: message_stop
data: {"type":"message_stop"}
```

1. Read `message_start`. The reply has begun, and the input took 14 tokens.
2. Read `content_block_start`. Block 0 of the content list is a text block.
3. Read each `content_block_delta`. Each one adds text to block 0, so the program can print "The capital", then " is Paris.".
4. Read `content_block_stop`. Block 0 is complete.
5. Read `message_delta`. It carries the **stop reason**: why the model stopped writing.
6. Read `message_stop`. Nothing follows it.

```inkling
title "The order of a streamed reply"
layout timeline
- 1: message_start
- 2: block 0 starts
- 3: text arrives in pieces
- 4: block 0 stops
- 5: the stop reason
- 6: message_stop
span 2..4 "one content block"
highlight 5
step 1: 1 "The reply begins"
step 2: 2 "A text block opens"
step 3: 3 "Text arrives a few tokens at a time"
step 4: 5 "The model says why it stopped"
step 5: 6 "The reply is complete"
```

The stop reason matters as much as the text. The value `end_turn` means the model finished its answer. The value `max_tokens` means the reply reached the `max_tokens` limit, so the text is cut off and probably incomplete. A later lesson adds one more value.

Here is a reader for the stream. It prints text as it arrives and returns the same `Reply` shape as `callModel`, with one new field:

```ts
// src/llm.ts: Reply gains stop_reason: string
export async function streamModel(messages: Message[], onText: (text: string) => void): Promise<Reply> {
  const response = await fetch(URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ model: 'deepseek-flash', max_tokens: 1024, system: SYSTEM, messages, stream: true }),
  })
  if (!response.ok || !response.body) throw new Error(`model call failed: ${response.status}`)
  const reply: Reply = { content: [{ type: 'text', text: '' }], stop_reason: '', usage: { input_tokens: 0, output_tokens: 0 } }
  let buffer = ''
  for await (const piece of response.body.pipeThrough(new TextDecoderStream())) {
    buffer += piece
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const line = frame.split('\n').find(l => l.startsWith('data: '))
      if (!line) continue
      const event = JSON.parse(line.slice(6))
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        reply.content[0].text += event.delta.text
        onText(event.delta.text)
      }
      if (event.type === 'message_delta') reply.stop_reason = event.delta.stop_reason
    }
  }
  return reply
}
```

A network packet can end in the middle of a message. Because of this, the reader keeps a `buffer`. It handles only complete messages, the ones that end with an empty line.

> **Key idea:** Streaming sends the reply as server-sent events while the model writes, and the stream ends with a stop reason.

DeepSeek Harness always streams. The file `packages/llm/llm-deepseek/src/serialize.ts` sets `stream: true` on every request (line 153), and `src/sse.ts` reads the server-sent events (line 13). The file `src/translate.ts` (lines 90-97) turns DeepSeek's stop reasons into its own names: `end_turn` becomes `stop` and `max_tokens` becomes `max-tokens`.

## What you have now

You can call a stateless model, send the whole conversation with roles, and read the reply as it streams, ending with a stop reason. So far the model can only write text. What if it needs a fact it cannot predict, such as the number of lines in a file on your computer?
