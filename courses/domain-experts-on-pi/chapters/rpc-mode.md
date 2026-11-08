# RPC mode: JSON lines to a long-running pi

A program can start pi once and keep it running. Now it needs a way to talk to it. How does it send a task, and how does it know the task is finished?

Think of a restaurant kitchen with a hatch. You push an order slip through the hatch, and the cook sends back a ticket that says "order received". The meal comes later. The ticket does not mean the meal is ready. You wait for the bell.

The picture differs from pi in one way. In a kitchen you see and smell the food. Your program learns that work is done only from a message, so it must watch for the right one.

pi has a mode for this. You start it with `pi --mode rpc`. In **RPC mode** pi stays running, reads commands from its standard input and writes responses and events to its standard output. These two streams are called **stdio**: a process's standard input and standard output. RPC stands for remote procedure call, which means asking another program to run a task for you.

The format is simple. Each message is one JSON object on one line, and a line ends with the LF character, the plain newline. Every message has a `type` and may have an `id`. This is not JSON-RPC 2.0. There is no `jsonrpc` field and no `method` field.

Your program sends commands. There are 33 command types, including `prompt`, `steer`, `follow_up`, `abort`, `get_state`, `set_model`, `compact`, `get_session_stats`, `get_last_assistant_text` and `new_session`. Here is one exchange. Lines that start with `>` go to pi, and lines that start with `<` come back:

```text
> {"id":"req-2","type":"prompt","message":"Review this repository"}
< {"id":"req-2","type":"response","command":"prompt","success":true,"data":{"disposition":"started"}}
< {"type":"agent_start"} ...
< {"type":"agent_settled","aborted":false}
> {"id":"r3","type":"get_last_assistant_text"}
< {"id":"r3","type":"response","command":"get_last_assistant_text","success":true,"data":{"text":"..."}}
```

The response to `prompt` is the ticket. Its `disposition` says `started`, `queued` or `handled`. It tells you pi accepted the order. It says nothing about the answer. The bell is the `agent_settled` event. After it arrives, the work is done, and you can ask for the text with `get_last_assistant_text`.

Here is the same exchange in TypeScript. It starts the SQL expert as a child process with the same flags you used by hand:

```ts
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const pi = spawn("pi", ["--mode", "rpc", "--model", "deepseek/deepseek-flash",
  "--system-prompt", "packs/sql/prompt.md", "-e", "packs/sql/extension.ts",
  "--tools", "read,sql_schema,sql_query"],
  { env: { ...process.env, PI_CODING_AGENT_DIR: "agents/sql" } });
const lines = createInterface({ input: pi.stdout });
const send = (cmd: object) => pi.stdin.write(JSON.stringify(cmd) + "\n");

function waitFor(test: (m: any) => boolean): Promise<any> {
  return new Promise((resolve) => {
    const on = (line: string) => {
      const m = JSON.parse(line);
      if (test(m)) { lines.off("line", on); resolve(m); }
    };
    lines.on("line", on);
  });
}

async function ask(message: string): Promise<string> {
  const settled = waitFor((m) => m.type === "agent_settled");
  send({ id: "p1", type: "prompt", message });
  await settled;
  const reply = waitFor((m) => m.id === "r1");
  send({ id: "r1", type: "get_last_assistant_text" });
  return (await reply).data.text;
}
```

The `ask` function listens for `agent_settled` before it sends the prompt. If it listened after, a fast run could finish first and the program would wait forever.

```inkling
title "One prompt over RPC"
layout sequence
host: box "Your program"
pi: box "pi in RPC mode"
host -> pi : "prompt"
pi --> host : "response: started"
pi --> host : "events: agent_start ..."
pi --> host : "agent_settled"
host -> pi : "get_last_assistant_text"
pi --> host : "response: the text"
note pi "the ticket is not the meal"
steps auto
```

> **Key idea:** In RPC mode a prompt's response only says the work started. The work is finished when the `agent_settled` event arrives.

Two more facts matter for a long-running expert. Closing the standard input shuts pi down. And an extension can open a dialog, such as a question for a person. A dialog with no timeout waits for your program to answer an `extension_ui_request`. If your program ignores it, the expert waits forever.

## How pi does it

- Lines split on LF only (packages/coding-agent/src/modes/rpc/jsonl.ts:4-27).
- The 33 command types and the `type` and `id` shape are in packages/coding-agent/src/modes/rpc/rpc-types.ts:20-74 and :116.
- The `disposition` field is set in packages/coding-agent/src/modes/rpc/rpc-mode.ts:394-414. Completion is described in packages/coding-agent/docs/rpc.md:60-71.
- Closing stdin shuts pi down (rpc-mode.ts:802-805). A dialog with no timeout waits for the host (rpc-mode.ts:115-120).
- pi exports a TypeScript `RpcClient` (packages/coding-agent/src/index.ts:426).

## What you have now

You can drive one long-running expert from a program: send `prompt`, wait for `agent_settled`, then read the text. This rests on run mode, where RPC was the way to pay startup once. The expert still runs as a separate process, and your program talks to it through text. What if the program could hold the expert as an object and call it directly?
