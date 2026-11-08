# Fault server: a fake provider that fails on purpose

The mock adapter replaces the model behind the adapter seam. Because of this, a test with the mock never runs the DeepSeek adapter. It never sends an HTTP request, never parses server-sent events, and never meets a rate limit. Those are the parts that break on a bad network day. You cannot ask DeepSeek to fail on cue at 2 p.m. How do you test that the adapter and the retry with backoff handle a failure correctly?

## A fire drill

Think of a fire drill in an office. Nobody starts a real fire. A person sets off the alarm at a chosen time, and everyone checks that the doors open and the stairs are clear. In the harness, the real outage is the fire, the fault server is the person with the alarm, and the adapter and retry code are the doors and stairs. The comparison differs in one way: a drill tests one alarm, but a fault server can play a different failure on each request, in an order the test chooses.

## A server that follows a list

A fault server is a small local HTTP server that answers `POST /v1/messages` in the same format as the provider. The test gives it a list of behaviours. Each request uses the next behaviour and is saved for the test to check. The server listens on port 0, so the operating system picks a free port.

`test/fault-server.ts`:

```ts
type Behaviour = 'success' | 'rate_limit' | 'server_error' | 'stall'

export async function startFaultServer(sequence: Behaviour[]) {
  const requests: unknown[] = []
  const server = http.createServer(async (req, res) => {
    requests.push(JSON.parse(await readBody(req)))
    const behaviour = sequence.shift() ?? 'server_error'
    if (behaviour === 'rate_limit') {
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '1' })
      res.end(JSON.stringify({ error: { type: 'rate_limit', message: 'slow down' } }))
    } else if (behaviour === 'server_error') {
      res.writeHead(500).end(JSON.stringify({ error: { type: 'server_error', message: 'boom' } }))
    } else if (behaviour === 'stall') {
      res.writeHead(200, { 'content-type': 'text/event-stream' })   // headers, then silence
    } else {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const event of successEvents('notes.txt has 42 lines.')) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      }
      res.end()
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  return { baseURL: `http://127.0.0.1:${port}`, requests, close: () => server.close() }
}
```

`successEvents` returns the provider's own events: `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta` with `stop_reason: "end_turn"`, and `message_stop`.

A test in `test/retry.test.ts` points the real DeepSeek adapter at this server:

```ts
const fault = await startFaultServer(['rate_limit', 'success'])
const agent = await startAgent({ adapter: new DeepSeekAdapter({ baseURL: fault.baseURL, apiKey: 'test' }) })
agent.followup('How many lines are in notes.txt?')
await agent.whenIdle()

assert.equal(fault.requests.length, 2)
assert.equal(agent.session.all().filter((e) => e.type === 'llm/retry').length, 1)
assert.equal(lastText(agent.session), 'notes.txt has 42 lines.')
fault.close()
```

Here is what happens:

1. The adapter sends request 1. The server answers 429 with `retry-after: 1`.
2. The adapter converts the 429 into a failed stream. The retry code writes one `llm/retry` event to the record.
3. The retry code waits 1 second, because the server asked for it.
4. The adapter sends request 2. The server streams a full success.
5. The adapter parses the events into chunks, and the turn ends with the text.

The test checks three facts: the server got 2 requests, the record has 1 retry, and the answer arrived. A `stall` entry tests the other kind of failure: the headers arrive, then nothing more, and the harness must stop waiting on its own.

> **Key idea:** A fault server speaks the provider's HTTP format locally and plays a chosen list of failures, so tests run the real adapter and retry code.

```inkling
title "A rate limit, then success"
layout sequence
adapter: box "DeepSeek adapter"
fault: box "Fault server"
record: db "Record"
adapter -> fault : "POST /v1/messages"
fault --> adapter : "429, retry-after 1"
adapter -> record : "llm/retry"
adapter -> fault : "POST /v1/messages"
fault --> adapter : "200, event stream"
steps auto
```

## How dsh does it

`packages/test-support/llm-mock-server/src/index.ts` is dsh's fault server. It knows 23 concrete behaviours plus `random` (line 16), among them `connection_reset`, `partial_eof`, `stall`, `malformed_json`, `rate_limit`, `server_error`, `context_overflow`, `tool_call_success` and `max_tokens`. A `rate_limit` reply sets `retry-after` from `retryAfterMs`, rounded up to whole seconds (line 365). Without `repeatLast`, an empty sequence answers with a 500 error, `mock script exhausted`. `random` picks a behaviour from weights with a seed, so a stress run with mixed failures can be repeated exactly.

## What you have now

The mock adapter tests the loop, and the fault server tests the adapter and the retry with backoff beneath it. Both use replies that a person wrote by hand. A real model writes longer and stranger replies than any script. How can a test use replies that a real model gave once, without calling it again?
