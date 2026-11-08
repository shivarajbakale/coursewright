# Provider: one model interface with DeepSeek built in

Model services differ. Each has its own web address, its own way to prove who you are, and its own message format. If the loop spoke each format, every change of model would mean changes in the loop. How does pi keep the loop the same while the model changes underneath?

Think of a power adapter on a trip. Your laptop has one plug. The wall sockets differ by country. You do not rebuild the laptop. You carry one adapter per socket type.

The comparison differs in one way. An adapter only fits a plug. A pi adapter also turns the loop's messages into the service's format and turns the reply back.

## One interface

In the `pi-ai` package, every model service sits behind one **provider** interface. The loop talks only to that interface. To add a service, pi makes one `createProvider` call. The call names the service, its web address, how to read the key, its models and the adapter to use.

DeepSeek is built in. This is the whole definition:

```ts
return createProvider({
  id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com",
  auth: { apiKey: envApiKeyAuth("DeepSeek API key", ["DEEPSEEK_API_KEY"]) },
  models: Object.values(DEEPSEEK_MODELS),
  api: openAICompletionsApi(),
});
```

Read it line by line. The `id` is the name you use after `--model`. The `auth` line reads the key from the `DEEPSEEK_API_KEY` environment variable. The `models` line lists the DeepSeek models pi knows: `deepseek-flash`, which is "DeepSeek V4.1 Flash", and `deepseek-v4-pro`. The `api` line chooses the adapter for the OpenAI-compatible chat format. DeepSeek speaks that format, so pi reuses the adapter that other services use.

```inkling
title "One interface, many services"
layout flow
agent: box "The loop"
iface: box "Provider interface" green
deepseek: box "DeepSeek"
anthropic: box "Anthropic"
openai: box "OpenAI"
agent -> iface : "one call"
iface -> deepseek : "OpenAI-compatible adapter"
iface -> anthropic : "its adapter"
iface -> openai : "its adapter"
step 1: agent, iface "The loop asks the interface for a reply"
step 2: deepseek "DeepSeek runs over the OpenAI-compatible adapter"
step 3: anthropic, openai "Other services use their own adapters"
circle iface
```

> **Key idea:** Every provider fills one interface. DeepSeek runs over the OpenAI-compatible adapter, with its own settings for thinking.

## Thinking levels

Some models can reason before they answer. A **thinking level** says how much. pi knows these levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh` and `max`.

DeepSeek expects two fields for this: `thinking: {type: "enabled" | "disabled"}` and `reasoning_effort`. The adapter fills them from the level you choose. Each model maps the levels to its own values. If a model does not support a level, pi rounds it to the nearest supported level.

You pick a model and a level in one flag, with a suffix:

```
pi --model deepseek/deepseek-flash:high
```

Here `deepseek` is the provider, `deepseek-flash` is the model and `high` is the thinking level.

## models.json

To add a model or override one, write the file `~/.pi/agent/models.json`. The name is **models.json**: the file in `~/.pi/agent` where you add or override models. You need it only when the built-in list is not enough.

## How pi does it

The DeepSeek provider is in `packages/ai/src/providers/deepseek.ts:6-15`. Its models are in `packages/ai/catalog/providers/deepseek.ts:8-57`. Thinking is sent as `thinking` plus `reasoning_effort` in `packages/ai/src/api/openai-completions.ts:913-922`.

The levels are typed in `packages/agent/src/types.ts:349`. The mapping and rounding is in `packages/ai/src/models.ts:1272-1291`. The path of `models.json` is set in `packages/coding-agent/src/core/agent-session-services.ts:144`.

## What you have now

You know that pi hides every model service behind one provider interface, and that DeepSeek is a short definition over a shared adapter. You also know the thinking levels and the `--model` suffix. This builds on the package layers, where `pi-ai` owns models. The open question is what happens when the conversation grows past what the model can read.
