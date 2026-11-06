# Output spill: saving a huge result to a file

The model asks to run the test suite, and the command prints 1,000,000 characters of output. Sent as a tool result, that is hundreds of thousands of tokens. It may not fit in the context window at all, and if it does, it crowds out everything else and makes every later step slow and costly. Yet the useful line, the failing test, is in there somewhere. What do you send?

## Show the first and last page, keep the rest in a drawer

Think of a clerk handed a 500-page report. They do not read it aloud at the meeting. They read the first page, which says what it is, and the last page, which has the conclusion, and say: "the full report is in drawer 3 if you need a section". The picture stops holding in one way: a person in the meeting walks to the drawer, while the model can only reach the file by asking for another tool call, so the note must say how.

```inkling
title "Output spill: what the model sees"
layout flow
cmd: box "Run test suite"
out: box "1,000,000 characters" gray
file: db ".minidsh/spill/call_7.txt"
model: box "Model" yellow
step 1: cmd "The command prints a million characters"
step 2: out "The tool result is too big to send"
step 3: file "Over the limit, so all of it is saved to a file"
step 4: model "The model gets the first 2,000 characters"
circle model
```

Output spill means saving a tool result that is too big to a file, and showing the model only its start, its end and where the rest is. The start usually says what the output is; the end usually holds the error or summary. The middle stays on disk, one tool call away.

It fits the pipeline as a post-execute listener, so it works for every tool without changing any of them:

```ts
// src/spill.ts
import { mkdir, writeFile } from 'node:fs/promises'

const outputSpill: Plugin<{ maxInline: number; keep: number; dir: string }> = (ctx, config) => {
  ctx.on('tools/post-execute', async (call: ToolCall, content: string, next: () => Promise<string>) => {
    const result = await next()
    if (result.length <= config.maxInline) return result
    await mkdir(config.dir, { recursive: true })
    const path = `${config.dir}/${call.id}.txt`
    await writeFile(path, result)
    const hidden = result.length - 2 * config.keep
    return [
      result.slice(0, config.keep),
      `\n[... ${hidden} characters omitted. Full output saved to ${path}.`,
      ` Use read_file with offset and limit to see other parts ...]\n`,
      result.slice(-config.keep),
    ].join('')
  })
}
app.plugin(outputSpill, { maxInline: 8000, keep: 2000, dir: '.minidsh/spill' })
```

Walk through the test run with these settings. The result has 1,000,000 characters, more than the 8,000 limit, so the listener writes all of it to `.minidsh/spill/call_7.txt`. It returns the first 2,000 characters, a note, and the last 2,000. The note says `999996 characters omitted`, from 1,000,000 minus 4,000. The model now sees about 4,100 characters instead of a million. If the failing test's name is near the end, it is already visible. If not, the model calls `read_file` on the saved path with an offset.

The file is named after the call's id, so two large results never overwrite each other, and the log's `tool/result` event shows exactly what the model saw. A short result passes through untouched.

Two choices are worth seeing. Counting characters is a rough stand-in for counting tokens, but it is cheap and errs on the safe side for most text. And some tools know better than a generic rule: for a shell command the end of the output almost always matters most, so a command tool may keep only the tail.

> **Key idea:** Output spill saves any tool result over a size limit to a file and gives the model only its head, its tail and the file's path with a hint on how to read more, so one big result cannot flood the context window.

**In DeepSeek Harness:** the generic rule is a `tools/post-execute` listener in `packages/spill/spill-policy`, configured with `maxInlineTokens`; it saves the full output through a spill store and returns a locator plus a retrieval hint. The bash tool applies its own limit: it keeps the tail, with a default `maxOutputBytes` of 64,000, and spills the full output to a file, which its description tells the model. A `tools/pre-execute` listener in `packages/jobs/tool-jobs/src/index.ts` records a visible output limit per call for later steps to use.

## What you have now

Huge results no longer flood the model: the post-execute hook of the tool pipeline swaps them for a head, a tail and a path, protecting the context window. Reading is now safe and bounded. Writing is the riskier half. When the model wants to change one line in a file it read a while ago, how do you make sure it changes the right line in the right version of the file?
