# Run mode: print, JSON lines, RPC or in your program

You can now run an expert by hand and watch it work. A program cannot sit at a keyboard. It needs to start an expert, give it a task and read the answer. How does a program drive pi?

Think of four ways to get help from a colleague. In the first, you hand over a note, the colleague writes one reply and goes home. In the second, the colleague also writes down every step on the way, so you can follow along. In the third, the colleague stays at a desk and you pass notes under the door all day. In the fourth, the colleague works inside your own office.

The comparison differs from pi in one way. A colleague who comes back remembers the last visit. A pi process that exits keeps nothing in memory, and the next process starts from zero.

pi offers exactly these four ways to run. Here are the first two, with a small task:

```sh
pi -p --model deepseek/deepseek-flash "2+2?"
pi --mode json -p --model deepseek/deepseek-flash "2+2?" | head -3
```

The first command is **print mode**. pi runs one task, writes the text of the last assistant message and exits. The second is **JSON mode**. pi writes one JSON object per line: first a header line such as `{"type":"session","version":3,...}`, then `{"type":"agent_start"}`, then one line for every event after that.

Both modes end with an **exit code**. This is the number a program returns when it ends. The value 0 means success. Any other value means failure, and your program can test it.

The two modes treat failure differently:

1. Print mode returns exit code 1 when the run ends in an error or is aborted.
2. Print mode also returns 1 when the token limit cut the reply short.
3. JSON mode returns 0 even when the model call failed.

Because of step 3, a program that uses JSON mode must read the events. The exit code alone does not tell it whether the run worked.

The last two ways keep pi alive between tasks. The third way, RPC, runs pi as one long process that you send commands to. The fourth way, the SDK, is pi as a library inside your own program, so there is no process to start. The choice is mostly about cost:

| Mode | Process | Turns | How you get the result | Cost |
| --- | --- | --- | --- | --- |
| Print | New process per task | One task | Text of the last assistant message | Full startup every task |
| JSON | New process per task | One task | One JSON line per event | Full startup every task |
| RPC | One long process | Many tasks | Commands and events over stdin and stdout | Startup once |
| SDK | Your own process | Many tasks | Call `prompt`, then read the answer | No process to start |

```inkling
title "Four ways to run pi"
layout compare
columns "Print", "JSON", "RPC", "SDK"
row "Long-running": "no", "no", "yes", "yes"
row "Many prompts": "no", "no", "yes", "yes"
row "Live events": "no", "yes", "yes", "yes"
row "Startup per task": "full", "full", "once", "none"
step 1: long-running "Print and JSON end after one task. RPC and the SDK stay up"
step 2: many-prompts "Only the long-running ways take prompt after prompt"
step 3: live-events "JSON, RPC and the SDK show events as they happen"
step 4: startup-per-task "Print and JSON pay full startup on every task"
```

> **Key idea:** pi runs as print, JSON, RPC or SDK. Print and JSON start a new process for each task.

## How pi does it

- pi picks the mode in packages/coding-agent/src/main.ts:112-123. The flag `--mode json` gives JSON mode. The flag `-p`, or input that is not a terminal, gives print mode. Interactive is the default.
- Print mode writes only the last assistant message. It sets exit code 1 on error, abort or a reply cut by the token limit (packages/coding-agent/src/modes/print-mode.ts:139-160).
- JSON mode prints the session header and then every event (print-mode.ts:108-127).
- The startup steps that print and JSON repeat are in packages/coding-agent/src/main.ts:644-936. Set `PI_TIMING=1` to see how long each step takes.

## What you have now

You know the four ways to run pi and what each costs. Print and JSON are simple but pay full startup for every task, while RPC and the SDK start once. This builds on the loop you know: each way runs the same loop and differs only in how your program reaches it. If your program starts pi once and keeps it running, how does it send a task and know that the work is done?
