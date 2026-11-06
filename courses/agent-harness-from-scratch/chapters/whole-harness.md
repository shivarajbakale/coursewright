# The whole harness: every part working in one request

Every part of `minidsh` now exists, taught one concept at a time. Each lesson looked at one piece and treated the rest as a box. Now the boxes are all open. When a person types one request, which parts does it touch, in what order, and where does each part live in DeepSeek Harness? This lesson adds nothing new. It follows a single request from the keyboard to the final answer.

Think of a parcel moving through a sorting centre: the counter, the scales, the conveyor, the scanner, the van. Each station does one job and stamps the label, and the stamps tell the parcel's whole story afterwards. The picture stops holding because this parcel loops: it goes back through the stations once per step, until the model has nothing left to ask for.

## One request, end to end

The person types into the browser: "the test in `src/math.test.ts` fails, fix it".

1. **Agent inbox.** The web gateway's `POST /prompt` sends a followup. The agent is idle, so it wakes, opens a turn, claims the message and logs a `user/message` event. (dsh: `packages/core/agent-loop/src/inbox.ts`)
2. **Prompt sections.** Before the step, the system prompt is rendered from sections sorted by order: identity, then each tool's guidance. On the first request the repository's project instructions arrive as one recorded user message. (dsh: `packages/core/system-prompt`, `packages/context/agent-instructions`)
3. **Derived history.** The messages for the request are rebuilt from the event log, so the request only grows at the end and the provider's prompt cache stays warm. (dsh: `packages/core/session`)
4. **Model adapter.** The adapter sends the request and translates the provider's stream into stream chunks. A rate-limit error is retried with backoff, and each attempt is logged. (dsh: `packages/llm/llm-deepseek`, which speaks an Anthropic-style Messages API, and `packages/llm/llm-retry`)
5. **Message assembler.** The chunks are joined into one `assistant/message` holding a tool call: `bash` with `{"command": "npm test"}`. It is logged before any tool runs. (dsh: `packages/llm/llm/src/assembler.ts`)
6. **Tool pipeline.** The registry finds `bash`, argument validation checks the JSON, `tool/call` is logged and the pre-execute hooks run. (dsh: `packages/core/tools/src/pipeline.ts`)
7. **Approval.** Running a command is risky, so a hook asks the person. They click allow; anything else would have been a no. (dsh: `packages/interaction/user-approval`)
8. **Sandbox.** The sandbox runner wraps `bash -c "npm test"` in Seatbelt or bubblewrap, with the project folder as the only write root. With no working fence, it would fail closed. (dsh: `packages/sandbox/sandbox-local`)
9. **Event log.** The test output, too large to show whole, is spilled to a file with its head and tail kept, and logged as `tool/result`. The batch is written to the JSONL file. (dsh: `packages/spill/spill-policy`, `packages/session/session-persistence-jsonl`)
10. **Compaction.** Steps 2 to 9 repeat as the model reads and edits files. Before one step the token budget passes 80 percent, so old events are summarized and swapped out of the model's view, while the log keeps them. (dsh: `packages/compaction/compaction-basic`)
11. **Subagents.** The model starts a helper to check whether other tests use the same function. Its answer arrives later in the parent's inbox as a steer. (dsh: `packages/subagent/tool-subagent`, `packages/subagent/subagent`)
12. **Live event stream.** Through all of this, every logged event and every stream chunk was announced, and the browser's WebSocket showed it as it happened. The final `assistant/message` ends the turn. (dsh: `packages/core/agent-loop/src/assistant-stream.ts`, `packages/api/gateway`)

Every one of these parts is a plugin. The list of which plugins load, and with what settings, is a set of config rows such as `packages/bundle/base/cordis.patch.yml`, so swapping the browser for the headless runner changes rows, not code.

> **Key idea:** A harness is a loop around a stateless model, where an inbox starts the work, the event log records every fact, the prompt and history are rebuilt from that log for each step, every tool call passes the pipeline, approval and sandbox, and every front end watches the same stream of events.

## What you have now

You can name every part a request passes through, say why it is there, and point to where DeepSeek Harness keeps it. The capstone project asks you to make `minidsh` do this whole journey, then trace one real request through your own code.
