# The context window: what the model can see at once

A model reads tokens and predicts the next one. Suppose you want it to answer a question about a large project: 300 source files and a long conversation about them. Can you give the model all of it? The answer is a fixed number, and every agent must plan around it.

## A desk of fixed size

Think of a person who works at a desk. They can only read the papers on the desk. Papers in the filing cabinet are invisible to them until someone puts them on the desk. The desk has a fixed size, so a large report pushes other papers off.

The **context window** is the desk. It is the largest number of tokens the model can consider in one request. Your instructions, the conversation so far, any file contents you include and the reply the model writes must all fit in it. The comparison differs from the field in one way: a person can remember yesterday's papers. A model keeps nothing between requests, so the desk is empty again for each new request. The program decides what goes on the desk every time.

## Counting what fits

The window shares its space between the text you send (the input) and the text the model writes (the output). Take an imagined small model with a window of 1,000 tokens:

1. Put instructions on the desk. They take 100 tokens.
2. Add the conversation so far. It takes 600 tokens, so the input is now 700 tokens.
3. Leave room for the reply. A reply of at most 300 tokens brings the total to 1,000, which fits exactly.
4. Add a file of 400 tokens. The input becomes 1,100 tokens, which is more than the window before the model writes one token.

```inkling
title "One request on the desk"
layout timeline
- 100: Instructions
- 700: Conversation added
- 1000: Room for the reply
- 1100: A file added
span 100..1000 "fits the 1,000-token window"
cross 1100
step 1: 100 "Instructions take the first 100 tokens"
step 2: 700 "The conversation brings the input to 700"
step 3: 1000 "The reply needs the last 300"
step 4: 1100 "One more file is too much"
```

A small check in TypeScript makes the rule exact:

```ts
function fits(inputTokens: number, maxReplyTokens: number, window: number): boolean {
  return inputTokens + maxReplyTokens <= window
}

fits(700, 300, 1000)  // true: 1,000 of 1,000 tokens
fits(1100, 300, 1000) // false: 1,400 is more than 1,000
```

A request that is too large does not partly work. The hosted model refuses it with an error. Because of this, a program that talks to a model must count tokens before it sends a request, and it must choose what to leave out when the total is too large.

Real windows are much larger than 1,000 tokens. The model this course uses, `deepseek-flash`, has a window of 1,048,576 tokens. With the estimate of 4 characters per token, that is about 4 million characters of text. That sounds unlimited, but an agent that reads files and runs commands for an hour fills it. Each file it reads and each result it receives goes on the desk and stays there.

> **Key idea:** The context window is the fixed number of tokens a model can consider in one request, shared by the input and the reply.

DeepSeek Harness records each model's window in `packages/llm/llm-deepseek/src/models.ts`, where `OFFICIAL_CONTEXT_WINDOW = 1_048_576` (line 5). When DeepSeek refuses a request as too large, `packages/llm/llm-deepseek/src/transport.ts` (line 32) labels the error `CONTEXT_WINDOW_EXCEEDED`, so other parts of the program can react to that case. A later module shows how dsh makes room when the window fills.

## What you have now

A model predicts tokens, and it sees only the tokens inside its context window for the current request. The program chooses what goes in. So how does a program send that chosen text to a hosted model and get the reply back?
