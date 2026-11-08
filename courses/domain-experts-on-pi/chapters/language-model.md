# Language model: a program that writes the next likely word

You type a sentence into a chat box and press Enter. A reply appears, one word after another. Something must decide what each next word is. What kind of program can do that?

Think of a friend who finishes your sentences. You say "The capital of France is", and the friend says "Paris" before you finish. The friend has heard that sentence many times, so the answer comes from habit.

A language model works in a similar way: it learns from a great deal of text which piece usually comes next. One difference matters. Your friend understands the sentence and wants to help. The model has no goal and no memory of its own. It only continues the text in front of it.

The model works in small steps. It reads the text it is given. It predicts the most likely next piece. It writes that piece, adds it to the text, and reads the longer text again. Each new piece changes what comes next.

Here is a small example. Start with this prompt:

```
The capital of France is
```

The model reads the prompt and returns the piece " Paris". The text is now "The capital of France is Paris". The model reads that longer text and returns ".". The text is now "The capital of France is Paris.". The model reads it again and returns a marker that means the text is finished. The reply is complete.

Each step uses the text so far, including the model's own earlier output. This is why a model can write a whole paragraph from a short prompt. It can also write a wrong sentence with the same confidence, because it predicts a likely next piece, not a true one.

This loop is the whole mechanism. The model predicts one token, the token joins the text, and the longer text goes back to the model.

```inkling
title "One token at a time"
layout flow
prompt: box "Prompt"
model: box "Language model"
token: box "Next token"
text: box "Text so far"
prompt -> model : "the text you give"
model -> token : "predict one"
token -> text : "add it"
text -> model : "read again"
step 1: prompt, model "You give the model a prompt"
step 2: token "The model predicts one likely next token"
step 3: text "The token joins the text, which goes back to the model"
```

## The words for it

A token is a piece of text the model reads and writes: a word or part of a word. The text you give the model is the prompt. The model takes a prompt and returns the next likely token.

> **Key idea:** A language model reads a prompt and adds one likely next token at a time; on its own it has no goal.

A model that only continues text cannot decide to look up a fact, run a command or stop with a result. To do work, a program must surround the model. The program gives it a task, the text it may read and a way to act. This course builds such programs on an open-source program called pi.

## What you have now

You have the base the whole course rests on. A language model takes a prompt and returns one likely next token at a time. It has no goal and no memory, so a program must give it work and surround it. The next question is how much text the model can read at one time.
