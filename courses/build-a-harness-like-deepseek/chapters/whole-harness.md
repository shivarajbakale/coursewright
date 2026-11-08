# The whole harness: every part working together

You built mini-dsh one part at a time: a kernel, a record, an adapter, a tool pipeline, a sandbox, context management, agents and surfaces. Outcome checks proved that the work happens. Each lesson looked at one part. When a program sends one prompt, which parts does it touch, and in what order?

## A letter through the post

Think of a letter from a city to a village. A post box takes it, a sorting office reads the address, a van carries it, and a carrier puts it through the door. No part knows the whole route. Each part does its own job and hands the letter on. In the harness, the letter is one prompt, and each office is one layer.

The comparison differs in one way. A letter goes one way, but a prompt makes a round trip. Every office writes a note in one shared record as the prompt passes.

## The layers

```inkling
title "Every layer of mini-dsh and dsh"
layout stack
- Surfaces
  - mini-dsh src/sdk-server.ts, headless.ts
  - dsh sdk/server, bundle/headless, acp, api
- Agents
  - mini-dsh src/loop.ts
  - dsh core/agent, core/agent-loop
- Context
  - mini-dsh system prompt and compaction plugins
  - dsh core/system-prompt, compaction-basic
- Tools and sandbox
  - mini-dsh src/tools.ts
  - dsh core/tools, sandbox-policy, terminal-bash
- Model
  - mini-dsh src/llm.ts
  - dsh llm/llm, llm-retry, llm-deepseek
- Session record
  - mini-dsh src/session.ts
  - dsh core/session, session-persistence-jsonl
- Plugin kernel
  - mini-dsh src/kernel.ts
  - dsh vendor/cordis, boot/app-boot
brace surfaces..agents "drive the loop"
steps auto
```

Every layer is a plugin row in a profile. The kernel at the bottom mounts all of them, and each layer reaches the others only through services and events on the context.

## One request, layer by layer

A program runs `dsh --profile sdk-minimal` and sends `session/prompt` with "How many lines are in notes.txt?".

1. Boot the kernel. The package `packages/boot/app-boot` builds the root context, and the Loader mounts the rows in `packages/bundle/sdk-minimal/cordis.patch.yml`.
2. Read the request line. The package `packages/sdk/protocol` parses the JSON-RPC line. Then `packages/sdk/server` calls `ctx.agents.create` and then `followup` (`server.ts` line 279).
3. Open the turn. `packages/core/agent-loop/src/agent.ts` appends `turn/start` (line 336) to the record in `packages/core/session`. The SDK server forwards it as `session.event`.
4. Prepare the step. The loop resolves the tools (line 292). It assembles the system prompt from `packages/core/system-prompt` (line 294). The package `packages/compaction/compaction-basic` checks on `agent/pre-step` that the request fits the context window.
5. Build the request. The loop appends `system/message` and `user/message`. Then it derives the messages from the record (line 728). The package `packages/session/session-checkpoint-policy` flushes the JSONL file on `llm/stream`, before the call.
6. Call the model. `packages/llm/llm-deepseek` sends `POST https://api.deepseek.com/anthropic/v1/messages` (`adapter.ts` line 142). Its events become stream chunks, live frames go out, and `assistant/message` stores the tool call.
7. Run the tool. The package `packages/core/tools` runs the pre-execute policies first. Then it runs `bash` through `packages/terminal/terminal-bash` under `packages/sandbox/sandbox-policy`. Last come the post-execute listeners. `tool/result` stores `42`.
8. Repeat the step. Steps 4 to 6 run again with the result, and the model answers "notes.txt has 42 lines.".
9. Close the turn. The loop appends `turn/end` with reason `completed` (line 422), and `session.status` tells the client the agent is idle.

If the provider returns 429 in step 6, `packages/llm/llm-retry` handles `agent/request-error` and writes `llm/retry`. If a fact is missing from the record, a replay of this run fails, because every model-visible fact is logged first.

> **Key idea:** The whole harness is a stack of plugins on one kernel; one request passes through each layer, and every layer writes one shared record.

## How dsh does it

The `sdk-minimal` profile shows the stack in 37 rows. Its own comment says it "does not layer over dsh-base", so the insert is the complete tree. It mounts `sdk-jsonrpc-server`, `llm-deepseek`, `sandbox-policy` in mode `danger-full-access`, `terminal-bash`, `session`, `system-prompt`, `tools`, `agent`, `llm-retry`, `agent-loop`, `compaction-basic`, `sessions` and `session-checkpoint-policy`. It mounts no approval row, so a tool call that asks a person is denied (`packages/core/tools/src/pipeline.ts`, line 436). A different profile changes rows, not code.

## What you have now

Every concept in this course is one layer or one rule in this stack, from the record to the surfaces. mini-dsh has the same shape as dsh, so you can read any dsh package and know which layer it fills. The open question is your own: which layer will you replace first, and which test will prove it still works?
