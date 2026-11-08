# Bash backend: running commands somewhere else

A container around the whole pi process is strong. It also boxes every extension and needs an image per expert. Consider the Kubernetes expert. It needs `kubectl` and a kubeconfig, which is a file that holds cluster credentials. You would rather keep those out of the pi process. Can pi stay on your machine while only its commands run elsewhere?

Think of a chef who writes orders and passes them through a hatch to a second kitchen. The chef never touches the second kitchen's stove. The second kitchen cooks and passes the plate back. The picture differs from pi in one way: the second kitchen is a program that must stream output back as it works, and a command can fail halfway.

pi's bash tool is built for this. It takes a pluggable backend, `BashOperations`. A **backend** is the part that decides where a command runs. Its `exec` function receives the command, the working folder and some options, runs the command, and returns the exit code. The type is documented: "Override these to delegate command execution to remote systems (for example SSH)."

**SSH** is a way to run commands on another machine over an encrypted connection. pi's own example spawns `ssh remote "cd <cwd> && <command>"` and registers new `read`, `write`, `edit` and `bash` tools that use the remote operations. You create a bash tool with your backend by calling `createBashTool(cwd, { operations, spawnHook, commandPrefix, exposeSessionEnvironment })`.

For the Kubernetes expert, the second kitchen is a container named `k8s-tools`. It holds `kubectl` and a read-only kubeconfig. The sketch below runs each command with `docker exec`:

```ts
import { spawn } from "node:child_process";
import { createBashTool } from "@earendil-works/pi-coding-agent";

const operations = {
  exec: (command, cwd, { onData, signal }) =>
    new Promise((resolve) => {
      const child = spawn("docker", ["exec", "-i", "k8s-tools", "sh", "-c", command], { signal });
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.on("close", (code) => resolve({ exitCode: code }));
    }),
};

const bash = createBashTool(process.cwd(), { operations });
```

Trace one command. The model asks for `kubectl get pods`. The tool calls `exec`. The function starts `docker exec -i k8s-tools sh -c "kubectl get pods"` on the host.

Output flows back through `onData` as the command prints. When the process closes, `exec` resolves with the exit code, and the tool reports it. The command never ran in the host's shell, so it never saw the host's files.

The sketch leaves out error handling, the timeout and the `env` option. A real backend must handle a missing container and must pass the signal that cancels a command.

```inkling
title "Two ways to box the commands"
layout compare
columns "Whole process in a container", "Only commands sent away"
row "Host pi is exposed": no, yes
row "Extensions are exposed": no, yes
row "Setup effort": "image per expert", "one tool container"
step 1: host-pi-is-exposed "Boxing the whole process keeps pi itself away from the host"
step 2: extensions-are-exposed "With a backend, extensions still run with your rights"
step 3: setup-effort "A backend needs less setup but covers less"
```

This is the trade-off. Isolating only the tools is narrower than containing the whole process. The host pi and its extensions still run with your rights.

> **Key idea:** BashOperations lets you choose where bash commands run, for example over SSH or in a container, while pi stays on the host.

## How pi does it

`BashOperations.exec(command, cwd, { onData, signal, timeout, env })` returns `{ exitCode }`, with the comment "Override these to delegate command execution to remote systems (for example SSH)." (packages/coding-agent/src/core/tools/bash.ts:70-94). The tool is made by `createBashTool(cwd, { operations, spawnHook, commandPrefix, exposeSessionEnvironment })` (bash.ts:213-224). pi's SSH example is packages/coding-agent/examples/extensions/ssh.ts:81-110 and 129-176. The trade-off is in packages/coding-agent/docs/security.md:13-17.

## What you have now

You can now move bash commands to another place and keep credentials out of the pi process. The commands that stay local still start with pi's whole environment, including your model key. How do you give each command only the variables it needs?
