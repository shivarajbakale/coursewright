# A model API call: sending text to a model over HTTP

A language model needs large, expensive computers, so you rarely run one on your laptop. A company such as DeepSeek runs the model on its own servers. Your program sits on your computer. How does your text reach their model, and how does the reply come back?

## Ordering by post

Think of a shop that takes orders by post. You fill in an order form in the format the shop prints in its catalogue. You put your customer number on it, so the shop knows who pays. The shop sends back a parcel with a packing slip that lists what is inside.

A **model API call** works the same way. API means application programming interface: the fixed format a service accepts from other programs. Your program sends one HTTP request to the model's address. The order form is **JSON**, a text format for data made of objects, lists, strings and numbers, the same shape as a JavaScript object. The customer number is an **API key**: a secret string that identifies your account, so the provider knows who pays for the tokens. The comparison differs in one way: a posted order takes days, but the reply to an API call comes back over the same connection, within seconds.

## One request, one reply

DeepSeek accepts requests in the same format as Anthropic's Messages API, a format many model providers use. You send a `POST` request to one address with three headers and a JSON body:

```ts
// src/llm.ts
export type Block = { type: 'text'; text: string }
export type Message = { role: 'user' | 'assistant'; content: string | Block[] }
export type Reply = { content: Block[]; usage: { input_tokens: number; output_tokens: number } }

const URL = 'https://api.deepseek.com/anthropic/v1/messages'
const HEADERS = {
  'x-api-key': process.env.DEEPSEEK_API_KEY ?? '',
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
}

export async function callModel(messages: Message[]): Promise<Reply> {
  const response = await fetch(URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ model: 'deepseek-flash', max_tokens: 1024, messages }),
  })
  if (!response.ok) throw new Error(`model call failed: ${response.status} ${await response.text()}`)
  return (await response.json()) as Reply
}
```

Run it with one question:

```ts
// src/main.ts
import { callModel } from './llm.ts'

const reply = await callModel([{ role: 'user', content: 'Name the capital of France in one word.' }])
console.log(reply.content[0])
```

Here is what happens:

1. Read the API key from the environment. It stays out of the source code, so it never goes into version control.
2. Send the JSON body with the model name, a reply limit and your question. The field `model` names the model. The field `max_tokens` caps the reply at 1,024 tokens. The field `messages` holds your question, and the next lesson explains its `role` field.
3. Check the HTTP status. A wrong key returns status 401, and the body explains the error.
4. Read the JSON reply. It looks like this:

```json
{
  "id": "msg_01",
  "type": "message",
  "role": "assistant",
  "content": [{ "type": "text", "text": "Paris." }],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 14, "output_tokens": 3 }
}
```

The reply text is inside `content`, which is a list of blocks. A list lets one reply carry several parts, and later lessons add other kinds of block. The `anthropic-version` header names the version of the request format, so a later change to the format cannot silently break your program. A later lesson explains `stop_reason`.

```inkling
title "One model API call"
layout sequence
you: icon laptop "Your program"
api: icon server "DeepSeek API"
you -> api : "POST JSON + API key"
activate api
api -> api : "the model predicts tokens"
api --> you : "JSON reply with content"
deactivate api
steps auto
```

> **Key idea:** A model API call is one HTTP request with a JSON body and an API key. A JSON reply holds the model's text.

## How dsh does it

DeepSeek Harness makes the same call, split across three packages:

- `packages/llm/llm` (`@deepseek-ai/dsh-llm`) gives the rest of the program one shared object, `ctx.llm`, for every model call.
- `packages/llm/llm-deepseek` builds the request. Its default address is `https://api.deepseek.com/anthropic` (`src/config.ts`, line 116), and `src/adapter.ts` (lines 142-154) sends the `POST` to `/v1/messages` with `anthropic-version: 2023-06-01`.
- `packages/llm/llm-deepseek-api-key` supplies the key as the `x-api-key` header (`src/index.ts`, line 99).

```inkling
title "The packages behind one call in dsh"
layout right
llm: box "dsh-llm\nctx.llm"
deepseek: box "dsh-llm-deepseek"
key: box "dsh-llm-deepseek-api-key"
api: icon server "DeepSeek API"
llm -> deepseek : "the request"
key -> deepseek : "x-api-key"
deepseek -> api : "POST /v1/messages"
api --> deepseek : "reply"
highlight deepseek
step 1: llm "Every part of dsh asks ctx.llm for a model call"
step 2: deepseek "dsh-llm-deepseek builds the JSON body"
step 3: key "Another package supplies the API key"
step 4: api "The request goes to DeepSeek over HTTP"
```

## What you have now

You can send text to a hosted model and read its reply, which is a list of blocks counted in tokens against the context window. The request body holds a list of messages, each with a `role`. What does the role mean, and how do you give the model instructions?
