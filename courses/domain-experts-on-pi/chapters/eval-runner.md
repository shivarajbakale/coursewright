# Eval runner: every task in a fresh workspace

You have tasks, a fixture for each and a judge. Now you must run them all. What goes wrong if you run task two in the same folder where task one just ran?

Think of a chemistry class. Each student gets a clean bench and fresh glassware. If the first student leaves acid in a flask, the second student's result is wrong, and nobody knows why. A fresh workspace gives every task a clean bench. A difference from the classroom: the clean bench here is cheap. It is a folder that the program creates and throws away in a fraction of a second.

Leftovers are a real danger. Task one could delete a row in `shop.db`. Task two would then get a different right answer. Task one could also leave a note in the agent folder, the settings home of the expert, and that note would change how the expert behaves in task two.

An **eval runner** is a program that runs every golden task in isolation and grades each one. For each task it does this:

1. Create a fresh temporary folder.
2. Copy the task's fixture into it.
3. Give the run its own agent folder inside that folder.
4. Run the expert once, with the task's prompt.
5. Grade the outcome, and append the score to `results.jsonl`.

```inkling
title "One task in a fresh folder"
layout down
tasks: box "tasks.json"
fresh: box "Fresh folder"
run: box "pi run"
grader: box "Grader"
out: box "results.jsonl\nand session"
tasks -> fresh -> run -> grader -> out
steps auto
```

In `fleet`, `evals/runner.ts` starts pi in JSON mode. The command `pi -p --mode json` prints one JSON event on each line. The runner parses these lines. The final answer is the last `message_end` event whose message has the role `assistant`. Pass `--session-dir` so the session file is kept for later reading. With `--no-session` there would be no file.

```ts
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

for (const task of tasks) {
  const tmp = mkdtempSync(join(tmpdir(), "eval-"));
  mkdirSync(join(tmp, dirname(task.fixture)), { recursive: true });
  cpSync(task.fixture, join(tmp, task.fixture));
  const env = { PATH: process.env.PATH, DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
                PI_CODING_AGENT_DIR: join(tmp, "agent") };
  const run = spawnSync("pi", ["-p", "--mode", "json", "--session-dir", join(tmp, "sessions"),
    "--model", "deepseek/deepseek-flash", ...expertFlags, task.prompt], { cwd: tmp, env, encoding: "utf8" });
  const events = run.stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const ends = events.filter((e) => e.type === "message_end" && e.message.role === "assistant");
  const failed = ends.some((e) => e.message.stopReason === "error");
  const score = failed ? 0 : grade(task, ends.at(-1)?.message, tmp);
  appendFileSync("results.jsonl", JSON.stringify({ id: task.id, score }) + "\n");
}
```

Here `expertFlags` holds the flags from the hand-run command for the SQL expert, and `grade` calls your judges. Look at the `failed` line. In JSON mode the exit code stays 0 even when the model call failed. So the runner cannot trust the exit code. It reads the events and checks the stop reason of each assistant message.

> **Key idea:** An eval runner runs each golden task in a fresh folder with its own agent folder, grades the outcome, and saves the score and session.

## How pi does it

pi's own eval harness works the same way. Every run gets a fresh temporary root with a `workspace/`, its own HOME and its own agent folder (packages/evals/src/harness.ts:283-286, 82-100). The harness records tool calls and results (harness.ts:190-223) and usage from `session.getSessionStats()` (harness.ts:391-411). It saves the full session JSONL (harness.ts:420-427). The JSON mode and its exit code are described in packages/coding-agent/docs/json.md:23-48 and packages/coding-agent/docs/cli-integration.md:46.

## What you have now

You can run a whole set of golden tasks and get one score per task, with no leftovers between tasks. The runner joins the fixture, the agent folder and the judge from earlier lessons. A pass rate of 85% still does not say whether the pack caused it. How can you tell?
