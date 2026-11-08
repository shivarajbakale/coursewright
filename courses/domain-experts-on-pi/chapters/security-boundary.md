# Security boundary: pi runs with all of your account's rights

Your gates block `DROP TABLE` and ask before `kube_apply`. Does that make the expert safe? Suppose the expert has the bash tool, and the model writes `cat ~/.ssh/id_ed25519`. No gate mentions that file. What stops the command?

Think of a house guest who lives in your spare room. You gave the guest a list of rules: do not enter the study, do not use the phone. The rules help only while the guest follows them. The doors are not locked. A locked door would stop the guest even if the guest ignored the list. The picture differs from pi in one way: the guest here is a program that follows text, and a clever prompt can lead it to break a rule by mistake.

pi has no lock. Its security document says: "Pi can read, change, and execute files with the permissions of the account that started it, and it does not ask for approval before every tool call." It also says: "Watching the transcript, using project trust, and reviewing changes do not create a security boundary." A **security boundary** is a limit enforced from outside the program, so the program cannot cross it even when it is wrong or tricked.

The bash tool shows why. It starts a normal shell with the function `spawn`. **Spawn** is Node's function for starting another program as a child process. A child process inherits what its parent can reach. The call looks like this:

```ts
spawn(shell, [...args, command], { cwd, env: env ?? getShellEnv() })
```

The function `getShellEnv()` returns `{ ...process.env, PATH }`. That is every variable of the pi process. If `DEEPSEEK_API_KEY` is set when you start pi, the shell has it. So the command `printenv DEEPSEEK_API_KEY` prints your key into the conversation.

```inkling
title "What a bash command can reach"
layout stack
- Account files and keys
  - Home folder and SSH keys
  - Environment variables
- The pi process
  - Gates and extensions
- The bash child process
step 1: account-files-and-keys "Your account owns files and keys"
step 2: the-pi-process "pi starts with all of those rights"
step 3: gates-and-extensions "Gates run inside pi"
step 4: the-bash-child-process "A bash command inherits everything below the gates"
```

Two more facts widen the gap. The working folder "does not prevent commands from accessing other paths available to the Pi process". So `cwd` is a starting point, not a fence. And bash has no default timeout, so a command can run until you stop it.

Count the cases. The SQL expert has only `read`, `sql_schema` and `sql_query`. It has no bash, so a command like `cat ~/.ssh/id_ed25519` has no tool to carry it. That expert is already safer. An expert that has bash can read `~/.ssh` or print `DEEPSEEK_API_KEY` unless the pi process itself is boxed in.

The document lists three ways to run pi: directly, with the whole process in a container or virtual machine, or with only the tools isolated. It calls the container or virtual machine "usually the strongest practical option". Real safety comes from limiting what the process can reach: files, keys and network.

> **Key idea:** pi has no sandbox: bash is a plain spawn with your full rights and environment, so safety comes from limiting what the process can reach.

## How pi does it

The quoted sentences come from packages/coding-agent/docs/security.md:3 and :7, and the working-folder sentence from security.md:19. The three ways to run are listed at security.md:13-17. bash calls `spawn(shell, [...args, command], { cwd, env: env ?? getShellEnv() })` (packages/coding-agent/src/core/tools/bash.ts:111-117). `getShellEnv()` returns `{ ...process.env, PATH }` (packages/coding-agent/src/utils/shell.ts:171-183). bash has no default timeout (bash.ts:40-41).

## What you have now

You know that gates guard the calls you thought of, and that pi itself offers no sandbox. A bash command reaches the files, keys and network of the account that started pi. To reduce that reach, you must change what the process can see. How do you give an expert only its own folders?
