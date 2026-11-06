# Streaming: receiving the reply a few words at a time

A model writes its reply one token at a time. Yet your `complete` function waits until the model has written every token, then hands you the whole reply at once. For a 400-token answer that can mean several seconds of a blank screen. The tokens exist well before the end. Can your program have them as they are made?

## Watching someone type

Compare two ways of getting a message from a friend. In one, they write a whole letter and post it; you see nothing until it lands. In the other, you watch the words appear in a chat window while they type. The total time is the same, but the second feels fast, because something happens straight away.

Streaming is the second way. You set `stream: true` in the request. The provider keeps the HTTP response open and sends the reply in small pieces as the model writes them. Your program can print each piece the moment it arrives.

The picture stops holding in one detail. Pieces do not come one keystroke at a time. They are usually a token or a few tokens, and the network may bunch several together or split one piece across two deliveries.

## The format on the wire

The pieces arrive as server-sent events: a simple text format where the server writes lines that start with `data: `, each followed by a blank line. For DeepSeek, each `data:` line holds a small JSON object. A short reply looks like this:

```text
data: {"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}

data: {"choices":[{"index":0,"delta":{"content":"The capital"}}]}

data: {"choices":[{"index":0,"delta":{"content":" is Paris."}}]}

data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

Each piece carries a `delta`, the part that is new since the last piece. Join the `content` of every delta and you get "The capital is Paris." The last JSON piece carries a `finish_reason` field, which the next lesson explains. The special line `data: [DONE]` means nothing more is coming.

Here is a function that reads that format and hands each piece of text to a callback.

```ts
// src/llm.ts (add beside complete)
export async function streamText(messages: Message[], onText: (t: string) => void) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' }, messages, stream: true }),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

  const decoder = new TextDecoder()
  let buffer = ''
  for await (const bytes of res.body) {
    buffer += decoder.decode(bytes, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // the last line may be incomplete: keep it for later
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue // blank lines and anything else
      const payload = line.slice('data: '.length)
      if (payload === '[DONE]') return
      const text = JSON.parse(payload).choices[0]?.delta?.content
      if (text) onText(text)
    }
  }
}
```

Call it with `await streamText(history, (t) => process.stdout.write(t))` and the answer appears word by word.

Walk through the one tricky line. The network delivers bytes in batches that ignore line endings. One batch might end in the middle of `data: {"choi`. If you parsed that, `JSON.parse` would throw. So you split on newlines and keep the last, possibly unfinished, line in `buffer`. The next batch completes it. Every full line is parsed exactly once.

Streaming does not make the model faster. The full reply takes the same time. What changes is the wait for the first words, which drops from the whole reply to a fraction of a second. You also see a long answer going wrong early, instead of after it is done.

> **Key idea:** Streaming means the provider sends the reply in small pieces over one open HTTP response, as server-sent events, so your program can show text while the model is still writing it.

**In DeepSeek Harness:** its DeepSeek code parses these events in `packages/llm/llm-deepseek/src/sse.ts`, then translates every provider's pieces into one shared set of piece types, which you will design in a later module.

## What you have now

You can call a model, keep its history, and show its reply as it arrives. That last piece carried a `finish_reason` of `"stop"`. A reply can end for more than one reason, and some endings mean the reply is not what it seems. What are those reasons?
