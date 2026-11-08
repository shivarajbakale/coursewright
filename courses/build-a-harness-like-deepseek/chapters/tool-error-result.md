# Tool error result: a failure the model can read

The model asks for `count_lines` on `notes.txt`, but the file is in a folder called `docs`. The call to `readFile` throws "ENOENT: no such file or directory, open 'notes.txt'". In the loop so far, that exception ends the whole program in the middle of a turn. The model asked a reasonable question, and it never learns what went wrong. What should the program do instead?

## A note from the kitchen

Think of the restaurant. You order the fish, and the kitchen has none left. A good kitchen does not close the restaurant. It sends a note back with ticket 7: "No fish today." You read the note and order the chicken instead.

A **tool error result** is that note. When a tool fails, the program still sends a `tool_result` for the call, with the same call id. Its `content` describes the failure, and the field `is_error: true` marks it as a failure.

The model reads the error like any other result. Then it decides what to do next. It can try other arguments, use a different tool, or tell the user. The comparison differs in one way: a diner understands "no fish", but the model only gets what the text says. A clear message with the cause, such as the missing path, leads to a better next request.

## The missing file

Add the field to the block type, and catch the failure in the loop:

```ts
// src/llm.ts: the result block gains is_error
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

// src/loop.ts, inside the for loop over the reply's blocks
if (block.type === 'tool_use') {
  try {
    const output = await runTool(block.name, block.input)
    results.push({ type: 'tool_result', tool_use_id: block.id, content: output })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${message}`, is_error: true })
  }
}
```

Bad arguments are failures too, so `runTool` checks them before it reads anything:

```ts
// src/tools.ts, at the start of the count_lines branch
if (typeof input.path !== 'string') throw new Error('invalid arguments: path must be a string')
```

Now trace the turn:

1. Run step 1. The model asks for `count_lines` with `{ "path": "notes.txt" }`.
2. Catch the exception. The program sends a result with `is_error: true` and the text "Error: ENOENT: no such file or directory, open 'notes.txt'".
3. Run step 2. The model reads the error and asks for `count_lines` with `{ "path": "docs/notes.txt" }`. The program gets `42`.
4. Run step 3. The model replies "docs/notes.txt has 42 lines." and the turn ends.

```inkling
title "Two ways to handle a failing tool"
layout compare
columns "Let it throw", "Send an error result"
row "Program keeps running": no, yes!
row "Every call has a result": no, yes
row "Model can try again": no, yes
step 1: let-it-throw "An exception ends the turn"
step 2: send-an-error-result "The failure goes back as a result"
step 3: model-can-try-again "The model reads it and tries other arguments"
```

Sending an error result also keeps the conversation valid. As the tool result showed, every tool call needs a result in the next message. A crash leaves a call with no answer.

Not every exception belongs in a tool result. A failed model request, for example a wrong API key, is not a tool failure. The model cannot fix it, so that error still ends the turn. The rule: a failure inside a tool goes back to the model, and a failure of the program itself goes to the user.

> **Key idea:** A tool error result reports a tool's failure as a result marked is_error, so the model can read it and try again.

## How dsh does it

dsh turns every tool failure into a result in `packages/core/tools/src/pipeline.ts`. Its `toolErrorResult` function (line 695) writes the text `Error: <message>` and sets `isError: true`. A tool name that does not exist becomes the error `unknown tool "<name>"` (line 273). DeepSeek Harness checks the arguments against the tool's schema before the tool runs, and a mismatch becomes `invalid arguments: ...` (`src/schema.ts`, line 600). `packages/llm/llm-deepseek/src/serialize.ts` sends the mark as `is_error` (line 121).

## What you have now

Your loop now survives a failing tool. The failure goes back as a result with the same call id, and the model can try again within the step limit. You have every piece of an agent: a stateless model call, roles, tool schemas, tool calls, tool results and the loop that joins them. What does the whole program look like in one place?
