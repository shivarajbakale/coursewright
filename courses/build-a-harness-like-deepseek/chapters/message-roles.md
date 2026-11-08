# Message roles: who said each part of a chat

A model API call sends a list called `messages`, and each item has a `role`. A model only continues text. So how does it know which lines are your question, which lines it wrote before, and which lines are the rules it must follow?

## A script with speaker names

Think of a play script. Each line starts with the speaker's name, as in "ANNA: Where were you?". Before the first scene, a note from the director says how the play must be acted: "Anna is angry but quiet." The actors read the note once and follow it in every scene.

A chat request is such a script. Each message carries a **role**: the speaker's name. The role tells the model who said what. There are three roles:

- `user`: text from the person, or from the program on their behalf.
- `assistant`: text the model wrote in an earlier reply.
- `system`: the director's note. This text is the **system prompt**: instructions that apply to the whole conversation, such as "answer in one short sentence".

The comparison differs from the field in one way. Actors understand the note. The model only predicts the next tokens, and it learned that text after "assistant" usually follows the system prompt and answers the last user message. It usually does, but nothing forces it.

In the request format DeepSeek uses, the system prompt does not go inside `messages`. It goes in its own `system` field at the top of the body. The list then holds only `user` and `assistant` messages, starting with `user`.

## The same question, two scripts

Add a system prompt to `callModel`:

```ts
// src/llm.ts
const SYSTEM = 'You are a careful assistant. Answer in one short sentence.'

// inside callModel, the body becomes:
body: JSON.stringify({ model: 'deepseek-flash', max_tokens: 1024, system: SYSTEM, messages }),
```

Now send a script with earlier messages in it:

```ts
const reply = await callModel([
  { role: 'user', content: 'What is the capital of France?' },
  { role: 'assistant', content: 'The capital of France is Paris.' },
  { role: 'user', content: 'And of Italy?' },
])
// reply.content[0].text: "The capital of Italy is Rome."
```

1. Read the system prompt first. It asks for one short sentence, so the reply has one sentence.
2. Read the first user message. It sets the topic: capitals.
3. Read the assistant message. The model treats it as its own earlier answer. That answer gives the pattern "The capital of X is Y."
4. Read the last user message. "And of Italy?" makes sense only because the earlier messages give the topic.

You wrote the assistant message yourself, and the model accepts it as its own. This shows what a role is: a label in the text, not a record the model keeps. You can use this to show the model an example answer before the real question.

```inkling
title "What one chat request holds"
layout mindmap
- The request
  - system: the rules
  - messages
    - user: the question
    - assistant: an earlier answer
    - user: the next question
step 1: the-request "One request carries everything"
step 2: system-the-rules "The system prompt sets rules for the whole chat"
step 3: messages "The messages list says who said each part"
step 4: assistant-an-earlier-answer "An assistant message is the model's earlier text"
```

> **Key idea:** Each message carries a role, user or assistant, and the system prompt holds the rules for the whole conversation.

DeepSeek Harness uses more roles inside its own code than the request format has. Its file `packages/llm/llm/src/message.ts` (lines 152-174) defines `system`, `developer`, `user`, `assistant` and `tool`. Before each request, `packages/llm/llm-deepseek/src/serialize.ts` turns these into DeepSeek's format. It joins the system text into the top-level `system` field (line 151), and it sends `tool` messages with the role `user` (line 125). Later lessons explain the extra roles.

## What you have now

A request is a system prompt plus a list of user and assistant messages, all counted against the context window. In the example you wrote the earlier answer into the request yourself. Does the model remember the previous request, or must the program always send the earlier messages?
