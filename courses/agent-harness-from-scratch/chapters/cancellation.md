# Cancellation: stopping work the user no longer wants

You watch the reply stream in: "I'll start by deleting the build fol". That is not what you meant, so you press Ctrl+C. Right now that kills the whole process and leaves an open turn in the event log for the next run to repair. What you want is for the current work to stop, the program to stay up, and the log to record exactly what happened, so you can type a correction and carry on.

## Stopping a print job

Think of cancelling a print job. The printer stops feeding paper. Pages already printed stay in the tray. Jobs waiting behind it never start. The printer is ready for the next job straight away.

```inkling
title "One abort signal, passed everywhere"

ctrl: person "You press Ctrl+C"
ctl: box "AbortController" yellow
req: box "Model request"
tool: box "Running tool"
proc: box "Other tools waiting"
log: db "Event log"

step 1: ctrl, ctl "You press Ctrl+C, the process stays alive"
step 2: req, tool "The signal reaches the model request and the running tool"
step 3: proc "Tools that never started are marked as never started"
step 4: log "The log records exactly what the person saw"

ctl -> req : "signal"
ctl -> tool : "signal"
ctl -> proc : "signal"
ctl -> log : "the text so far"
circle ctl
note log "next request is rebuilt from this"
```

The harness should do the same three things. Stop the model request or the running tool. Keep whatever the person already saw. Mark everything that never started as never started.

The picture stops holding at the record. A printer keeps no notes about the half-printed page. Your harness must write down exactly what was shown, because the next request is rebuilt from the log, and the model should see what the person saw.

## One signal, passed everywhere

JavaScript has a built-in tool for this. An **AbortController** is an object with a `signal` and an `abort()` method. Calling `abort()` sets `signal.aborted` to `true` and fires an `abort` event on the signal. Anything you handed the signal to can react: `fetch` stops the request and throws an `AbortError`, and a tool can kill a child process it started.

```ts
// src/cli.ts
const controller = new AbortController()
process.on('SIGINT', () => controller.abort())        // Ctrl+C no longer kills the process
await runTurn(session, adapter, input, controller.signal)
```

The signal goes into the request (`ModelRequest` gains `signal?: AbortSignal`, which the model adapter passes to `fetch`) and into every tool through `execute(args, signal)`. When the step catches an error, it checks the signal first. A stop the person asked for is never retried:

```ts
} catch (err) {
  if (signal.aborted) {
    const { content, reasoning } = assembler.result().message   // text so far, no tool calls
    if (content || reasoning) {
      session.append('assistant/message', { turn, step,
        message: { role: 'assistant', content, reasoning }, interrupted: true })
    } else {
      session.append('assistant/attempt', { turn, step, error: 'aborted' })
    }
    // then step/end, and turn/end with reason 'aborted'
    return
  }
  // ...retry logic as before
}
```

Trace the opening example. The assembler holds the text "I'll start by deleting the build fol" and the start of a tool call. The step appends an `assistant/message` with that text, marked `interrupted: true`, and no tool call: a half-received call is never run. Then `step/end` and `turn/end { reason: 'aborted' }`. You type "Don't delete anything, list it instead." Derived history includes the cut-off sentence, so the model knows what it was saying and why you stopped it. If nothing had streamed yet, there is nothing the person saw, so the try is logged as `assistant/attempt`, which the model never sees.

```inkling
title "What the turn log records"

layout compare
columns "Text already streamed", "Nothing streamed yet"
row "Log entry": "assistant/message", "assistant/attempt"
row "Marked interrupted": yes, no
row "Model sees it": yes, no
row "Turn ends": "reason 'aborted'", "reason 'aborted'"
row "Tool calls": "answered with an error result", "answered with an error result"
step 1: log-entry "The log entry says which kind of record this is"
step 2: marked-interrupted "Only the streamed text is marked interrupted"
step 3: model-sees-it "The model only sees the streamed text"
step 4: turn-ends "Either way the turn ends as aborted"
step 5: tool-calls "Every tool call still gets an answer"
```

Now say the stop comes later. The model asked for `run_tests` (`call_1`) and `write_file` (`call_2`). `call_1` is running when you press Ctrl+C. The tool sees the signal, kills its test process, and returns a tool error result: "Stopped by the user." `call_2` never started. It gets a synthetic error result, "aborted before it started", the same move you made for an orphaned tool call. Both calls are answered, so the next request is valid.

> **Key idea:** Cancellation means stopping the current model request and tools through one abort signal, keeping any text the person already saw as an interrupted message, giving every unfinished or unstarted tool call an error result, and ending the turn as aborted, without retrying and without exiting.

**In DeepSeek Harness:** `cancel()` in `packages/core/agent-loop/src/agent.ts` aborts the agent's `AbortController` and, unless `keepInbox` is set, clears queued work. A cancelled stream commits the delivered text as `assistant/message` with `interrupted: true`, "so the next request contains what the user saw"; with nothing delivered it appends `assistant/attempt`. The assembler keeps only non-empty text and reasoning after a cancel. `turn/end` records the abort. Calls that never dispatched get a synthetic `tool/call` plus a result with code `ABORTED_BEFORE_DISPATCH` (defined in `packages/core/tools/src/contracts.ts`).

## What you have now

`minidsh` can now be stopped mid-sentence or mid-tool and keep going, with a log that matches what the person saw. Together with stream chunks, the message assembler, the model adapter, reasoning blocks and retries, that completes a provider-neutral way to talk to any model. Every one of these pieces is still wired into the loop by hand. How could features like these be added, removed or replaced without editing the loop each time?
