# Agent harness: the program wrapped around the model

The last lesson showed a loop: the program asks the model, runs the tool the model asks for, sends the result back, and repeats. But the model only writes tokens. It cannot run that loop, open a file or decide when to stop. So which part does all of that?

Picture a skilled worker in a closed room. They cannot leave, but they can write notes. Around the room is a workshop. An assistant carries questions in, a cupboard holds tools, a briefing sheet states the job, a logbook records each step, and a supervisor forbids some actions. The worker supplies the thinking. The workshop decides what reaches them and what happens next.

The comparison differs in one way. The workshop staff understand the task and can bend a rule when the situation calls for it. A harness is a program. It follows the code its author wrote, even when that code is a poor fit.

Take one model and two harnesses. The task is "list the files in this folder".

Harness A sends a fixed opening instruction that says "Answer from memory" and offers no file tool. The model can only write text, so it writes a guess. Nothing checks the guess.

Harness B sends opening instructions that say "Inspect the project folder before you answer" and offers a tool schema for `list_files`. The exchange runs in order:

1. The harness sends the opening instructions, the question and the tool schema.
2. The model replies with a tool call to `list_files`.
3. The harness checks the call, runs it and gets `README.md` and `src`.
4. The harness sends that tool result back.
5. The model writes its answer from the real names.

Same model, two harnesses, two different agents. Nothing in the model changed. The instructions and the tools did.

```inkling
title "The harness around the model"
layout stack
- You
- The harness
  - The loop
  - The tools
  - The system prompt
  - The record
  - The limits
- The model
step 1: you "You give the harness a task"
step 2: the-model "The model reads text and predicts the next token"
step 3: the-harness "The harness is the program around the model"
step 4: the-loop, the-tools "It runs the loop and offers the tools"
step 5: the-system-prompt "The opening instructions give the role and rules"
step 6: the-record, the-limits "It keeps the record and enforces the limits"
```

The program in the picture is the **agent harness**, or harness for short. The harness owns the loop, the tools, the instructions and the record of the conversation, and it sets the limits on what the agent may do. The instructions it sends first in every request are the **system prompt**. The system prompt tells the model its role and its rules.

> **Key idea:** The model predicts tokens; the harness decides which tools exist, what the model is told, what is recorded and what is allowed.

## How pi does it

pi calls itself "a coding agent harness". Its default system prompt opens: "You are a coding assistant running inside pi, a coding agent harness. Help users inspect files, run commands, and modify code." (packages/coding-agent/src/core/system-prompt.ts:155-156). Its default tools are read, bash, edit and write (packages/coding-agent/src/core/system-prompt.ts:64). To see a harness at work, run `pi --model deepseek/deepseek-flash -p "List the files here"`; pi runs one task and prints the answer.

## What you have now

You can now separate the two halves of an agent: the model, which only predicts tokens, and the harness, which runs the loop, offers the tools, writes the system prompt, keeps the record and enforces the limits. Because the harness holds all of these, changing it changes the agent without changing the model. Since the harness keeps a record of the conversation, the next question is where that record goes and what it makes possible.
