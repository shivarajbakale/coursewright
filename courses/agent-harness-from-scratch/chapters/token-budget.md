# Token budget: knowing when the context window is nearly full

History in `minidsh` only grows at the end, which keeps the provider's reuse high. But a long session keeps growing. Every tool result and every reply adds tokens, and the context window is fixed. If you send a request that is too big, the provider rejects it, usually in the middle of real work. How do you see the limit coming before you hit it?

## A fuel gauge with a reserve

A driver does not wait for the engine to stop. They watch the fuel gauge and fill up at a quarter tank, because the last stretch needs a reserve. A harness needs the same gauge for tokens, and the same reserve. The request must leave room for the model's reply, and room for the work of shrinking history when the time comes.

The picture stops holding at the gauge itself. A fuel gauge reads the tank directly. Your harness can read an exact token count only after a request, from the provider's `usage`. For anything added since, it has to estimate.

## Counting and the threshold

So `minidsh` combines the two. Take the exact count from the last reply, which covers the prompt it sent plus the reply it got. Then estimate only the messages added since. A common rough rule for English text is about four characters per token. Code and other languages differ, which is one more reason to keep a reserve.

```ts
// src/context.ts
export const estimateTokens = (text: string) => Math.ceil(text.length / 4)

export function measure(lastPromptTokens: number, lastReplyTokens: number, addedSince: Message[]): number {
  return lastPromptTokens + lastReplyTokens + addedSince.reduce((n, m) => n + estimateTokens(JSON.stringify(m)), 0)
}

export interface Budget { contextWindow: number; maxOutput: number; headroom: number; ratio: number }

export function threshold(b: Budget): number {
  return Math.floor(Math.min(b.contextWindow * b.ratio, b.contextWindow - b.maxOutput - b.headroom))
}
```

The threshold takes the smaller of two limits. The first is a fixed share of the window, here 80 percent. The second is what is left after reserving the reply's maximum length and a headroom for later work. Whichever is stricter wins.

Work one example. The window is 128,000 tokens, the reply may use up to 8,000, and the headroom is 16,000:

```text
128,000 x 0.8              = 102,400
128,000 - 8,000 - 16,000   = 104,000
threshold                  = 102,400   (the smaller)

last request: prompt 98,000 + reply 1,400  = 99,400 exact
new tool result: 14,000 characters         = 3,500 estimated
measure                                    = 102,900  -> over 102,400
```

Before the next step, the loop compares `measure` with `threshold`. Here 102,900 is past the line, even though the window itself still has 25,100 tokens free. That is the point: you act while there is still room to act. With a headroom of 65,536 instead, the second limit becomes 128,000 − 8,000 − 65,536 = 54,464, and that smaller number would be the threshold.

Check the budget in two places. Before each step, as above. And when the provider rejects a request as too long anyway, because estimates can be wrong. In both cases the loop needs something to do next, which the next lesson builds.

> **Key idea:** A token budget is an exact count from the last reply plus an estimate of everything added since, compared with a threshold that reserves room for the reply and for later work.

**In DeepSeek Harness:** the count comes from `ctx.tokenMeter` in `packages/llm/token-meter`. Its measurement says whether it is anchored on the provider's real usage (`baseline.kind === 'usage'`) or `estimated`. The threshold is computed in `packages/compaction/compaction-basic/src/config.ts` as `floor(min(contextWindow × thresholdRatio, contextWindow − reservedCompletionTokens − headroomTokens))`, with defaults `thresholdRatio` 0.8 and `headroomTokens` 65,536. The check runs before each step and again when the provider reports a context overflow.

## What you have now

You can tell, before each step, whether the next request is near the window's limit, using what you know about tokens, the context window and session events. The open question is what to do when the gauge says stop: how do you make old history smaller without losing what matters?
