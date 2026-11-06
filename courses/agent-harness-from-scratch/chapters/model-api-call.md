# Model API call: asking a hosted model for text

A large model needs powerful, expensive hardware, so it usually runs on its provider's computers, not yours. Your program is a small TypeScript file on your laptop. How does that file get a question to the model and get the answer back?

## Ordering through a hatch

Picture a takeaway hatch. You do not walk into the kitchen. You hand a written order through the hatch in the format the kitchen expects, with your account card. A while later, the food comes back through the same hatch.

```inkling
title "One request out, one reply back"
layout down
you: box "Your program" yellow
req: sticky "Order\nJSON + API key"
provider: box "Provider's model"
reply: sticky "Reply\nJSON text + tokens"
step 1: you, req "Your program writes the order"
step 2: provider "The request travels to the provider"
step 3: reply "The reply comes back through the hatch"
circle req
note provider "the model remembers nothing"
```

A provider offers the same arrangement for its model. It publishes an API, short for application programming interface: a fixed web address plus an agreed format for what you send and what you get back. You send an HTTP request, the same kind of message a browser sends when it loads a page. You get an HTTP response with the model's reply.

Two pieces make up the order. The first is JSON, short for JavaScript Object Notation: plain text that writes data as nested `{ "key": value }` objects and `[ ]` lists. Both your order and the reply are JSON. The second is an API key: a long secret string the provider gives you. It identifies you, so the provider knows whom to bill. Keep it out of your code and out of version control. Put it in an environment variable instead.

The picture stops holding at the cook. A kitchen remembers regular customers. The model remembers nothing; it reads your order, writes a reply, and is done.

## The smallest real call

This course uses DeepSeek's API in its examples. Make a folder with a `package.json` that contains `"type": "module"`, export your key as `DEEPSEEK_API_KEY`, and save this file.

```ts
// src/ask.ts — run with: npx tsx src/ask.ts
const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'deepseek-flash',
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: 'What is the capital of France?' }],
  }),
})
if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

const data = await res.json()
console.log(data.choices[0].message.content)
console.log(data.usage)
```

Walk through it. `fetch` sends a `POST` request, which is the HTTP method for sending data. The `Authorization` header carries your key after the word `Bearer`. The body is JSON. `model` names which model you want. `thinking` switches off the model's long working-out step, which it does by default; a later lesson turns it back on. `messages` holds your question; for now it is a list with one entry, and the next lesson explains the `role` label.

```inkling
title "What you send, what you get"
layout compare
columns "Request body", "Reply body"
row "Names the model": "model: deepseek-flash", "model: deepseek-flash"
row "Your text": "messages", "choices[0].message.content"
row "Thinking": "thinking: disabled", "written reply"
row "Cost": "none", "usage tokens"
row "Missing key": "HTTP 401 error", "no reply"
steps auto
```

If the key is missing or wrong, `res.ok` is false and you see the provider's error, for example status 401. Otherwise the reply body is JSON shaped roughly like this, trimmed to the parts you use:

```json
{
  "model": "deepseek-flash",
  "choices": [
    { "index": 0, "message": { "role": "assistant", "content": "The capital of France is Paris." } }
  ],
  "usage": { "prompt_tokens": 11, "completion_tokens": 8, "total_tokens": 19 }
}
```

The text is at `choices[0].message.content`. `choices` is a list because you may ask for several alternative replies; you will always take the first. `usage` reports tokens: `prompt_tokens` is what you sent, `completion_tokens` is what the model wrote, and the total is their sum. Your exact numbers and wording will differ. These are the numbers the provider bills you for.

> **Key idea:** A model API call is one HTTP request from your program to the provider, carrying your key and a JSON body that names the model and your text; the JSON response carries the model's reply and the tokens used.

**In DeepSeek Harness:** its DeepSeek support lives in `packages/llm/llm-deepseek`. Its adapter talks to a different, Anthropic-style endpoint (`/messages`, in `messages-api.ts`) rather than `/chat/completions`, but the idea is the same.

## What you have now

You can send text to a hosted model and read its reply and token counts. The request held a `messages` list, and each entry had a `role`. What are those roles, and why does each message need a label?
