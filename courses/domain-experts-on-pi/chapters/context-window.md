# The context window: what the model can see at once

A language model writes one token at a time, and it chooses each token by reading the text in front of it. That text has a length. The length has a limit. What happens when a conversation becomes longer than the limit?

Think of a desk with a fixed surface. You put the instructions, the question and your notes on it. There is room for one page of answer and no more. When the desk is full, you must remove something before you write.

A context window works like this desk: one fixed space holds everything for one request. The comparison differs in one way. You choose what to remove, and you know what you removed. The model does not. A program outside the model chooses what stays, and the model never learns what was left out.

## What fills the window

The window holds all of the prompt: the instructions, the question, the conversation so far and the reply as it is written. Take a model with a window of 1,000 tokens. One request holds these parts:

1. Instructions: 200 tokens.
2. The question: 40 tokens.
3. Earlier conversation: 600 tokens.
4. The reply: up to 160 tokens.

The first three parts use 840 tokens. That leaves 160 for the reply, so the request fits. Now the conversation grows. After a few more turns, the earlier conversation takes 900 tokens.

The first three parts now use 1,140 tokens. That number is larger than the window, so the request cannot be sent. The program must drop or shorten at least 140 tokens before the model can answer.

```inkling
title "The window fills as a conversation grows"
layout timeline
- 1: Instructions
- 2: The question
- 3: More turns
- 4: No room left
- 5: Old turns dropped
span 2..4 "shared space"
step 1: 1 "The instructions take their share first"
step 2: 2 "The question adds its tokens"
step 3: 3 "Each new turn takes more space"
step 4: 4 "The reply no longer fits"
step 5: 5 "The program drops or shortens turns"
circle 4
```

The reply counts too. A reply of 300 tokens with those same 840 tokens used would need 1,140 tokens, and it would not fit. This is why a long answer can use room that the next question needs.

## The limit is invisible

The model knows two things: the patterns it learned in training, and what sits in the window now. It has no record of a turn that the program removed. So a dropped instruction is not forgotten in the human sense. It never arrives. A long conversation can lose an early rule without any warning, and the next answer looks as confident as before.

> **Key idea:** The context window is the fixed number of tokens one request can hold: instructions, conversation and reply all share it.

## How pi does it

Every model in pi's catalogue carries its window size. The entry for DeepSeek V4.1 Flash (id `deepseek-flash`) sets `contextWindow: 1000000` and `maxTokens: 384000`, the largest reply, at packages/ai/catalog/providers/deepseek.ts:9-22. The first number is the whole window. The second number is the most the reply may take from it.

## What you have now

You know that a model writes one token at a time, and that each token comes from text inside a fixed window. The instructions, the conversation and the reply share that window. Anything outside it is invisible to the model. This leaves a question: how can a model do more than write text, such as ask your program to act?
