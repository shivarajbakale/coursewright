# Replay: running recorded model streams again

The mock adapter and the fault server play replies that a person wrote by hand. Real replies are different. A real model writes reasoning, splits a task into 6 tool calls, and uses odd characters in file names. A hand-written script rarely covers that. But a test that calls the real model each time is slow, costs money and changes its answer. How can a test use real model replies without calling the model again?

## A recorded football match

Think of a referee school that trains with a recording of a real match. The students watch the same match every week. Each week they test a new rule on the same moves, and they compare their decisions. Nobody plays the match again. In the harness, the real match is one live run with the model. The recording is the session file, and each week's lesson is a code change.

The comparison differs in one way. A recording plays without the viewer, but a replay gives the next reply only when the loop asks for it. So a changed loop that asks at the wrong time fails.

## The record already holds the replies

As you saw with JSONL storage, the session file holds every event, and each `assistant/message` holds the blocks the model wrote. So the file is already a recording of every model reply, in order. A **fixture** is a saved file that a test reads as fixed input; here it is one recorded session file.

`test/replay.ts` turns a session file into a script for the mock adapter:

```ts
export function deriveScript(events: SessionEvent[]): StreamChunk[][] {
  const script: StreamChunk[][] = []
  for (const event of events) {
    if (event.type !== 'assistant/message') continue
    const blocks: ContentBlock[] = event.data.content
    const chunks: StreamChunk[] = []
    blocks.forEach((block, index) => {
      chunks.push({ type: 'block-start', index, blockType: block.type })
      chunks.push({ type: 'block-end', index, block })
    })
    const calls = blocks.some((b) => b.type === 'tool-call')
    chunks.push({ type: 'finish', reason: { kind: calls ? 'tool-calls' : 'stop' } })
    script.push(chunks)
  }
  return script
}

export function replayAdapter(file: string) {
  const mock = new MockAdapter(deriveScript(readJsonl(file)))
  return {
    adapter: mock,
    assertConsumed() {
      if (mock.remaining() > 0) throw new Error(`replay: ${mock.remaining()} recorded call(s) never used`)
    },
  }
}
```

The workflow has two modes:

1. Record once. Run the scenario against the real model with `MINI_DSH_RECORD=1`, and copy the session file into `test/fixtures/count-lines/session.jsonl`.
2. Replay on every test run. Build the adapter from that file. No key and no network are needed.
3. Send the same user message. The loop asks for reply 1 and gets the recorded tool call for `count_lines`.
4. Run the real tool. It returns `42`, and the loop asks for reply 2, the recorded text.
5. Call `assertConsumed()` at the end. The fixture has 2 replies, and the run used 2.

Now suppose a change makes the loop stop after the tool result and never ask for reply 2. Replay notices: 1 recorded call was never used, so the test fails. If a change makes the loop ask for a third reply, the script is exhausted and the test fails too. Both mistakes show up without a model.

> **Key idea:** Replay turns a recorded session's model replies into a mock script; the test reruns real output and fails on extra or missing requests.

```inkling
title "Record once, replay many times"
layout timeline
- 1: Live run with the model
- 2: Session file saved
- 3: Script derived from the file
- 4: Test run asks for replies
- 5: All replies used
span 1..2 "once, with a key"
span 3..5 "every run, no key"
steps auto
```

## How dsh does it

The file `packages/test-support/llm-replay/src/index.ts` does this with more care. Its `deriveReplayScript` (line 467) expands the stream that each `assistant/message` and `assistant/attempt` event stores. So replay gives the same pieces the live model sent, deltas included. A recorded call that ended without a `finish` chunk was a thrown stream. Derivation refuses it and asks for a `replay.override.json` file that describes the failure. Each live session binds to a recorded script in the order of its first model call, so subagents replay too. `assertConsumed()` (line 1093) fails when a session used fewer calls than recorded.

## What you have now

Replay joins the mock adapter's scripted replies to the JSONL session file, so tests reuse real model output for free. It proves the loop asked the same questions, not that the agent did the job. If the model says "I fixed the file", how does the test know the file changed?
