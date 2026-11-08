# SDK session: an expert as an object in your program

RPC works, but each expert is a separate process, and your program talks to it through lines of text. With three experts that means three processes to start, watch and close. Is there a way to hold an expert as an ordinary value in your code?

Think of a tool cupboard. With RPC, each tool is in a shed across the yard, and you walk there and pass notes. With a cupboard in your own room, each tool hangs on a labelled hook. You take one down and use it. The cupboard differs from pi in one way. The tools in a cupboard are separate things, but experts in one program share some limits, such as the number of codemode workers.

The cupboard is the **SDK**: a library that lets your code use a product directly. The pi SDK is the package `@earendil-works/pi-coding-agent`. Its function `createAgentSession` builds one expert and returns a **session** object. You call `session.prompt(text)`, and the call finishes when the run is done. Then you read the answer.

Each expert is one session. You give `createAgentSession` what makes the expert different:

1. A resource loader, which holds the system prompt and the extensions.
2. A tool list, which names the tools the expert may use.
3. A model.
4. A session folder, where this expert's session files go.

Here is a small function that builds one expert. You will use the same shape for all three experts of `fleet`:

```ts
import { readFileSync } from "node:fs";
import { createAgentSession, DefaultResourceLoader, ModelRuntime,
  SessionManager, type ExtensionFactory } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel("deepseek", "deepseek-flash");

export async function makeExpert(name: string, promptFile: string,
  factory: ExtensionFactory, tools: string[]) {
  const cwd = process.cwd();
  const agentDir = `${cwd}/agents/${name}`;
  const loader = new DefaultResourceLoader({
    cwd, agentDir,
    systemPromptOverride: () => readFileSync(promptFile, "utf8"),
    appendSystemPromptOverride: () => [],
    extensionFactories: [factory],
  });
  await loader.reload();
  const { session } = await createAgentSession({
    cwd, agentDir, model, tools, resourceLoader: loader,
    sessionManager: SessionManager.create(cwd, `${agentDir}/sessions`),
  });
  return session;
}
```

Read it in four parts. The loader replaces pi's opening text with the file you name. The line `appendSystemPromptOverride: () => []` stops pi from adding any extra files. `extensionFactories` takes extension functions directly, so the extension needs no file on disk. `SessionManager.create` puts this expert's sessions in its own folder, so `agents/sql/sessions` holds only SQL sessions.

Now use it:

```ts
const sql = await makeExpert("sql", "packs/sql/prompt.md", sqlPack,
  ["read", "sql_schema", "sql_query"]);
await sql.prompt("Total revenue in 2025?");
console.log(sql.getLastAssistantText());
```

`prompt` resolves after the run. You do not wait for an event, as you did with RPC. For live events, call `session.subscribe(fn)`. To stop a run, call `session.abort()`. When you finish with the expert, call `session.dispose()`.

```inkling
title "One program, three experts"
layout stack
- Your program
  - SQL session
  - Kubernetes session
  - Quant session
- pi-coding-agent
- pi-ai
step 1: your-program "Your program builds one session per expert"
step 2: sql-session, kubernetes-session, quant-session "Each session has its own prompt, tools and session folder"
step 3: pi-coding-agent "All sessions run on the same library"
step 4: pi-ai "pi-ai carries the calls to the model"
```

> **Key idea:** The SDK builds each expert as a session object with its own prompt, tools, model and session folder, so one program holds several experts.

Two limits matter. An SDK session does not load MCP or codemode unless you add `createMcpExtension()` and `createCodemodeExtension()`. And experts in one process share a codemode limit of 2 workers. Raise it with the environment variable `PI_CODEMODE_MAX_WORKERS`.

## How pi does it

- The options of `createAgentSession` are listed in packages/coding-agent/src/core/sdk.ts:48-106. They include `cwd`, `agentDir`, `model`, `tools`, `customTools`, `resourceLoader` and `sessionManager`.
- The prompt override comes from pi's own example (packages/coding-agent/examples/sdk/03-custom-prompt.ts:18-31). Inline extensions come from packages/coding-agent/examples/sdk/06-extensions.ts:26-37.
- The calls `prompt`, `getLastAssistantText`, `subscribe`, `abort` and `dispose` are listed in packages/coding-agent/docs/sdk.md:64-70.
- MCP and codemode need extra extensions (packages/coding-agent/docs/sdk.md:116). The worker limit of 2 is in packages/coding-agent/src/extensions/codemode/execute.ts:57-64.
- `SessionManager.create(cwd, sessionDir)` is in packages/coding-agent/src/core/session-manager.ts:1766-1815.

## What you have now

You can build an expert as an object: one function call gives you a session, and `prompt` runs a task to the end. This joins the extension, which you pass as a factory, to the run modes, where the SDK was the way with no process to start. Each expert will need the same house rules. Where do rules that every expert shares belong?
