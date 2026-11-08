# Code channel: how the program reaches the harness

With programmatic tool calling, the model writes a program that calls `await tools.read(...)`. Two gaps remain. The model must know the exact name, arguments and result of every function, or its program fails. And the program runs in a separate process, while the real tools run in the harness. How does a call cross from one process to the other and come back?

## A phrase book and a telephone line

Think of a traveller who calls a hotel abroad. The traveller holds a phrase book that lists every sentence the hotel understands, with the blanks to fill in. The traveller reads one sentence down the line, the clerk does the work, and the clerk answers in an agreed form.

In the harness, the phrase book is a block of TypeScript declarations in the system prompt, made from the tool schemas. The telephone line is a private pipe between the program process and the harness process. The comparison differs in one way: the clerk refuses any sentence that is not in the book. A call to a function the harness did not declare fails at once.

## The declarations

The harness turns each tool's parameters and output schema into TypeScript types, sorted by name. For mini-dsh's `glob` and `read` tools, `src/ptc-sdk.ts` renders this text:

```ts
interface ToolArgsMap {
  glob: { pattern: string };
  /** Read a text file. */
  read: { file_path: string };
}
interface ToolOutputMap {
  glob: { paths: string[] };
  read: { text: string };
}
type ToolName = keyof ToolOutputMap
declare class ToolCallError extends Error { readonly toolName: ToolName }
declare const tools: { [K in ToolName]: (args: ToolArgsMap[K]) => Promise<ToolOutputMap[K]> }
```

The text goes into a prompt section, so the model reads exact types for every call.

## The line

A call from one process to a function in another is a remote procedure call, or **RPC**. Here each message is one JSON object on one line, a format called **JSON-lines**. The harness spawns the program with a separate pipe for these messages, so the program's own printed output never mixes with them. In mini-dsh, the host side of `src/ptc-channel.ts`:

```ts
createInterface({ input: control }).on('line', async (line) => {
  const { id, method, params } = JSON.parse(line)
  if (method !== 'invoke') return
  const [, name, args] = params
  const result = await runToolThroughPipeline(name, args)
  const reply = result.isError ? { id, error: { message: result.message } } : { id, result: result.value }
  control.write(JSON.stringify(reply) + '\n')
})
```

Inside the program, `tools.read(args)` writes an `invoke` line and waits for the reply with the same `id`. Trace two calls:

1. The program writes `{"id":1,"method":"invoke","params":["tools","read",{"file_path":"notes/a.txt"}]}`.
2. The harness runs `read` and writes `{"id":1,"result":{"text":"buy milk\ncall Ana"}}`. The promise resolves with that object.
3. The program writes id 2 for `notes/missing.txt`. The tool fails, and the harness writes `{"id":2,"error":{"message":"file not found"}}`.
4. In the program, the promise rejects with a `ToolCallError` whose `toolName` is `read`. The program can catch it and continue with the next file.

```inkling
title "Two calls on the control pipe"
layout sequence
program: box "Program process"
host: box "Harness process"
program -> host : "ready"
program -> host : "invoke read, id 1"
host --> program : "result, id 1"
program -> host : "invoke read, id 2"
host --> program : "error, id 2"
program -> host : "run result"
steps auto
```

> **Key idea:** A typed list of tool functions goes into the system prompt, and each call travels as one JSON line over a private pipe.

## How dsh does it

```inkling
title "From schemas to the prompt"
layout down
schemas: box "Tool schemas"
render: box "renderToolsSdk()"
section: box "tools:sdk, order 5000"
prompt: box "System prompt"
schemas -> render -> section -> prompt
steps auto
```

`renderToolsSdk()` in `packages/core/tool-executor-ptc/src/ts-types.ts` (line 313) builds `ToolArgsMap`, `ToolOutputMap`, `ToolCallError` and `tools`. `py-types.ts` does the same for Python. `src/index.ts` (line 37) adds it as the prompt section `tools:sdk` at order `TOOLS_SDK`, 5000. `packages/ptc-runtime/ptc-runtime-node/src/rpc.ts` connects the two processes with the `birpc` library over newline-delimited JSON. It refuses a line that does not start with `{`. `src/worker.ts` (line 296) spawns the process with a separate `control` pipe beside its output. `src/protocol.ts` lists the host methods `ready`, `invoke`, `log` and `outputLimit`, and checks protocol version 2 (line 6).

## What you have now

The model knows each function's exact types, and each call crosses a private pipe as one JSON line. On the harness side, each call runs as a real tool. But a program can call tools very fast, in a loop of thousands. Do those calls pass the same checks as calls the model makes, and what stops a program from making too many?
