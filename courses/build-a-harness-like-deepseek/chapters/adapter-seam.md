# Adapter seam: one method that any provider can fill in

A block assembler turns shared pieces into whole blocks. Something must still talk to DeepSeek over HTTP and turn its events into those pieces. If that code sits inside the agent loop, the loop knows DeepSeek's address, its headers and its event names. A second provider then means a second loop. How can the loop ask for a reply without knowing who answers?

## A travel plug

Think of a laptop charger on a trip. The charger has one plug shape. In each country you put a small travel plug between the charger and the wall, and the charger never changes.

Here the charger is the agent loop, and each wall socket is a model provider. The travel plug is the code that fits one to the other. The picture differs in one way. A travel plug only changes the shape of the pins, but this code converts in both directions. It writes the provider's own request, and it converts the provider's events back into the shared pieces.

## One method

mini-dsh defines the seam in `src/llm.ts`. A provider's code must offer one method, `stream`, which takes a request and gives back pieces one at a time. An `async function*` is a function that produces values one by one. Inside it, `yield` sends the next value, and `for await` reads each value as it arrives.

```ts
export type GenerateOptions = {
  provider: string
  model: string
  messages: Message[]
  system?: string
  tools?: ToolSchema[]
  maxTokens?: number
}

export interface LlmAdapter {
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>
}

const adapters = new Map<string, LlmAdapter>()

export function registerAdapter(provider: string, adapter: LlmAdapter): () => void {
  if (adapters.has(provider)) throw new Error(`provider "${provider}" already has an adapter`)
  adapters.set(provider, adapter)
  return () => { adapters.delete(provider) }
}

export async function* stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
  try {
    const adapter = adapters.get(options.provider)
    if (!adapter) throw new Error(`no adapter for provider "${options.provider}"`)
    yield* adapter.stream(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    yield { type: 'finish', reason: { kind: 'error', failure: { code: 'ADAPTER', message } } }
  }
}
```

An **adapter** is an object with this `stream` method for one provider. The loop calls the shared `stream` function, and the provider name selects the adapter.

Here is a scripted adapter that needs no network, and the loop code that reads it:

```ts
registerAdapter('script', {
  async *stream() {
    yield { type: 'text-delta', index: 0, text: 'Hi.' }
    yield { type: 'usage', usage: { inputTokens: 5, outputTokens: 2 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
})

const asm = new BlockAssembler()
for await (const chunk of stream({ provider: 'script', model: 'any', messages })) asm.push(chunk)
```

1. Call `stream` with provider `script`. The map returns the scripted adapter.
2. Push each piece into the assembler. There is no `block-start`, so the assembler opens block 0 from the first delta.
3. Read the result. `asm.blocks()` is one text block, "Hi.", and `asm.finish` is `stop`.
4. Call `stream` with provider `nobody`. No adapter is found, and the loop gets one `finish` piece with kind `error`.

The last step shows the second job of the seam. A provider can fail by throwing, but the loop always sees the same thing: pieces that end in one `finish`. Because of this, the loop has one place to check for failure.

> **Key idea:** An adapter seam is one stream method that each provider fills in; the loop picks an adapter by provider name and reads only shared pieces.

## How dsh does it

dsh draws the same line with real packages.

```inkling
title "The seam in dsh"
loop: box "agent-loop"
runtime: box "LlmRuntime\npackages/llm/llm"
adapter: box "DeepSeekAdapter\nllm-deepseek"
api: icon cloud "DeepSeek API"
loop -> runtime : "request"
runtime -> adapter : "by provider"
adapter -> api : "HTTP"
api --> adapter : "events"
adapter --> runtime : "pieces"
runtime --> loop : "pieces"
highlight runtime
step 1: loop, runtime "The loop asks the runtime for a stream"
step 2: adapter "The runtime picks the adapter for the provider"
step 3: api "Only the adapter speaks to DeepSeek"
```

- The file `packages/llm/llm/src/index.ts` declares the abstract class `LlmAdapter` (line 208), where `stream` is the only required method (line 302).
- `LlmRuntime.registerAdapter` (line 401) refuses a second adapter for one provider with the code `DUPLICATE_ADAPTER`.
- `LlmRuntime.stream` (line 1170) converts a throw into a terminal `finish` with kind `error` or `aborted` (`adapterFailureChunk`, line 1188).
- The file `packages/llm/llm-deepseek/src/adapter.ts` declares `DeepSeekAdapter extends LlmAdapter` (line 22).
- The agent loop in `packages/core/agent-loop/src/agent.ts` reads the stream at line 490.

## What you have now

The loop now asks a shared `stream` function for pieces, and an adapter for each provider fills the method in. The scripted adapter proves the seam works without a network. A real DeepSeek adapter must write the exact request DeepSeek accepts and read the exact events it sends. What do that request and those events look like?
