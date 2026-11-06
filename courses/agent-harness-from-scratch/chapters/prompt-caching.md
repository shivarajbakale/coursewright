# Prompt caching: reusing work for an unchanged request beginning

Twice now you kept the start of the request the same: fast-changing facts stay out of prompt sections, and project instructions are recorded once and never rewritten. Because the model is stateless, every step sends the whole conversation again. In a long turn, step 20 resends everything steps 1 to 19 already sent. Does the provider really redo all that work every time?

## Rereading from the first change

Before a model can write its reply, it processes every input token in order. The work for each token depends only on the tokens before it. So if a new request starts with exactly the same tokens as an earlier one, the provider can keep the work it did for that shared start and reuse it. The shared start is called the prefix. Reuse stops at the first token that differs. Everything after it is processed again.

```inkling
title "Where the cache hit stops"
layout down
sys: box "System prompt" yellow
instr: box "Project instructions"
user: box "User message"
asst: box "Assistant reply"
tool: box "Tool result"
sys -> instr -> user -> asst -> tool
circle sys
circle instr
circle user
step 1: sys, instr, user "The start is unchanged, so its work is kept"
step 2: asst "A new token differs here, so reuse stops"
```

Picture a long book you are summarizing. Someone changes one word on page 3. Your notes for pages 1 and 2 still hold. Everything from page 3 on must be reread, even if the rest is unchanged. The picture stops holding in one way. Your notes are yours to keep. A provider's stored work is best effort: it may expire or be evicted, and it is reused only in chunks, so a hit is never guaranteed.

DeepSeek's API does this automatically, with no setting. Each reply's `usage` reports `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens`, and hit tokens are billed at a lower price. Your adapter can pass the hit count on in its usage chunk:

```ts
// src/llm.ts, where the final usage arrives
if (json.usage) yield { type: 'usage', inputTokens: json.usage.prompt_tokens,
  outputTokens: json.usage.completion_tokens, cacheReadTokens: json.usage.prompt_cache_hit_tokens ?? 0 }
```

## Two ways to build the next request

Trace three steps of one turn. The system prompt is 2,000 tokens and the project instructions 1,200.

```text
good: history only grows at the end
step 1  [system, instructions, user]                       3,250 tokens, 0 reused
step 2  [system, instructions, user, assistant, tool]      4,450 tokens, up to 3,250 reusable
step 3  [ ...all of step 2..., assistant, tool]            5,600 tokens, up to 4,450 reusable

bad: system prompt starts with "Current time: 10:41:07"
step 2  first token differs from step 1                    0 reusable
```

In the good case each request begins with the whole previous request, so almost every token is reused. In the bad case one changing line at the very top throws the prefix away on every step.

This gives four rules for `minidsh`:

1. History only grows at the end. Never edit, reorder or delete an earlier message in place. The event log already works this way.
2. Keep fast-changing facts out of the beginning. Put the time or the working folder in a later message, and add a new one only when it changes.
3. The tool list sits at the start of the request too. Adding or removing a tool mid-session invalidates everything from the first changed token.
4. If the system prompt must change mid-session, add a new system message after the history instead of replacing the first one.

A small test helps you keep the first rule. It counts how many messages two requests share from the start:

```ts
export function sharedPrefix(a: Message[], b: Message[]): number {
  let i = 0
  while (i < a.length && i < b.length && JSON.stringify(a[i]) === JSON.stringify(b[i])) i++
  return i
}
```

For consecutive steps, `sharedPrefix(previous, next)` should equal `previous.length`.

> **Key idea:** Prompt caching is the provider reusing its work for the longest unchanged beginning of a request, so a harness keeps that prefix stable and only ever adds to the end.

**In DeepSeek Harness:** there are no explicit cache markers. Caching is kept by structure: append-only history, volatile facts sent as a user-role runtime-context message only when they change, and a route setting `systemPromptUpdate: 'in-history'` that appends a new system message after the cached history instead of replacing the first. `TokenUsage` records `cacheReadTokens` and `cacheWriteTokens`. Even the extra call that summarizes old history replays the exact system prompt, tools and prefix, with its instruction as the last user message, "so the provider's KV cache is reused".

## What you have now

You know why the request's beginning must stay fixed and history must only grow at the end, joining derived history and prompt sections. But a history that only grows will one day fill the context window. How do you know how close you are?
