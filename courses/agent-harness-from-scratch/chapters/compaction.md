# Compaction: replacing old history with a short summary

The token budget now tells you, before a step, that the next request is past the threshold. Something has to get smaller. The system prompt and the tool list cannot shrink, because the model needs them on every step. The newest messages cannot go, because they hold the work in progress. That leaves the old middle of the conversation. How do you make it small without losing what matters?

## Minutes instead of a transcript

After a long meeting, nobody rereads the full transcript. A secretary writes minutes in a fixed format: what was asked, what was decided, what is still open, what happens next. The last few minutes of talk may stay word for word, because they are still live.

Compaction does the same. The model itself writes the minutes, using a fixed template, and the old middle is replaced by them. The picture stops holding at accuracy. A good secretary was paying attention. A model summarizing 80,000 tokens will drop details, and a dropped detail is gone from the model's view. The fixed template exists to make the important kinds of fact hard to forget.

## Three steps

First, choose the cut. Keep a fixed beginning: the system prompt and project instructions. Keep the newest messages, up to a retain budget, here 16 percent of the window minus the reply reserve. Everything between is summarized. One rule: never put the cut between a tool call and its result, or the kept part would start with a result whose request is gone.

```ts
// src/context.ts
export function chooseCut(history: Message[], start: number, retainTokens: number): number {
  let kept = 0, cut = history.length
  while (cut > start) {
    const t = estimateTokens(JSON.stringify(history[cut - 1]))
    if (kept + t > retainTokens) break
    kept += t; cut--
  }
  while (cut < history.length && history[cut].role === 'tool') cut++ // keep calls with their results
  return cut // summarize history[start .. cut)
}
```

Second, ask for the summary. Send the history up to the cut, unchanged, then one more user message with the instruction. Because the request begins exactly like earlier ones, the provider can reuse its work for that prefix.

```ts
const SECTIONS = ['Primary Request and Intent', 'Key Technical Concepts', 'Files and Code', 'Errors and Fixes',
  'Pending Jobs', 'Current Work', 'Next Step', 'Critical Context']
const INSTRUCTION = `Condense the conversation above into a checkpoint. Output exactly these Markdown sections, in order: ${
  SECTIONS.map(s => `## ${s}`).join(', ')}. Write "(none)" for an empty section. Preserve exact paths, commands and error text. ` +
  `If a <compacted-summary> block appears above, merge it; do not copy it forward verbatim.`

const summary = await complete([...history.slice(0, cut), { role: 'user', content: INSTRUCTION }])
```

Third, build the new history. Wrap the summary in a short preamble telling the model to continue without remarking on it:

```ts
const checkpoint = `This checkpoint condenses an earlier part of the conversation. Continue the task without acknowledging it.\n` +
  `<compacted-summary>\n${summary}\n</compacted-summary>`
const next = [...history.slice(0, start), { role: 'user', content: checkpoint }, ...history.slice(cut)]
```

Trace the example from the token budget, with a fixed beginning of 3,200 tokens:

```text
retain = (128,000 - 8,000) x 0.16           = 19,200
summarized = 102,900 - 3,200 - 19,200       = 80,500 tokens
summary written                              ~ 2,000 tokens
next request ~ 3,200 + 2,000 + 19,200       = 24,400 tokens
```

The `<compacted-summary>` tags matter the second time. When the session fills up again, the old summary is inside the range, and the instruction tells the model to merge it into one new summary rather than stacking summaries.

> **Key idea:** Compaction replaces the old middle of the history with a model-written summary in a fixed template, keeping the fixed beginning and the newest messages unchanged and never splitting a tool call from its result.

**In DeepSeek Harness:** the engine is `ctx.compaction`, called for `'pressure'` before a step or `'context-overflow'` after a rejected request, and by `/compact`. `packages/compaction/compaction-basic/src/summarizer.ts` holds the real instruction with the eight sections above, and its preamble ends "without acknowledging this checkpoint." A model-free pass that trims old tool results runs first, and summarizing happens only if that is not enough. The default retain ratio is 0.16.

## What you have now

You can shrink a full history into a summary plus recent messages, using the token budget, derived history and prompt caching. But you built `next` by cutting a list. The event log only grows. How do you replace old messages in the model's view without deleting a single recorded event?
