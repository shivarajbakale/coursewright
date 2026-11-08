# Token meter: counting what the next request will use

The model's view keeps growing: prompt sections, the history, time notes, AGENTS.md. As you saw with the context window, one request can hold only a fixed number of tokens. If the harness waits until the provider rejects a request, the step is lost. So before each step, the harness needs a number: about how many tokens will the next request use?

## A fuel gauge with a red zone

Think of a car's fuel gauge. It does not measure every drop. It reads a float in the tank, and it is a little wrong, but it is right enough to warn you. The red zone starts well before the tank is empty, because you still need fuel to reach a petrol station.

In the harness, the tank is the context window, the gauge is the token meter, and the red zone starts at the **threshold**: the token count at which the harness must make the history shorter. The comparison differs in one way: the meter gets an exact reading after each reply, because the provider reports usage. Between replies, the meter guesses only the part that was added since.

## The estimate

The guess is a fixed rule: about 4 characters per token, plus 4 tokens for each block and 4 for each message. In mini-dsh, `src/meter.ts`:

```ts
export function estimateMessage(message: Message): number {
  let tokens = 4                                   // role framing
  for (const block of message.content) {
    const text = block.type === 'text' ? block.text : JSON.stringify(block)
    tokens += Math.ceil(text.length / 4) + 4       // text plus block framing
  }
  return tokens
}

export function measure(lastUsage: number, addedSince: Message[]): number {
  return lastUsage + addedSince.reduce((sum, m) => sum + estimateMessage(m), 0)
}
```

`lastUsage` is the provider's total for the last reply: input tokens, cache tokens and output tokens.

## The threshold

The request must fit three things in the window `W`: the messages, the reply, and room to write a summary later. So the threshold is the smaller of two limits:

```ts
export function thresholdTokens(W: number, reply: number, headroom: number): number {
  return Math.floor(Math.min(W * 0.8, W - reply - headroom))
}
```

`reply` is the `max_tokens` the request reserves for the answer, because the reply uses the same window. `headroom` is space kept free for the work that shortens the history.

```inkling
title "Where the threshold sits"
layout stack
- Room for messages: 7,000
- Headroom: 2,000
- Reply reserve: 1,000
brace room-for-messages-7-000..reply-reserve-1-000 "context window: 10,000"
steps auto
```

Work one example with `W` = 10,000, `reply` = 1,000 and `headroom` = 2,000.

1. Compute 80% of the window. 10,000 × 0.8 = 8,000.
2. Compute what is left after the reserves. 10,000 − 1,000 − 2,000 = 7,000.
3. Take the smaller value. The threshold is 7,000 tokens.
4. Measure the next request. The last reply reported 5,200 tokens. A tool result of 6,000 characters arrived since: 1,500 + 4 + 4 = 1,508. The total is 6,708, below 7,000, so the step goes ahead.
5. Measure again after one more result of 2,000 characters: 500 + 4 + 4 = 508. The total is 7,216. This is above 7,000, so the history must become shorter first.

> **Key idea:** The token meter estimates the next request from the last reported usage plus what was added; at the threshold, the history must shrink.

## How dsh does it

```inkling
title "Who measures, and when"
loop: box "agent-loop"
hook: box "agent/pre-step"
basic: box "compaction-basic"
meter: box "ctx.tokenMeter"
deepseek: box "llm-deepseek"
loop -> hook -> basic
basic -> meter : "measure()"
deepseek -> meter : "usage of last reply"
steps auto
```

The meter is `packages/llm/token-meter`, the service `ctx.tokenMeter`. `src/estimate.ts` (lines 13-19) sets 4 characters per token and 4 tokens of framing per block and per role. `measure()` in `src/index.ts` (line 151) starts from the last reply's reported usage when its request matches. Otherwise it estimates the whole request. The threshold is in `packages/compaction/compaction-basic/src/config.ts` (lines 191-194): `floor(min(W × 0.8, W − reply − 65,536))`. With dsh's numbers, `W` = 1,048,576 and the adapter's default `reply` cap is 256,000 (`packages/llm/llm-deepseek/src/defaults.ts`, line 8). The headroom limit is lower, so the threshold is 727,040 tokens. `compaction-basic` checks it in an `agent/pre-step` listener (`src/index.ts`, line 157).

## What you have now

Before each step, the harness has a number and a line to compare it with. Above the line, older history must take less space. But the history is not a list of loose messages: a tool call and its result belong together. Which old messages can the harness choose without breaking that?
