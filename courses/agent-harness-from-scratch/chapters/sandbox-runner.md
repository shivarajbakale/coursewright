# Sandbox runner: the system program that builds the fence

You now have a list of writable folders and a check for file tools. But your shell tool starts `bash` as a separate program, and nothing yet tells the operating system about the list. A check inside your Node code cannot see what `bash` does once it runs. How do you get the kernel itself to refuse a write outside the list?

## A program that starts your program

Each operating system ships a small program whose job is to apply rules and then start another program inside them. Think of a lock installer who sets the building's locks, hands the guest the card, and opens the door. You never install the locks yourself. You tell the installer which rooms, and who walks in.

```inkling
title "How a sandbox runner wraps a command"
layout down
harness: box "Harness" yellow
runner: box "sandbox-exec or bwrap"
cmd: box "bash -c your command"
kernel: box "Kernel"
step 1: harness "Your shell tool hands over the argument list"
step 2: runner "The runner adds its rules, then a --, then your list"
step 3: cmd "Your command starts inside the rules"
step 4: kernel "The kernel refuses writes outside the roots"
harness -> runner : "argv"
runner -> cmd : "-- argv"
cmd -> kernel : "write outside roots"
kernel --> cmd : "Operation not permitted"
```



The picture stops holding in one way: each operating system has its own installer, speaking its own rule language. You need one translation per platform.

On macOS the program is `sandbox-exec`, which applies a profile in Apple's sandbox language, called Seatbelt. On Linux a common choice is `bwrap`, short for bubblewrap. It builds a private view of the file system in which most folders are mounted read-only. Both take their rules, then a `--` meaning "my options end here", then the command to run.

## Wrapping the argument list

Your shell tool already runs `['bash', '-c', command]`. A sandbox runner is a function that takes that list and returns a longer one: runner, rules, `--`, then the original list. Add it to `src/sandbox.ts`:

```ts
function seatbeltProfile(roots: string[]): string {
  const forms = ['(version 1)', '(allow default)', '(deny file-write*)',
    '(allow file-write* (literal "/dev/null"))']
  if (roots.length > 0)
    forms.push(`(allow file-write* ${roots.map(r => `(subpath ${JSON.stringify(r)})`).join(' ')})`)
  return forms.join(' ')
}

function bwrapArgs(policy: SandboxPolicy): string[] {
  const args = ['--ro-bind', '/', '/', '--dev', '/dev', '--unshare-pid', '--proc', '/proc', '--die-with-parent']
  if (policy.mode === 'workspace-write') {
    const root = realpathSync.native(policy.workspaceRoot)
    args.push('--tmpfs', '/tmp', '--bind', root, root)
  }
  return args
}

export function confine(argv: string[], policy: SandboxPolicy): string[] {
  if (process.platform === 'darwin')
    return ['sandbox-exec', '-p', seatbeltProfile(writableRoots(policy)), '--', ...argv]
  if (process.platform === 'linux') return ['bwrap', ...bwrapArgs(policy), '--', ...argv]
  throw new Error(`no sandbox runner for ${process.platform}`)
}
```

Read the Seatbelt profile in order. Allow everything by default. Then deny every kind of file write. Then allow writes to `/dev/null`, because shells send unwanted output there all the time. Then allow writes under each root. The later, more specific allows win for those paths. Reading and the network stay open, exactly as the modes promise.

```inkling
title "Seatbelt rules in order"
layout down
default: box "allow default" yellow
deny: box "deny file-write*"
devnull: box "allow /dev/null"
roots: box "allow subpath root"
step 1: default "Everything is allowed to start"
step 2: deny "Now every write is denied"
step 3: devnull "Writes to /dev/null are allowed again"
step 4: roots "Writes under each root are allowed again"
default -> deny : "then"
deny -> devnull : "later wins"
devnull -> roots : "later wins"
```



The bubblewrap list says the same thing as mounts. `--ro-bind / /` shows the whole file system read-only. `--dev` and `--proc` add the device and process folders a program needs. `--unshare-pid` gives the command its own process numbering, and `--die-with-parent` stops it if your harness dies. Under `workspace-write`, `--tmpfs /tmp` adds a fresh empty `/tmp`, and `--bind root root` makes the workspace writable again.

Trace one call on a Mac, working in `/work/app`:

```text
confine(['bash', '-c', 'echo hi > ~/notes.txt'], { mode: 'workspace-write', workspaceRoot: '/work/app' })
-> ['sandbox-exec', '-p', '(version 1) (allow default) ... (subpath "/work/app") ...', '--',
    'bash', '-c', 'echo hi > ~/notes.txt']

spawn it -> stderr: bash: /Users/you/notes.txt: Operation not permitted
```

> **Key idea:** A sandbox runner is a system program that applies a profile and then starts your command; your harness confines a command by prefixing its argument list with the runner and the profile built from the mode and write roots.

**In DeepSeek Harness:** the profiles are in `packages/sandbox/sandbox-local/src/profiles.ts`, and `minidsh` copies their shape. `confine()` in `packages/sandbox/sandbox-local/src/index.ts` returns `[...runnerArgv, '--', ...argv]` plus extra facts: whether enforcement is `full` or `partial`, and the error text a denial produces under that runner, such as "operation not permitted" for Seatbelt and "read-only file system" for bwrap. Linux falls back to a Landlock launcher, another kernel feature, when bwrap is unusable. Windows uses a restricted-token runner. A source comment notes that Apple marks `sandbox-exec` deprecated but still ships it.

## What you have now

You can turn any command into a confined one by wrapping its argument list, so the kernel enforces the mode and write roots you built. This completes the sandbox and the write roots. One line is still dangerous: what should happen when the runner is missing, broken, or the platform has none?
