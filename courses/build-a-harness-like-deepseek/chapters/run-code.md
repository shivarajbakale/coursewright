# Programmatic tool calling: the model writes code that calls tools

With skills, long instructions reach the model only when it asks. But every tool call still costs one step. To count the lines in 40 files, the model asks for one read, waits, gets the whole file into the history, and asks again. That is 40 steps, and 40 file texts the model must carry for the rest of the session. The work is a loop, and programs are good at loops. Could the model write the loop itself?

## A shopping list for a runner

Think of a cook who needs 40 items from a shop. The cook can phone the runner 40 times: "bring flour", wait, "now eggs", wait. Or the cook can write one list with rules: "for each item on this list, buy it; if a shop is out, skip it; bring back the total cost." The runner walks the list alone and comes back with one short answer.

In the harness, the cook is the model, the runner is a program the model writes, and the shop is the set of tools. This is **programmatic tool calling**, or **PTC**: the model writes a program, and the program calls the tools. The comparison differs in one way: the runner here is a real process that runs code, so every rule for running commands still applies. The program runs in its own Node process under the sandbox, and every tool it calls passes the same checks as a direct call.

## One tool replaces the others

In PTC mode, the model is offered exactly one tool, `run_code`, with two arguments: `code` and a short `description`. The system prompt lists the other tools as functions the program may call, such as `await tools.read({ file_path })`. A direct call to any other tool fails with a message that says to call it from inside a program.

The tool registry lets one plugin replace the part that describes and runs tools, called the executor. In mini-dsh, `src/ptc.ts`:

```ts
export class PtcExecutor implements ToolExecutor {
  constructor(private readonly ctx: Context) {}

  describe(): ToolSchema[] {
    return [runCodeSchema]              // the model sees only run_code
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    if (call.name !== 'run_code') {
      throw new Error(`only run_code is callable directly; call ${call.name} from inside a run_code program`)
    }
    return runProgram(call.input.code, this.ctx)   // starts a Node process for the program
  }
}

ctx.get<ToolsService>('tools')!.setExecutor(new PtcExecutor(ctx))
```

Here is a program the model might send as `code`:

```ts
const { paths } = await tools.glob({ pattern: 'notes/*.txt' })
let total = 0
for (const file_path of paths) {
  const { text } = await tools.read({ file_path })
  total += text.split('\n').length
}
return { files: paths.length, total }
```

Trace it:

1. Step 1: the model calls `run_code` with this program. The harness starts a process for it.
2. The program calls `glob` once and `read` 40 times. Each call goes back to the harness, which runs the real tool.
3. The program returns `{ files: 40, total: 3120 }`. Only this value becomes the tool result, about 10 tokens.
4. Step 2: the model answers "The 40 notes have 3,120 lines."

```inkling
title "Forty reads, two ways"
layout compare
columns "One call per step", "One program"
row "Model steps": "41", "2"!
row "File texts in history": "40 files", "none"!
row "Same checks per call": yes, yes
steps auto
```

Only what the program returns or prints reaches the model. So the program can read large files, keep the few facts that matter, and leave the rest out of the context window.

> **Key idea:** In programmatic tool calling, the model calls one run_code tool with a program, and the program calls the other tools.

## How dsh does it

```inkling
title "PTC packages in dsh"
executor: box "tool-executor-ptc"
tools: box "ctx.tools"
runtime: box "ctx.ptcRuntime"
node: box "ptc-runtime-node"
executor -> tools : "setExecutor()"
executor -> runtime : "run program"
runtime -> node : "Node process"
steps auto
```

`packages/core/tool-executor-ptc/src/index.ts` defines `PtcExecutor` and installs it with `ctx.tools.setExecutor()` (line 113). `describe()` returns only the `run_code` schema (lines 47-49). Any other direct call fails with "only `run_code` is callable directly" (lines 41-43). The schema is in `src/ptc.ts` (lines 301-316): `code`, `description`, and optional `timeoutMs`, `sandbox_permissions` and `justification`. `packages/ptc-runtime/ptc-runtime` defines the runtime service, and `packages/ptc-runtime/ptc-runtime-node` runs the program in a Node process with a default timeout of 120,000 ms (`src/config.ts`, line 38).

## What you have now

The model can now do a loop of tool calls in one step, inside a separate process. Two questions follow. How does the model know the exact functions and argument types it may call? And how does a call made inside another process reach the harness and come back?
