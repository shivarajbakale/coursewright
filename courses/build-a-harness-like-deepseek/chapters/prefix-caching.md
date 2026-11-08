# Prefix caching: reusing work on an unchanged request start

Each request repeats the whole conversation, with reasoning blocks and their signatures exactly as they arrived. In a turn of five steps, the system prompt, the tools and the early messages go to DeepSeek five times. The model must read every token of every request. Can the provider skip the start it has already read?

## A book you have read before

Think of a reader who gets a new edition of a long book. If the first 200 pages are word for word the same, the reader can skip to page 201. If one word on page 3 changed, everything from page 3 onwards must be read again, because later pages may depend on it. Here the book is one request, the unchanged pages are the start the provider already read, and the reader is the provider. The picture differs in one way: a reader decides to skip, but the program never decides. The provider keeps earlier work for some time on its own, and the program only sees afterwards how many tokens it reused.

The **prefix** of a request is its start, up to the first byte that differs from an earlier request. **Prefix caching** is the provider reusing its work on a prefix it read before. A **cache hit** is a request where some of that work was reused.

```inkling
title "Request 2 starts with request 1"
layout stack
- Request 1, unchanged
- The assistant reply
- The tool result
brace request-1-unchanged..request-1-unchanged "reusable prefix"
step 1: request-1-unchanged "Everything request 1 sent comes first, byte for byte"
step 2: the-assistant-reply "The model's reply is added after it"
step 3: the-tool-result "Then the tool result; only these parts are new"
```

## Only append

The rule for the program follows from the picture: change nothing that was already sent, and add new things only at the end. A small example shows the cost of breaking it.

1. Send request 1. It holds a system prompt, two tool schemas and one user message.
2. Send request 2 after a tool call. It holds the same three parts plus the assistant reply and the tool result. All of request 1 is a prefix of request 2, so the provider can reuse all of it.
3. Put the current time at the top of the system prompt. Now request 3 differs from its first line, so the provider can reuse nothing.
4. Change the description of one tool schema. Request 3 now differs from that changed token onwards, so the provider reads everything after it again.

The record already makes appending natural: as you saw with the logged system prompt, the prompt is a message in the history. When the prompt changes, the program can add the new version as a later message instead of editing the first one.

DeepSeek reports reuse in its usage. `message_start` carries `cache_read_input_tokens`, so `translate` adds one field:

```ts
// message_start
usage.inputTokens = e.message.usage?.input_tokens ?? 0
usage.cacheReadTokens = e.message.usage?.cache_read_input_tokens ?? 0
```

A test can then check that the loop only appends:

```ts
export function keepsPrefix(prev: GenerateOptions, next: GenerateOptions): boolean {
  return prev.system === next.system
    && JSON.stringify(prev.tools) === JSON.stringify(next.tools)
    && prev.messages.every((m, i) => JSON.stringify(m) === JSON.stringify(next.messages[i]))
}
```

`keepsPrefix` is true when request 1 and request 2 from the steps are compared. It is false after step 3 or step 4. There is no flag to turn caching on; the only thing the program controls is whether its requests keep the same start.

> **Key idea:** Prefix caching reuses the provider's work on an unchanged request start, so the harness keeps earlier bytes identical and only appends.

## How dsh does it

`packages/core/agent-loop/README.md` (line 164) states the rule: prefix reuse needs earlier messages and tool declarations to stay byte-identical for the same provider and model. A changed tool definition loses reuse from the first changed token, and a prompt change that replaces a system message in place misses the cache from that point. For a model that declares `systemPromptUpdate: 'in-history'`, as `deepseek-flash` does in `packages/llm/llm-deepseek/src/models.ts` (line 14), dsh appends the changed prompt after the history instead. `serialize.ts` sends that later prompt as a `system` message in the message list (lines 110-112). `translate.ts` reads `cache_read_input_tokens` into `cacheReadTokens` (line 36).

## What you have now

Requests now keep their start identical, and usage shows how many input tokens the provider reused. All of this assumes the request succeeds. A provider can also be busy, refuse for a moment or drop the connection. What should the program do when a request fails?
