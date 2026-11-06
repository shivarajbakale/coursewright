# Language model: a program that predicts the next piece of text

You type "The capital of France is" into a chat app, and it answers "Paris". Nobody wrote a rule that says so. So how does a program give a sensible answer to a sentence it has never seen before?

## Guessing what comes next

Think of the keyboard on your phone. When you type "see you", it offers "soon", "tomorrow" and "later" above the keys. It has learned from text which words tend to follow which. Tap a suggestion and it suggests again. Keep tapping and you get a whole sentence, built one guess at a time.

A language model does the same thing on a far larger scale. It has studied an enormous amount of written text. Given any text, it scores every possible next piece by how likely it is. Then it picks one, adds it to the end, and repeats.

```inkling
title "How a model writes a reply"
layout cycle
center "the writing loop"
given: box "Text so far" yellow
score: box "Score every next piece"
pick: box "Pick one piece"
append: box "Append it to the text"
done: diamond "Reply finished?"
given -> score : "the text you have"
score -> pick : "a probability for each option"
pick -> append : "the chosen piece"
append -> given : "now look again"
append -> done : "no"
done -> given : "keep going"
step 1: given "You give the model the text so far"
step 2: score "It gives every next piece a probability"
step 3: pick "It picks one, weighted by those probabilities"
step 4: append "That piece joins the end of the text"
step 5: done "If the reply is not finished, it starts over"
```

The keyboard picture stops holding in one place. Your keyboard looks at the last word or two. A large model looks at everything before the gap. So "bank" in a sentence about rivers gets a different next guess than "bank" in a sentence about money.

Here is the smallest working version, in TypeScript. It learns from three short sentences by counting which word follows which.

```ts
// predict.ts — run with: npx tsx predict.ts
const text = 'the cat sat . the cat ran . the dog sat .'
const words = text.split(' ')

// counts['the'] will become { cat: 2, dog: 1 }
const counts: Record<string, Record<string, number>> = {}
for (let i = 0; i < words.length - 1; i++) {
  const now = words[i]
  const next = words[i + 1]
  counts[now] ??= {}
  counts[now][next] = (counts[now][next] ?? 0) + 1
}

function nextWord(word: string): [string, number][] {
  const options = counts[word] ?? {}
  const total = Object.values(options).reduce((a, b) => a + b, 0)
  return Object.entries(options).map(([w, n]) => [w, n / total])
}

console.log(nextWord('the')) // [ [ 'cat', 0.666... ], [ 'dog', 0.333... ] ]
console.log(nextWord('cat')) // [ [ 'sat', 0.5 ], [ 'ran', 0.5 ] ]
```

Walk through it. The word "the" appears three times. Twice it is followed by "cat" and once by "dog". So after "the", the option "cat" gets 2 out of 3, about 0.67. The option "dog" gets 1 out of 3, about 0.33. These fractions are probabilities: numbers from 0 to 1 that say how likely each option is. The probabilities of all the options add up to 1.

To write a sentence, start from "the" and pick "cat", the likelier option. Then look up what follows "cat". Both "sat" and "ran" have probability 0.5, so pick either one. Carry on until you reach the full stop.

A real model differs from this toy in two ways. First, it keeps no table of counts. It has learned billions of adjustable numbers that compute the scores for any text at all. Second, it does not always pick the top option. It often draws at random, weighted by the probabilities. That is why the same question can get slightly different replies.

One thing it never does is look facts up. "Paris" comes out because that continuation was overwhelmingly likely in the text it learned from. When the likeliest continuation happens to be wrong, the model writes it in the same fluent, confident tone.

> **Key idea:** A language model is a program that, given some text, gives a probability to every possible next piece and picks one, repeating until it has written a reply.

**In DeepSeek Harness:** the model does not run inside the harness. It runs on a provider's servers, and the harness is the program around it that sends text in and decides what to do with what comes back.

## What you have now

You know that a model writes a reply by predicting one piece of text at a time, with a probability for every choice. Your toy cut text at the spaces, but real models do not work in whole words. So what exactly is the piece a model predicts?
