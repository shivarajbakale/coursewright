# Mock adapter: a scripted model for tests

The first agent works, and so do the surfaces that drive it. Now you change the loop, for example how it handles two tool calls in one reply. You want a test that proves the change. A test against the real model costs money, needs a key, and gets a different answer each time. A test that cannot repeat its answer cannot fail for one clear reason. How do you test the loop with a model that always says the same thing?

## An actor with a script

Think of a rehearsal for a play. The director tests the lights and the stage, not the acting. So an actor reads the lines from a script, the same lines every night. If a light comes on late, the director knows the light is wrong, because the lines did not change. In the harness, the loop and tools are the stage, the real model is the creative actor, and the scripted actor is the mock adapter. The comparison differs in one way: an actor listens to the other actors, but a simple script ignores what the loop sends and plays the next entry.

## The script

As you saw with the adapter seam, the loop reads every provider through one `stream()` method. A test can put a different adapter behind that seam. The loop cannot tell the difference, so everything else stays real: the record, the tool registry, the tool pipeline.

`test/mock-adapter.ts` holds a list of replies. Each call to `stream()` takes the next one and records the request it got.

```ts
export class MockAdapter implements LlmAdapter {
  requests: ModelRequest[] = []
  constructor(private script: StreamChunk[][]) {}

  async *stream(request: ModelRequest): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    const reply = this.script.shift()
    if (reply === undefined) throw new Error('MockAdapter: script exhausted')
    for (const chunk of reply) {
      if (request.signal?.aborted) throw new Error('aborted')
      yield chunk
    }
  }
}

export function textReply(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}
```

A second helper, `toolCallReply(id, name, args)`, builds the pieces of one tool-call block and ends with `finish` reason `tool-calls`. A test in `test/loop.test.ts` uses both:

```ts
const mock = new MockAdapter([
  toolCallReply('call_1', 'count_lines', { path: 'notes.txt' }),
  textReply('notes.txt has 42 lines.'),
])
const agent = await startAgent({ adapter: mock, tools: [countLines], cwd: fixtureDir })
agent.followup('How many lines are in notes.txt?')
await agent.whenIdle()

assert.equal(mock.requests.length, 2)
const last = mock.requests[1].messages.at(-1)
assert.deepEqual(last.content[0], { type: 'tool_result', tool_use_id: 'call_1', content: '42' })
```

Run it with `npx tsx test/loop.test.ts`. Here is what it proves:

1. The first request goes out. The mock answers with a call to `count_lines`.
2. The real tool runs on a real `notes.txt` with 42 lines. It returns `42`.
3. The second request goes out. Its last message must carry the result for `call_1`.
4. The mock answers with text, so the turn ends.
5. The script is now empty. A third request would throw "script exhausted", so a loop that asks once too often fails the test.

The assertions check what the loop sent, not what the mock said. The mock's replies are fixed, so a failure points at the loop.

> **Key idea:** A mock adapter sits behind the adapter seam and plays scripted replies in order, so tests run the real loop with a fixed model.

## How dsh does it

`packages/core/agent-loop/tests/mock-adapter.ts` extends dsh's `LlmAdapter`. Each `stream()` call shifts the next script entry, and an empty script throws `MockAdapter: script exhausted` (line 105). Entries can also be `'hang'`, which streams the text `partial` and then waits for an abort, to test cancellation. `toolCallResponse` (line 30) splits the tool arguments after 5 characters, so tests also cover arguments that arrive in pieces. `docs/testing.md` (line 29) gives the rule: mock only the model, the network and the clock, and keep everything after them real. `packages/acp/acp/tests/harness.ts` follows it with a real loop, tool registry and JSONL record behind its own mock.

```inkling
title "One fake in a real harness"
test: box "test spec"
loop: box "packages/core/agent-loop"
tools: box "packages/core/tools"
session: db "packages/core/session"
mock: box "MockAdapter" yellow
test -> loop : "followup"
loop -> mock : "stream(request)"
loop -> tools : "execute"
loop -> session : "append"
note mock "the only fake part"
circle mock
step 1: test, loop "The test sends a message to the real loop"
step 2: mock "Each request takes the next scripted reply"
step 3: tools, session "Tools and the record stay real"
```

## What you have now

The adapter seam made the provider replaceable, and the first agent gave you a loop to test. The mock adapter replaces the model with a script, so tests are free and give the same result every run. But the mock skips the real DeepSeek adapter: its HTTP request, its parsing and its error handling. How do you test the code that talks to the provider?
