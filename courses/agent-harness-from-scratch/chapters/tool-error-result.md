# Tool error result: telling the model a request failed

A user asks "What does note.txt say?" The file is really called `notes.txt`. The model asks for `read_file` with `{"path":"note.txt"}`, and `readFile` throws. Right now that exception escapes `runTurn` and crashes your program. The conversation is lost, and the model never learns what went wrong. What should happen instead?

```inkling
title "A failed tool call returns a result"
layout down
model: box "Model"
call: sticky "Call id 7\nread_file"
run: box "runCall"
error: sticky "Error: read_file failed\nENOENT: note.txt"
result: sticky "Tool result\nCall id 7"
reply: box "Model's next step"
step 1: model, call "The model asks for read_file"
step 2: run "The call goes to runCall"
step 3: error "runCall catches the exception"
step 4: result "The error becomes the result text"
step 5: reply "The model can adjust its next request"
run -> error
error -> result
result -> reply
```

## The clerk comes back empty-handed

Think of the clerk from the archive again. Asked for a file that is not there, a good clerk does not walk out of the building. They come back with the ticket and a note: "No file by that name. There is one called notes.txt." The manager reads it and decides what to do next.

Your program should do the same. When a tool fails, it still sends a tool result for that call id. The content says the request failed, and why. The model reads that like any other result and can recover: fix the path, try another approach, or ask the user.

The picture stops holding in one way. A clerk's note can be vague, because the manager can ask a follow-up. The model sees only your text, so the message has to carry everything: what failed, and what would work instead.

## Every way a call can fail

Three things can go wrong with a tool call, and each still gets exactly one result:

1. The name is not one of your tools.
2. The `arguments` string is not valid JSON.
3. The tool itself throws, for example a missing file.

Put all three in one function, so the loop never sees an exception from a tool.

```ts
// src/tools.ts (add)
import type { Tool, ToolCall } from './types.ts'

export async function runCall(call: ToolCall, tools: Tool[], signal: AbortSignal): Promise<string> {
  const tool = tools.find((t) => t.name === call.name)
  if (!tool) {
    return `Error: there is no tool named "${call.name}". Available tools: ${tools.map((t) => t.name).join(', ')}.`
  }
  let args: unknown
  try {
    args = JSON.parse(call.arguments)
  } catch {
    return `Error: the arguments are not valid JSON: ${call.arguments}`
  }
  try {
    return await tool.execute(args, signal)
  } catch (err) {
    return `Error: ${call.name} failed: ${(err as Error).message}`
  }
}
```

In `runTurn`, the three lines that found, parsed and ran the tool become one:

```ts
const output = await runCall(call, tools, new AbortController().signal)
history.push({ role: 'tool', toolCallId: call.id, content: output })
```

Each failure message starts with `Error:`. DeepSeek's `tool` message has no separate field to flag a failure, so the text itself must say it.

Now trace the typo, in a folder holding only `notes.txt`.

1. Step 1. The model asks for `read_file` with `{"path":"note.txt"}`. `readFile` throws. `runCall` catches it and returns `Error: read_file failed: ENOENT: no such file or directory, open 'note.txt'`. That becomes the result for the call id.
2. Step 2. The model reads the error. It might ask for `notes.txt`, guessing the plural. Or it might reply "I could not find note.txt. Did you mean another file?" Either way the turn ends with an answer, not a crash.

The step limit still guards this. A model that keeps getting errors and keeps asking will stop at `maxSteps`.

Write errors for the model, not for a log file. "Failed" alone gives it nothing to act on. "There is no tool named read_files. Available tools: read_file." tells it exactly how to fix its next request.

> **Key idea:** A tool error result is an ordinary tool result, paired by call id, whose text says the request failed and why, so the model can adjust instead of the program crashing.

**In DeepSeek Harness:** a result message carries an `isError` flag (`ToolResultMessage` in `packages/llm/llm/src/message.ts`). The code that runs every tool catches anything a tool throws and turns it into an error result (`packages/core/tools/src/pipeline.ts`), and an unknown name fails with the code `UNKNOWN_TOOL` (`packages/core/tools/src/contracts.ts`).

## What you have now

You have a working agent: a model call, tools described by schemas, a loop that runs each call and returns its result, turns made of capped steps, and failures reported to the model instead of crashing. All of it lives in one array in memory. When the program exits, the whole conversation is gone. How should an agent record what happened, so nothing is lost?
