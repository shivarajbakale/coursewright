# Failing closed: refusing to run without a working fence

Your `confine` function ends with a `throw` for platforms it does not know. Other things can go wrong too. `bwrap` may not be installed. It may be installed but unable to start, as often happens inside a container that forbids the features it needs. The tempting fix is a fallback: print a warning and run the command without the fence. What should a harness do when it cannot build the fence it promised?

## A lock in a power cut

Think about an electronic door lock when the power fails. A fire exit unlocks, so people can get out. A bank vault stays locked, so nobody gets in. Each lock fails in the direction that protects what matters most. A sandbox is a vault, not a fire exit. If the fence cannot be built, the command must not run.

The picture stops holding in one place. A vault in a power cut has no choice. Your user does: they can pick `danger-full-access` on purpose. That is a visible decision a person made. Running unfenced because a runner happened to be missing is an accident nobody chose.

## Probe once, refuse loudly, read the outcome

Failing closed takes three small pieces. Rename the function from the sandbox runner lesson to `wrap`, and put the checks in front of it:

```ts
import { spawnSync } from 'node:child_process'
let works: boolean | undefined

function probe(): boolean {
  try {
    const argv = wrap(['true'], { mode: 'read-only', workspaceRoot: '/' })
    return spawnSync(argv[0], argv.slice(1), { timeout: 5000, stdio: 'ignore' }).status === 0
  } catch { return false }
}

export function confine(argv: string[], policy: SandboxPolicy): string[] {
  if (policy.mode === 'danger-full-access') return argv // chosen on purpose, no fence
  works ??= probe()
  if (!works) throw Object.assign(
    new Error(`sandbox mode "${policy.mode}" requested but no sandbox runner works here; refusing to run unconfined`),
    { code: 'SANDBOX_UNAVAILABLE' })
  return wrap(argv, policy)
}
```

First, the probe. It runs `true`, a program that does nothing and exits with status 0, under the real read-only profile. Exit 0 means the runner started and the kernel accepted the rules. A missing program, a refused profile or a five-second hang all count as failure. The verdict is stored, so the probe runs once per process, not once per command.

Second, the refusal. With no working runner, `confine` throws instead of returning `argv` unchanged. Your tool pipeline turns the throw into a tool error result, so the model reads exactly why nothing ran.

Third, reading what happened after a confined run. A non-zero exit can mean three different things:

```text
stderr line starts "bwrap: " or "sandbox-exec: "   the runner failed; the command never ran
stderr contains "Operation not permitted"          the fence worked and refused a write
anything else                                      the command itself failed
```

Only the first is a broken fence. The second is the sandbox doing its job. The third is an ordinary result such as a failing test. The exit code alone cannot tell them apart, so you check the runner's own error text first.

> **Key idea:** Failing closed means a harness that cannot confirm a working sandbox refuses to run a confined command at all, and reports why, rather than quietly running it without the fence.

**In DeepSeek Harness:** `SandboxUnavailableError` in `packages/sandbox/sandbox/src/index.ts` carries the code `SANDBOX_UNAVAILABLE` and says it is "refusing to run the command unconfined." The sandbox docs put the rule in one line: "Silent unconfined passthrough is never legal for a confined policy." On Linux, `packages/sandbox/sandbox-local/src/index.ts` probes bwrap and then Landlock by running `true` under the real read-only profile, bounded by `probeTimeoutMs` (default 5,000), and caches the verdict. macOS has a single candidate, used without a probe, and a broken `sandbox-exec` is caught at run time by its `sandbox-exec: ` error line. Each runner also ships `runnerFailureRules`, because "Exit status alone never proves runner failure."

## What you have now

You have a fence that is either really there or loudly absent, plus a way to tell a broken fence from a refused write and from an ordinary failure. This builds on the sandbox runner and on tool error results. One case is left: the fence refused a write the task really needs. How can the model ask, once, for more room?
