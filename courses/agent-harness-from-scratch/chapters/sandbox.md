# Sandbox: a fence around what a command can change

With approval, `minidsh` pauses before a risky tool call and asks you. That helps, but look at what you actually approve. The model asks to run `npm test`. You say yes. Somewhere inside the test script, a cleanup step deletes the wrong folder. You approved the words of the command, not what it turned out to do. And in an unattended run with the policy set to never ask, nobody approves anything. How do you limit the damage a command can do, whatever it turns out to be?

## A key card that opens one room

Picture a guest in an office building. You do not follow the guest around checking every door they try. You give them a key card that opens one room. The building's lock system, not the guest's good intentions, decides which doors open. Anyone the guest brings along gets the same card.



A sandbox works the same way for a command. Before the command starts, your harness hands the operating system a set of rules. From then on the kernel, the core of the operating system that every program must ask before it writes a file, checks each write against those rules. The command cannot argue its way out, and every program it starts inherits the same rules.

```inkling
title "A fence the kernel enforces"
layout flow
rules: sticky "Kernel rules\nfrom your harness" yellow
cmd: box "The command" blue
child: box "Programs it starts"
kernel: box "Kernel\nchecks each write"
inside: box "notes.txt\nin /work/app" green
outside: box "~/notes.txt\noutside" red
step 1: rules "Your harness hands the operating system its rules"
step 2: kernel "The kernel receives the rules before the command starts"
step 3: cmd "The command starts under those rules"
step 4: child "Every program it starts inherits the rules"
step 5: inside "A write inside the fence is allowed"
step 6: outside "A write outside the fence is refused"
rules -> kernel : "handed over first"
kernel -> cmd : "run it under these rules"
cmd -> child : "starts it"
child -> kernel : "asks to write"
kernel -> inside : "inside the fence: allowed"
kernel -> outside : "outside the fence: refused"
circle kernel
```

The picture stops holding in one important place. A key card controls every door. The sandbox in this course controls only one kind of door: changes to files. The command can still read any file your user account can read, such as `~/.ssh`. It can still reach the network. It can still use all your CPU.

## Three modes

`minidsh` names three levels of fence. Start `src/sandbox.ts` with them:

```ts
// src/sandbox.ts
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

export interface SandboxPolicy {
  mode: SandboxMode
  workspaceRoot: string // the folder the session works in
}
```

Here is one command under each mode, with the session working in `/work/app`:



```text
command: bash -c 'echo hi > notes.txt; echo hi > ~/notes.txt'

read-only           both writes refused: "Operation not permitted"
workspace-write     /work/app/notes.txt written, ~/notes.txt refused
danger-full-access  both files written, because there is no fence
```

Walk through it. The command tries two writes, one inside the working folder and one in your home folder. Under `read-only`, the kernel refuses both, and the shell prints the error. Under `workspace-write`, the write inside `/work/app` succeeds and the one outside fails. Under `danger-full-access`, nothing is checked. The name is long and alarming on purpose.

```inkling
title "One command under three fences"
layout compare
columns "read-only", "workspace-write", "danger-full-access"
row "Write in /work/app": "refused", "written", "written"
row "Write in ~/": "refused", "refused", "written"
row "Fence": "nothing changes", "only the workspace", "no fence"
step 1: read-only "Under read-only, both writes are refused"
step 2: workspace-write "Under workspace-write, the workspace write succeeds"
step 3: danger-full-access "Under danger-full-access, both files are written"
```

Notice that the policy is a value you pass with each command, not a global switch. Two commands can run at the same moment under different modes. That matters later, when one single call needs a wider fence than the rest.

> **Key idea:** A sandbox is a set of rules the operating system enforces on a command and everything it starts, limiting which files it may change no matter what the command does.

Be honest about what this buys you. Under `workspace-write`, a bad command can still delete every file in your project, because the project is inside the fence. Keep your work in version control and keep backups. A sandbox reduces risk. It does not remove it.

**In DeepSeek Harness:** the modes are `SandboxMode` in `packages/sandbox/sandbox/src/index.ts`, whose comment says "Network and process visibility are outside this vocabulary." A `danger-full-access` call spawns the original command and never calls the sandbox service (`docs/subsystems/sandbox.md`). Each backend also reports its enforcement as `full` or `partial`, so callers know when a promise is only partly kept. `SAFETY.md` is blunt: sandboxing and approvals "can reduce risk, but they do not guarantee isolation or prevent damage," and it recommends least privilege, a disposable virtual machine or container, and backups.

## What you have now

You have a fence the operating system enforces, chosen per command, to back up approval when a person misses something or is not there. It covers file changes only. The open question is the middle mode: under `workspace-write`, exactly which folders may a fenced command still change?
