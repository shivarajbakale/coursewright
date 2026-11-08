# Language model: a program that predicts the next word

You type "See you" into a phone message, and the keyboard offers "tomorrow", "soon" and "later". The keyboard did not understand your plans. It guessed which word tends to come next. A language model works on the same principle, at a much larger scale. Everything an agent does later in this course starts from that one guess.

## A keyboard that read a library

Think of the phone keyboard again. It saw the words you typed in the past, and it counts which word followed which. A language model is a program that learned the same kind of pattern from a very large amount of written text: books, web pages and source code. From that text it learned how likely each next piece of text is, given everything before it.

The comparison differs from the field in one important way. The keyboard looks at one or two words before the cursor. A language model looks at the whole passage before the cursor, often thousands of words. Because of this, it can continue a question with a fitting answer, not only with a common word.

The pieces it predicts are often whole words, but they can also be parts of a word or punctuation. The next lesson explains these pieces. For now, think of them as words.

## One word at a time

A **probability** is a number from 0 to 1 that says how likely something is. 0 means it never happens, 1 means it always happens. The probabilities of all the choices add up to 1.

Give a model the text "The cat sat on the". Here is the kind of list it computes for the next word (the numbers are invented for this example):

| Next word | Probability |
| --- | --- |
| mat | 0.40 |
| floor | 0.25 |
| sofa | 0.15 |
| any other word | 0.20 |

The model then writes text in a loop:

1. Compute the probabilities for the next word. The input is all the text so far.
2. Pick one word from the list. A likely word is picked more often, so "mat" wins about 4 times in 10.
3. Add the picked word to the end of the text. The text is now "The cat sat on the mat".
4. Repeat from step 1 until the model picks a special "stop" choice.

```ts
// A toy version of the loop. A real model computes the list; here it is fixed.
function nextWordProbabilities(text: string): Record<string, number> {
  return text.endsWith('the') ? { mat: 0.4, floor: 0.25, sofa: 0.15, rug: 0.2 } : { '.': 1 }
}

function pick(probabilities: Record<string, number>): string {
  let roll = Math.random()
  for (const [word, p] of Object.entries(probabilities)) {
    roll -= p
    if (roll <= 0) return word
  }
  return Object.keys(probabilities)[0]
}

let text = 'The cat sat on the'
const word = pick(nextWordProbabilities(text))
text += ' ' + word // for example "The cat sat on the mat"
```

When you ask a model a question, it continues your question with the text that most plausibly follows it, and that text is an answer. The model does not look the answer up anywhere. Because of this, it can write a wrong answer in a confident tone. An agent gives the model ways to check facts, and later modules build those ways.

```inkling
title "How a model writes text"
layout right
text: box "The cat sat on the"
model: round "Language model"
list: sticky "mat 0.40\nfloor 0.25\nsofa 0.15"
pick: diamond "Pick one"
text -> model : "all text so far"
model -> list : "probabilities"
list -> pick
pick -> text : "add 'mat'"
circle list
step 1: text, model "The model reads all the text so far"
step 2: list "It gives each possible next word a probability"
step 3: pick "The program picks one word, likely words more often"
```

> **Key idea:** A language model writes text by repeatedly predicting a probability for each possible next piece, picking one and adding it.

DeepSeek Harness, the program this course studies, contains no language model of its own. It sends text to DeepSeek's hosted models. The list of model names it knows, `deepseek-flash` and `deepseek-v4-pro`, is in `packages/llm/llm-deepseek/src/models.ts`.

## What you have now

You know that a language model continues text one predicted piece at a time, and that an answer is a likely continuation, not a looked-up fact. But what exactly is one of those pieces, and why is it not always a whole word?
