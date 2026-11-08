# Post-execute: changing a result before the model sees it

An around-execute wrapper can replace a result, but it sits close to the body and sees the body's raw outcome. Some rules apply only to what the model is about to read. A `read` of a `.env` file can return an API key, and the key should not reach the model. A `write` can produce a file with a syntax error, and a policy plugin wants the model to fix it at once. How does a plugin check, change or refuse a result after the body has run, but before the model sees it?

## A newspaper editor

Think of a reporter who hands a story to an editor before it goes to print. The editor can print it as it is or cut a name that must stay private. The editor can also send it back with a note ("check the date in line 3") or attach a short box of background. The editor works on the finished story. The reporter's notes stay in the reporter's drawer.

In a harness, the reporter is the tool body and the story is the result. Each editor is a listener on a waterfall hook named `tools/post-execute`. The comparison differs in one way. An editor's note goes back to the reporter. A blocked tool result goes to the model, as an error result whose text is the editor's note.

```inkling
title "Three things a post-execute listener can do"
layout mindmap
- Post-execute decision
  - Accept
    - Keep the result
    - Replace its content
  - Block
    - Becomes an error result
  - Add context
    - A message after the results
step 1: post-execute-decision "Every result meets the post-execute chain"
step 2: accept "Accept keeps the call successful, with new content if needed"
step 3: block "Block turns the result into an error with corrective text"
step 4: add-context "Either one can attach a message for the next request"
```

## The smallest post-execute check

A listener receives the call, the result and `next`. It returns `{ kind: 'accept', content? }` or `{ kind: 'block', feedback }`, and either one may carry `additionalContexts`, a list of messages. Here is a plugin that hides API keys:

```ts
const KEY = /sk-[A-Za-z0-9]{20,}/g

ctx.on('tools/post-execute', async (call, result, next) => {
  const decision = await next()
  if (decision.kind !== 'accept' || result.isError) return decision
  const text = textOf(decision.content ?? result.content)
  if (!KEY.test(text)) return decision
  return { ...decision, content: [{ type: 'text', text: text.replace(KEY, '[redacted key]') }] }
})
```

The pipeline applies the decision in `src/pipeline.ts`:

```ts
async function postExecute(ctx: Context, call: ToolCall, result: ToolResult): Promise<ToolResult> {
  const decision = await ctx.waterfall('tools/post-execute', call, result, async () => ({ kind: 'accept' }))
  const contexts = decision.additionalContexts ?? []
  if (decision.kind === 'block') return { isError: true, content: decision.feedback, contexts }
  return { ...result, content: decision.content ?? result.content, contexts }
}
```

Trace a call to `read .env`:

1. Run the body. It returns the text `API_KEY=sk-` followed by 24 letters.
2. Run the redaction listener. It calls `next()` first, so every later listener decides before it looks.
3. Find a key in the accepted content. The listener returns accept with the text `API_KEY=[redacted key]`.
4. Write the `tool/result` event. The record holds the redacted text, because that is what the model sees.

A block works the same way. A lint plugin that finds a syntax error after `write` returns `{ kind: 'block', feedback: [{ type: 'text', text: 'line 3: missing )' }] }`. The model then receives an error result with that text and can fix the file. Added contexts go into the record as user messages after all of the step's tool results, so each call still sits next to its result.

The diagram with this lesson follows two calls through every stage of the pipeline, from the model reply to the record.

> **Key idea:** Post-execute is a waterfall that runs after the body and can accept, replace, block or add context before the result is recorded.

## How dsh does it

The function `complete` in `packages/core/tools/src/pipeline.ts` (line 336) runs the tool's `projectContent` callback. Then `postExecute` (line 486) dispatches the `tools/post-execute` waterfall with a default of accept. The type `PostToolDecision` in `contracts.ts` (line 367) allows accept with new `content` or a new `value`, but never both, and block with `feedback`. A listener that throws turns the result into an error. After post-execute, the tool's `finalizeContent` runs. The frozen outcome then goes to `tools/result` observers (line 409), which can watch but not change it. `docs/tool-execution-pipeline.md` says that added contexts are "injected user/message after recorded tool results".

## What you have now

Every call now passes pre-execute checks, approval, wrappers and post-execute listeners before it reaches the record. One case is still dangerous: a command can print 2 megabytes of output, and the whole text would go into the next request. What does the harness do with a result that is too large?
