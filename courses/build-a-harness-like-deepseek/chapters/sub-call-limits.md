# Sub-call limits: code calls pass the same checks

With the code channel, a call from the program arrives at the harness as one JSON line. A program is not a person who waits between calls. One loop can ask for 5,000 reads in a second, or run a dangerous command 200 times. If calls from code skipped the pre-execute decision or approval, PTC would be a door around every rule. So what must happen to each call that arrives on the channel?

## A shop assistant with an order list

Think of a shop assistant who fetches goods for customers. A customer at the counter asks for one item, and the assistant checks the age rule before selling wine. A runner arrives with a long written list from another customer. The assistant applies the same age rule to each line of the list. The assistant also works on at most a few lines at the same time, and stops if the list is longer than the shop allows for one order.

In the harness, the customer at the counter is the model making a direct call, and the runner's list is a program. Each line of the list is a **sub-call**: one tool call that a program makes from inside `run_code`. The comparison differs in one way: the limit on calls grows with the time the program may run, not with the length of a list.

## Same path, two limits

Each sub-call goes through the same pipeline as a direct call: pre-execute, approval, the around-execute wrapper, post-execute and output spill. It gets its own call id, built from the parent `run_code` call, and the record logs it. In mini-dsh, the host side of `src/ptc-channel.ts`:

```ts
const maxSubCalls = Math.floor((timeoutMs / 60_000) * 1024)   // 1,024 calls per minute of run time
let attempts = 0

async function invoke(name: string, args: unknown): Promise<unknown> {
  attempts += 1                                   // counted first, so failed calls count too
  if (attempts > maxSubCalls) {
    const error = new Error(`more than ${maxSubCalls} tool calls in one run_code`)
    run.abort(error)
    throw error
  }
  const subCallId = `${parent.callId}:ptc:${attempts}`
  session.append('tool/ptc-dispatch-start', { parentCallId: parent.callId, subCallId, name, arguments: args })
  const safe = tools.get(name)?.isConcurrencySafe?.(args) === true
  const result = await slots.run(safe, () => pipeline.run({ callId: subCallId, name, arguments: args, parent: parent.token }))
  session.append('tool/ptc-dispatch', { parentCallId: parent.callId, subCallId, name, isError: result.isError })
  if (result.isError) throw new ToolCallError(name, result.message)
  return result.value
}
```

`slots.run()` works like batch scheduling: a call that says it is safe may share one of 10 parallel slots, and any other call runs alone. Trace one program with `timeoutMs` of 30,000:

1. Compute the limit. 30,000 / 60,000 = 0.5 minutes, and 0.5 × 1,024 = 512 calls.
2. The program starts 25 reads with `Promise.all`. `read` is safe, so they run in 3 waves: 10, 10 and 5.
3. The program calls `bash` with `rm -rf build`. A pre-execute policy says ask, and the person denies it. The program gets a `ToolCallError`, as the model would get an error result.
4. The program loops over 600 more files. Call 513 is over the limit, so the harness stops the whole run, and `run_code` returns an error.

Every one of these calls, the denied one too, has a `tool/ptc-dispatch-start` event in the record. A call that finished also has a `tool/ptc-dispatch` event. The record shows exactly what the program did.

```inkling
title "The path of one sub-call"
layout down
arrive: box "invoke from program"
count: diamond "Over the limit?"
pre: box "tools/pre-execute"
slot: box "Parallel slot, max 10"
run: box "Tool runs"
post: box "tools/post-execute"
log: db "tool/ptc-dispatch"
arrive -> count
count -> pre : "no"
pre -> slot -> run -> post -> log
step 1: arrive, count "Each call is counted first, failed calls too"
step 2: pre "The same policies and approval decide"
step 3: slot, run "Safe calls share 10 slots; others run alone"
step 4: post, log "The result is checked and recorded"
```

> **Key idea:** Each sub-call passes the same pipeline as a direct call; a run's time budget sets its call limit, and at most 10 run in parallel.

## How dsh does it

`PtcExecutor` in `packages/core/tool-executor-ptc/src/index.ts` builds one `ToolExecutionPipeline` (line 39) for `run_code` and for every sub-call. In `src/ptc.ts`, each binding counts the attempt before any check (lines 511-517). It names the call `<callId>:ptc:<n>` and passes `parent: exec.token` (line 528). It logs `tool/ptc-dispatch-start` (line 587) and `tool/ptc-dispatch` (line 560). The limit is `floor(timeoutMs / 60,000 × maxSubCallsPerMinute)` (lines 698-699). `src/config.ts` sets `maxSubCallsPerMinute` to 1,024 and `maxParallelSubCalls` to 10. With the default timeout of 120,000 ms, a run may make 2,048 sub-calls.

## What you have now

Code-mode calls are now as safe as direct calls: the same policies, a record of each call, a parallel cap and a total cap. The harness can now reach built-in tools, outside servers, skills and programs. So far, one model does all the work in one session. What happens when one task is large enough to split between several agents?
