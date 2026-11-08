# Tokens: the small pieces a model reads

A language model predicts one next piece of text at a time. But what is a piece? If it were always a whole word, the model could never write a word it had not seen, such as a new product name or a variable called `getUserIdV2`. If it were one letter, every answer would need a very long run of predictions. Models use a middle size.

## Pieces like a set of stamps

Think of a box of rubber stamps for printing text. The box has a stamp for each common word, such as "the" and "file". It also has stamps for common parts of words, such as "un", "ing" and "able", and a stamp for each single letter. You can print any text with the box. Common words take one stamp. Rare words take several smaller stamps.

A model reads and writes with such a box of pieces. Each piece is called a **token**, and each token has a fixed number, its id. The model does not see letters. It sees a list of numbers, and it predicts the number of the next token. The comparison differs in one way: you choose stamps by hand, but a program called a **tokenizer** cuts text into tokens with fixed rules. The rules come from the same text the model learned from.

## Cutting one sentence

Here is how a tokenizer might cut the text "Read unbelievable.txt". The exact cuts and ids depend on each model's tokenizer, so these values only show the shape:

| Token text | Token id |
| --- | --- |
| Read | 4423 |
| ␣un | 653 |
| believ | 34510 |
| able | 481 |
| .txt | 9212 |

1. The tokenizer finds the longest known pieces. "Read" is common, so it is one token.
2. It cuts a rare word into smaller known pieces. "unbelievable" becomes three tokens.
3. It keeps the space with the next word. "␣un" means a space followed by "un".
4. It replaces each piece with its id. The model receives `[4423, 653, 34510, 481, 9212]`.

```inkling
title "From text to token ids"
layout down
text: box "Read unbelievable.txt"
cut: round "Tokenizer"
pieces: sticky "Read | un | believ | able | .txt"
ids: box "4423, 653, 34510, 481, 9212"
model: round "Language model"
text -> cut -> pieces -> ids -> model
highlight pieces
step 1: text, cut "A tokenizer reads the text"
step 2: pieces "It cuts the text into known pieces"
step 3: ids "Each piece becomes its number"
step 4: model "The model only sees the numbers"
```

The model's reply comes back the same way: the model predicts token ids, and the tokenizer turns them back into text.

Tokens matter to you as a programmer for two reasons. First, a hosted model charges by the token, for the text you send and the text it writes. Second, every limit on a model is counted in tokens, not in characters or words. A reply from DeepSeek reports both counts:

```json
{ "usage": { "input_tokens": 12, "output_tokens": 30 } }
```

Here the request held 12 tokens and the reply held 30.

You often need a count before you send anything, and the exact tokenizer is not always at hand. A common estimate is 4 characters of English text per token. With it, a 2,000-character file is about 500 tokens. Code and other languages can differ from this estimate, so treat it as a rough guide.

```ts
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

estimateTokens('Read unbelievable.txt') // 21 characters, so 6 tokens
```

The estimate gives 6 here, and the tokenizer above produced 5. That is close enough to plan with, not to bill with.

> **Key idea:** A token is a numbered piece of text, often a word or part of a word. Models read, write, limit and charge in tokens.

DeepSeek Harness, the program this course studies, counts tokens in both ways. Before a request it uses this same estimate of 4 characters per token (`CHARS_PER_TOKEN = 4` in its token-counting package under `packages/llm/`). After a reply it reads the exact `input_tokens` and `output_tokens` counts from each DeepSeek reply in `packages/llm/llm-deepseek/src/translate.ts` (line 36).

## What you have now

A language model predicts the next token, and a tokenizer turns text into token ids and back. Every model limit is counted in tokens. So how many tokens can one model consider at once?
