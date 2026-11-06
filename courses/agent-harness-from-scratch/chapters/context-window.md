# Context window: how much text the model sees at once

Now you count text in tokens. So here is a natural question: could you hand a model a whole book, a whole codebase, a year of chat, and ask about it? Is there a limit on how many tokens it can take in?

## A whiteboard of fixed size

There is a limit. Picture a whiteboard of fixed size. You write your question on it. The model reads the board and writes its answer underneath, on the same board. When the board is full, nothing more fits: not another line of your text, and not another word of its answer.

That board is the model's working space for one request. The model reads only what is on it. If a fact is not on the board, the model does not know it was ever there. It has no side drawer of notes to check.

The picture stops holding in two places. You can rub out part of a real whiteboard and keep going. A model cannot: if your text is too long, the provider refuses the whole request with an error. And the board's size is fixed by the model's design, so you cannot buy a bigger board for the same model.

Here is the arithmetic with a small, made-up limit of 1,000 tokens, using the estimate of about 4 characters per token.

```ts
// window.ts — run with: npx tsx window.ts
const WINDOW = 1000       // a made-up limit, to keep the numbers small
const CHARS_PER_TOKEN = 4 // rough estimate for English text

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function roomForReply(input: string): number {
  return WINDOW - estimateTokens(input)
}

console.log(roomForReply('x'.repeat(2800))) // 1000 - 700 = 300
console.log(roomForReply('x'.repeat(4200))) // 1000 - 1050 = -50
```

Walk through it. A 2,800-character input is about 700 tokens. That leaves 300 tokens of the window for the answer. If the model needs more than 300, its answer is cut off where the board ends.

A 4,200-character input is about 1,050 tokens. That is 50 more than the whole window, before the model has written a single token. A provider would reject this request outright.

Two things follow from the sums. First, input and output share one window. A long input leaves less room to answer. Second, the estimate is only an estimate. Near the edge, leave a margin, because the real tokenizer may count a little more than your division says.

Real windows are far larger than 1,000 tokens. DeepSeek Harness's built-in catalog lists 1,048,576 tokens for DeepSeek's models. At 4 characters per token, that is roughly 4 million characters. That sounds endless, but a program that reads many files, one after another, into one long conversation can still fill it. Every file it reads stays on the board.

> **Key idea:** The context window is the fixed maximum number of tokens one request can hold, counting both the text you send and the reply the model writes; anything outside it does not exist for the model.

**In DeepSeek Harness:** each model in the DeepSeek catalog carries a `contextWindow` number (`packages/llm/llm-deepseek/src/models.ts`), and the harness keeps track of how full it is. Later in this course you will measure that fullness yourself and shrink old text before the board overflows.

## What you have now

A model predicts tokens, and one request can hold only so many of them: the context window. You know what fits, but not yet how text reaches the model at all. How does your program send a request to a model that runs on someone else's computer?
