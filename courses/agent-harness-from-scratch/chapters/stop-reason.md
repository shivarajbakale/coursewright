# Stop reason: the label saying why the model stopped

The last piece of a streamed reply carried `"finish_reason": "stop"`. Non-streamed replies have the same field, beside `message` in `choices[0]`. When the text ends, how does your program know whether the model said everything it meant to say?

## A note on the parcel

Picture a courier who leaves a slip with every delivery. "Complete." Or: "Partial: the rest did not fit in the van." Or: "Signature needed before we can continue." The parcel alone does not tell you which. A half-delivered sofa and a small chair look alike from the doorway. The slip does.

```inkling
title "The stop reason label on a reply"
layout compare
columns "Text looks like", "Label says"
row "Complete answer": "ordinary text", "stop"
row "Cut off at limit": "ordinary text", "length"
row "Asking for a tool": "no answer at all", "tool_calls"
steps auto
```

Every model reply ends with such a slip. For DeepSeek it is the `finish_reason` field, and the three values you will meet are:

- `stop`: the model finished its answer by itself. The text is complete.
- `length`: the reply hit a token limit and was cut off mid-thought. The limit is either one you set with `max_tokens` in the request, or the end of the context window.
- `tool_calls`: the model did not write an answer. Instead it asks your program to run one of your functions for it. The next module is all about this.

The provider documents a couple of rarer values too. Treat any value you do not recognise as a failure, not as a finished answer.

The picture stops holding in one place. A courier knows what is missing. With `length`, nobody knows how much more the model would have written; the reply simply stops.

## Seeing a cut-off reply

Make the limit tiny so you can watch it happen. Add `max_tokens: 5` to the request body, ask "Describe Paris.", and print both fields.

```inkling
title "How a limit turns into a label"
layout flow
you: person "You"
api: box "Model API"
note you "max_tokens: 5"
step 1: you, api "You ask for a short description"
you -> api : "Describe Paris."
api --> you : "Paris, the capital of"
note api "finish_reason: length"
circle api
```

```ts
// body: { model: 'deepseek-flash', thinking: { type: 'disabled' }, messages, max_tokens: 5 }
const data = await res.json()
const choice = data.choices[0]
console.log(JSON.stringify(choice.message.content), choice.finish_reason)
// "Paris, the capital of" length   (your words will differ)
```

The text looks like an ordinary short answer. Only `length` says it was cut off after 5 tokens. Without `max_tokens`, the same question would run to perhaps 200 tokens and end with `stop`.

Now make `complete` return the reason too, so callers cannot ignore it.

```ts
// src/llm.ts
export type FinishReason = 'stop' | 'length' | 'tool_calls'

export async function complete(messages: Message[]) {
  // ... the same fetch as before ...
  const choice = data.choices[0]
  return { content: choice.message.content as string, finish: choice.finish_reason as FinishReason }
}

// a caller
const { content, finish } = await complete(history)
switch (finish) {
  case 'stop':       console.log(content); break
  case 'length':     console.log(content + '\n[reply was cut off]'); break
  case 'tool_calls': throw new Error('not supported yet: the next module adds this')
  default:           throw new Error(`unexpected finish_reason: ${finish}`)
}
```

Why it matters: a program that reads only the text will treat a truncated reply as a full one. If the text was half a list of steps, or half a block of code, your program will act on half. When streaming, read the reason from the final piece before `[DONE]`; it is not known until the end.

> **Key idea:** The stop reason is a label on every reply saying why the model stopped: finished (`stop`), cut off by a token limit (`length`), or asking your program to run a function (`tool_calls`).

**In DeepSeek Harness:** the provider's labels are translated into the harness's own: `stop`, `tool-calls`, `max-tokens`, plus `aborted` and `error` for replies that did not end normally (`FinishReason` in `packages/llm/llm/src/types.ts`; the DeepSeek mapping is in `packages/llm/llm-deepseek/src/translate.ts`).

## What you have now

You can call a model, keep its history, stream its reply, and tell a finished answer from a cut-off one. One label is still a mystery: `tool_calls`, where the model asks your program to run something. Before it can ask, it has to know what it may ask for. How do you describe a function to a model?
