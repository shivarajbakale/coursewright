# Base pack: rules every expert shares

You can now build an expert as an object. Soon there will be three of them. Each must say when it is unsure, refuse to print a key, and log every tool call. Do you copy those rules into each expert?

Copying has a cost. Imagine a company where each team writes its own safety poster. One day the rule changes, and someone must edit every poster. One team forgets, and its poster stays old. A better plan is one safety handbook that every team receives first. Each team then adds only the pages about its own work.

The handbook is like a base pack in one way: everyone gets the same text. It differs in one way. A paper handbook is read by people who can use judgement. A base pack is code, and it runs the same way every time, even when the rule does not fit.

A **base pack** is one shared package that every expert loads first. It holds the rules all experts follow. A domain pack, such as the SQL pack, adds only its own role, tools and gates. When you fix the base, the fix reaches every expert at once.

Here is `packs/base/extension.ts`. It does four jobs:

```ts
import { createBashTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const keep = ["PATH", "HOME", "LANG", "KUBECONFIG"];

export default function base(pi: ExtensionAPI) {
  // 1. House rules, as a named section of the system prompt.
  pi.on("before_agent_start", (event) => {
    event.systemPromptOptions.sections.house_rules =
      "Say when you are unsure. Never print keys or passwords.";
  });

  // 2. A shared gate, and a start time for the log.
  const started = new Map<string, number>();
  pi.on("tool_call", (event) => {
    started.set(event.toolCallId, Date.now());
    if (JSON.stringify(event.input).includes("DEEPSEEK_API_KEY"))
      return { block: true, reason: "Tool arguments may not mention secret names." };
  });

  // 3. The run log: stored in the session, not sent to the model.
  pi.on("tool_result", (event) => {
    const ms = Date.now() - (started.get(event.toolCallId) ?? Date.now());
    pi.appendEntry("fleet-log", { tool: event.toolName, ms });
  });

  // 4. Bash with a scrubbed environment.
  const bash = createBashTool(process.cwd(), {
    spawnHook: ({ command, cwd, env }) => ({ command, cwd,
      env: Object.fromEntries(keep.filter((k) => env[k]).map((k) => [k, env[k]])) }),
  });
  pi.registerTool({ ...bash, execute: async (id, params, signal, onUpdate) =>
    bash.execute(id, params, signal, onUpdate) });
}
```

The four parts do these jobs:

- The house rules become a section named `house_rules`. pi writes the section into the system prompt between `<house_rules>` tags.
- The gate blocks any call whose arguments contain the name `DEEPSEEK_API_KEY`. It also records when each call started.
- The log handler stores the tool name and its time as an entry called `fleet-log`. The entry is in the session file, and the model never sees it.
- The bash tool gets only four variables: `PATH`, `HOME`, `LANG` and `KUBECONFIG`. The key never reaches a command.

Order matters. Handlers run in load order, and the first `tool_call` handler that blocks ends the chain. So the base must load first. Then its gates run before any domain gate, and a domain pack cannot skip them. Every expert loads it first:

```sh
pi -e packs/base/extension.ts -e packs/sql/extension.ts
```

In the SDK, you write the same thing as `extensionFactories: [base, sql]`.

```inkling
title "Domain packs on a shared base"
layout stack
- Domain pack
  - SQL pack
  - Kubernetes pack
  - Quant pack
- Base pack
  - House rules
  - Secret guard
  - Run log
  - Scrubbed bash
- pi
step 1: pi "pi provides the loop, the tools and the events"
step 2: base-pack "The base pack adds what every expert needs"
step 3: house-rules, secret-guard, run-log, scrubbed-bash "It holds four shared parts"
step 4: domain-pack "Each domain pack adds only its role, tools and gates"
```

> **Key idea:** A base pack holds the rules every expert shares. It loads first, so a fix reaches all experts and its gates run first.

## How pi does it

- Extension handlers run in load order, then registration order (packages/coding-agent/docs/extensions.md:412-425). The first `tool_call` handler that blocks ends the chain (packages/coding-agent/src/core/extensions/runner.ts:1249-1266).
- An extension adds a prompt section in `before_agent_start` by setting `event.systemPromptOptions.sections.<name>` (packages/coding-agent/examples/extensions/prompt-customizer.ts:40-48). Sections become `<name>...</name>` (packages/coding-agent/src/core/system-prompt.ts:183-190).
- `pi.appendEntry(customType, data)` stores data in the session without sending it to the model (packages/coding-agent/src/core/extensions/types.ts:1771).
- pi's preset example shows named sets of model, tools and instructions (packages/coding-agent/examples/extensions/preset.ts:388-394).

## What you have now

You have a base pack: house rules, a secret guard, a run log and a scrubbed bash, loaded before every domain pack. Each expert now adds only what differs. When a task arrives, who decides which expert takes it?
