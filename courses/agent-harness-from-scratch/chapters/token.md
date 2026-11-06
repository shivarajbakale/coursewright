# Token: the small chunks of text a model reads

Your toy predictor cut text at the spaces and worked with whole words. A real model cannot do that. There are too many words: names, typos, code, numbers, every language on earth. A list of all of them would never be finished. So what does a model read, if not words?

## Words built from pieces

Picture a box of rubber stamps. Common words such as "the" or "and" get a stamp of their own. Rarer words are printed with two or three stamps of word parts, such as "un" + "happy". And there is one stamp for every single letter, so any text at all can be printed, however strange.

```inkling
title "Words built from token stamps"
layout mindmap
- Text
  - Common word stamps
    - " the"
    - " and"
  - Word part stamps
    - " un" + "happy"
  - Single letter stamps
    - "a" to "z"
note text "Every text can be stamped"
step 1: text "Text can always be represented"
step 2: common-word-stamps "Common words get their own stamps"
step 3: word-part-stamps "Rarer words use word parts"
step 4: single-letter-stamps "Single letters cover anything else"
```

A model reads and writes text in exactly these stamps. Each stamp is called a token, and each token has a number. The model never sees letters. It sees a list of token numbers, and it predicts the number of the next token.

The picture stops holding in one detail. The stamps are not chosen by a person. A program picks them by studying lots of text and keeping the chunks that appear most often. Real vocabularies hold many thousands of tokens, and a leading space is often part of the token, as in " am".

Here is a tiny tokenizer, the program that turns text into token numbers. It always takes the longest piece in its vocabulary that matches.

```ts
// tokens.ts — run with: npx tsx tokens.ts
const pieces = [' un', 'happi', 'happy', 'ness', 'I', ' am', ' very']
const letters = 'abcdefghijklmnopqrstuvwxyz '.split('')
const vocab = [...pieces, ...letters] // a token's number is its index here

function tokenize(text: string): number[] {
  const ids: number[] = []
  let i = 0
  while (i < text.length) {
    let best = -1 // the longest piece that matches at position i
    for (let id = 0; id < vocab.length; id++) {
      const p = vocab[id]
      if (text.startsWith(p, i) && (best < 0 || p.length > vocab[best].length)) best = id
    }
    if (best < 0) throw new Error(`no token for "${text[i]}"`)
    ids.push(best)
    i += vocab[best].length
  }
  return ids
}

for (const text of ['I am unhappy', 'I am unhapy']) {
  const ids = tokenize(text)
  console.log(ids.length, ids.map((id) => vocab[id]))
}
// 4 [ 'I', ' am', ' un', 'happy' ]
// 7 [ 'I', ' am', ' un', 'h', 'a', 'p', 'y' ]
```

Walk through the first text, "I am unhappy", which is 12 characters. At the start, "I" matches. Next comes " am", which beats the single space because it is longer. Then " un". Then "happy" matches, while "happi" does not, because the text has a "y" where "happi" has an "i". Four tokens in all.

```inkling
title "Same sentence, different token counts"
layout compare
columns "I am unhappy", "I am unhapy"
row "Tokens": "4", "7"
row "Pieces": "I / am / un / happy", "I / am / un / h / a / p / y"!
row "Cost": "4 tokens", "7 tokens"
step 1: i-am-unhappy "The first text matches four tokens"
step 2: i-am-unhapy "The typo falls back to letters"
note i-am-unhapy "seven tokens instead of four"
```

Now the typo "unhapy". Neither "happi" nor "happy" matches, so the tokenizer falls back to single letters. The same idea now costs 7 tokens instead of 4. Nothing is lost, since every letter has a token. It is only more expensive.

Why should you care about counts? Because everything about a model is measured in tokens, not words or characters. Providers charge per token, both for the text you send and for the text it writes back. The speed of a reply is roughly tokens per second. And, as the next lesson shows, there is a hard limit on how many tokens one request may hold.

You will often want a quick estimate without running a real tokenizer. For English text a common rule of thumb is about 4 characters per token. By that rule, a 2,000-character page is about 500 tokens. Code, other languages and unusual words usually take more.

> **Key idea:** A token is one small numbered chunk of text, often a word or part of a word; a model reads and writes lists of tokens, and every size, price and limit is counted in them.

**In DeepSeek Harness:** when it needs a fast estimate, it uses exactly that rule, a fixed `CHARS_PER_TOKEN = 4`, in `packages/llm/token-meter/src/estimate.ts`.

## What you have now

A language model predicts the next token, not the next word, and a token is a numbered chunk such as " am" or "happy". Counting tokens tells you what a request costs. It also tells you whether it fits at all: how much text can a model take in at once?
