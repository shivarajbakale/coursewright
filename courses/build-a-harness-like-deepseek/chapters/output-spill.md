# Output spill: saving a huge result to a file

Post-execute listeners see every result before the model does. Now picture `bash "npm test"` on a large project: it prints 2,000,000 characters of output. As a tool result, that text joins the history and goes into every later request.

As you saw with the context window, a model can only consider a fixed number of tokens at once. Two million characters are about 500,000 tokens, which leaves little room for anything else. The useful part is often one failing test near the end. How does the harness keep a huge result useful without filling the context window?

## A long receipt at a shop

Think of a shop that prints a receipt one metre long. The cashier does not hand you the whole roll. You get a short slip with the first few lines and the total at the bottom. It ends with a note: "full receipt saved in your account, order 4471". If you need line 300, you look it up.

In a harness, the long receipt is the tool output, the slip is what the model sees, and the account is a file on disk. The comparison differs in one way. A shop chooses for you which lines matter. The harness keeps the start and the end, because a command often prints its steps first and its result last. It also tells the model how to search the rest.

```inkling
title "A result too large to send"
layout flow
out: box "2,000,000 chars\nof output"
size: diamond "Over\n1000 tokens?"
file: db "Spill file\nfull text" yellow
slip: box "Start + end\n+ notice"
model: box "Next request"
out -> size
size -> model : "no"
size -> file : "yes"
size -> slip : "yes"
slip -> model
circle size
step 1: out, size "Every accepted result is measured in tokens"
step 2: file "A result over the budget is saved in full to a file"
step 3: slip "The model gets the start, the end and the file name"
step 4: model "The next request stays small"
```

## The smallest spill policy

The spill plugin in `src/plugins/spill.ts` is one more post-execute listener. It estimates tokens as one token per 4 characters, and it reserves 200 tokens for the notice.

```ts
const NOTICE_TOKENS = 200

ctx.on('tools/post-execute', async (call, result, next) => {
  const decision = await next()
  if (decision.kind !== 'accept') return decision
  const text = textOf(decision.content ?? result.content)
  if (Math.ceil(text.length / 4) <= maxInlineTokens) return decision
  const path = await saveSpill(call.sessionId, `${call.name}.txt`, text)
  const endChars = ((maxInlineTokens - NOTICE_TOKENS) / 2) * 4
  const omitted = text.length - 2 * endChars
  const notice = `(Omitted ${omitted} bytes. Full formatted result stored at: ${path}. `
    + 'Use read with offset/limit, or grep this path to search within it.)'
  const kept = `${text.slice(0, endChars)}\n\n[...]\n\n${text.slice(-endChars)}\n\n${notice}`
  return { ...decision, content: [{ type: 'text', text: kept }] }
}, { prepend: true })
```

The listener is added with `prepend: true`, so it runs first. It calls `next()` before anything else, so it measures the content that every other listener already accepted or replaced.

Trace the `npm test` output with `maxInlineTokens` set to 1000:

1. Estimate the output. 2,000,000 characters divided by 4 is 500,000 tokens, which is more than 1000.
2. Save the full text. `saveSpill` writes it to a new file, such as `/tmp/dsh-spill-x/bash.txt`.
3. Work out the ends. (1000 - 200) / 2 is 400 tokens for each end, which is 1600 characters.
4. Count what is left out. 2,000,000 - 3,200 is 1,996,800 characters, all one byte each here.
5. Return the slip. The model sees 1600 characters, a gap marker, the last 1600 characters and the notice.

The model now has about 1000 tokens instead of 500,000. If the failure it needs is in the middle, it can search the spill file with the tools it already has. The record keeps the slip, because that is what the model saw, and the full text stays in the file.

> **Key idea:** Output spill saves a result over the token budget to a file, and the model sees its start, its end and where the rest is.

## How dsh does it

The listener is in `packages/spill/spill-policy/src/index.ts` (lines 134-151), added with `prepend: true`. It skips results of the `read` tool and value replacements (line 136). It compares the estimated tokens with `maxInlineTokens` (line 99). It saves the text through `ctx.spillStore.saveText` (line 104).

The file `retention.ts` keeps the head and tail that fit the budget, and `notice.ts` writes the notice. The local store, `packages/spill/spill-local`, writes each spill to a fresh file and supplies the hint "Use read with offset/limit, or grep this path to search within it." (`src/index.ts`, line 159). The base bundle sets `maxInlineTokens: 12500` (`packages/bundle/base/cordis.patch.yml`, line 425). If saving fails, the plugin logs a warning and keeps the full content.

```inkling
title "The spill packages in dsh"
layout flow
pipe: box "dsh-tools\npost-execute"
policy: box "spill-policy\nmeasure, cut" yellow
store: box "spill\nctx.spillStore"
local: db "spill-local\nfile per result"
pipe -> policy -> store -> local
circle policy
step 1: pipe "Each accepted result reaches the post-execute chain"
step 2: policy "spill-policy decides whether it is over budget"
step 3: store "It asks the spill store service to save the text"
step 4: local "The local store writes one private file"
```

## What you have now

Every tool call now passes a full pipeline: checked arguments, safe scheduling, pre-execute checks, approval, wrappers and post-execute, and large results go to a file. So far the tools are small examples. How should the tools that read and change real files work, so that a change never overwrites text the model never read?
