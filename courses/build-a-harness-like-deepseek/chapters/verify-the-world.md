# Outcome checks: testing the files and record an agent leaves

With replay, a test runs real model replies again and checks that the loop asked for each one. Now the task is "add a line `done` to notes.txt". The model ends with "I added the line." A test that searches the answer for "added" passes. It also passes when the edit tool failed, or when the agent wrote to the wrong file. What should the test check instead?

## A builder's inspection

Think of a person who hires a builder to fix a roof. The builder says "it is fixed". A careful owner does not stop there. They climb up and look at the tiles, and they check that the builder did not break the gutter. In the harness, the builder's words are the model's final text, and the roof is the files and the record. The comparison differs in one way: an owner looks once, but a test compares every file with a saved copy, byte by byte, on every run.

## Check the world, not the words

An outcome check reads what the agent changed with the test's own code. It never trusts the agent's report. It checks three things:

1. The files the task should change have the expected content.
2. The files the task should not change are byte-identical to before.
3. The record holds the facts the task needs, for example a `tool/result` with no error for the edit.

A **snapshot** is a saved copy of the expected result, kept in the repository beside the test. The test compares the real result with it, and a person reviews any change to it.

In mini-dsh, one scenario folder holds everything:

```
test/scenarios/add-done/
  workspace/notes.txt            # 42 lines, the starting files
  workspace/README.md
  workspace.expected/notes.txt   # 43 lines, the last one "done"
  workspace.expected/README.md   # unchanged
  session.jsonl                  # the recorded run, used for replay
```

`test/outcome.test.ts` copies `workspace/` to a fresh temporary folder, runs the agent there with replay, and compares:

```ts
const cwd = await copyToTemp('test/scenarios/add-done/workspace')
const replay = replayAdapter('test/scenarios/add-done/session.jsonl')
const agent = await startAgent({ adapter: replay.adapter, cwd })
agent.followup('Add a line "done" to notes.txt')
await agent.whenIdle()
replay.assertConsumed()

for (const file of await listFiles('test/scenarios/add-done/workspace.expected')) {
  const expected = await readFile(join('test/scenarios/add-done/workspace.expected', file))
  const actual = await readFile(join(cwd, file))
  assert.ok(actual.equals(expected), `${file} differs`)
}
assert.deepEqual(await listFiles(cwd), await listFiles('test/scenarios/add-done/workspace.expected'))

const results = agent.session.all().filter((e) => e.type === 'tool/result')
assert.ok(results.length > 0 && results.every((e) => !e.data.isError))
```

Trace what each check catches:

1. Compare `notes.txt`. It must have 43 lines, so an edit that failed in silence fails here.
2. Compare `README.md` byte by byte. A stray write to the wrong file fails here.
3. Compare the file lists. A new file such as `notes.txt.bak` fails here.
4. Read the record. An error result that the model ignored fails here.
5. Never read the final text. "I added the line" counts for nothing.

When you change the scenario on purpose, you record again and update `workspace.expected/`. The review of that change shows exactly what the agent now does differently.

> **Key idea:** An outcome check compares the files and the record an agent leaves with saved expected copies, and it never trusts the agent's own report.

```inkling
title "Two ways to check an agent"
layout compare
columns "Check the words", "Check the world"
row "Reads": "the final text", "files and the record"
row "Catches a failed edit": no, yes!
row "Catches a wrong file": no, yes
row "Fooled by a confident answer": yes, no
steps auto
```

## How dsh does it

`docs/testing.md` (line 33) states the rule as "Verify the world, not the self-report": a test reads the file again or runs the command again, and asserts that untouched files are byte-identical. Scenario folders live in `snapshots/session/`, 180 of them at this commit. `snapshots/session/apply-patch-update/` holds `snapshot.yml` (profile `headless`), `workspace/`, `workspace.expected/`, `session.v4.jsonl`, `system-prompt.expected.md` and `tool-schemas.expected.json`. `packages/test-support/session-snapshot` copies the workspace, replaces random paths with tokens such as `{{cwd}}`, runs the profile with replay, and compares the record and the final workspace.

## What you have now

The mock adapter, the fault server and replay let tests run without a real model. Outcome checks make those tests prove that the work happened, from the files and the record. You now have every part of mini-dsh and a way to test each one. How do all these parts work together on one request, from the first byte in to the last byte out?
