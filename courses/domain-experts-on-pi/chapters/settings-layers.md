# Settings layers: global settings with project overrides

Each expert now has its own agent folder with a `settings.json`. A project folder can have a settings file too. Say your SQL expert lists three default tools, and a test folder wants a different list. Which file wins, and how do the two combine?

Think of house rules and a room sign. The house has a rule list for every room. One room puts up a sign that says "no shoes here". The sign adds to the house rules, and where the sign says something different, the sign wins. The comparison differs from pi in one way. A guest can ignore a sign, but pi decides in advance whether it will read a project's file at all.

pi reads two files. The global file is `settings.json` in the agent folder. The project file is `.pi/settings.json` in the working folder. pi merges them by these rules:

1. An object merges key by key, and it goes down into nested objects.
2. A list from the project replaces the global list.
3. A plain value from the project, such as a number or a string, replaces the global value.

There is one exception. In `defaultTools`, an entry that starts with `+` or `-` changes the global list instead of replacing it.

Why the second rule? A project list that only added items would make it impossible to remove one. Replacing gives the project full control of the list.

```inkling
title "The project file sits over the global file"
layout stack
- Project .pi/settings.json
- Trust check
- Agent folder settings.json
step 1: agent-folder-settings-json "The agent folder file is the base"
step 2: trust-check "pi asks if the project is trusted"
step 3: project-pi-settings-json "A trusted project file merges on top"
```

The gate is **project trust**. It is pi's yes or no decision to load a project's own settings, extensions, skills and prompts. The gate exists because project files can load code. A folder you downloaded could run something you did not read. pi decides in this order:

1. The flag `--approve` (`-a`) or `--no-approve`.
2. Then extensions.
3. Then the answer saved in `~/.pi/agent/trust.json`.

Trust does not limit what tools can touch. It only decides which project files load. Context files such as AGENTS.md load without trust.

Here is the `fleet` case. `agents/sql/settings.json` holds:

```ts
// agents/sql/settings.json, shown as an object for this lesson
const global = { defaultTools: ["read", "sql_schema", "sql_query"] };
// a test folder's .pi/settings.json, trusted
const project = { defaultTools: ["-read"] };
```

In the test folder, `-read` starts with `-`. So pi does not replace the list. It removes `read` from the global list, and the tools there become `sql_schema` and `sql_query`. For unattended runs, pass `-a` only for folders that you control.

> **Key idea:** Global and project settings merge, a project list replaces the global one, and project files load only when the project is trusted.

## How pi does it

The global file is at `<agent folder>/settings.json` and the project file at `<cwd>/.pi/settings.json` (packages/coding-agent/src/core/settings-manager.ts:193-194, 319-320). Objects merge recursively, and arrays and plain values from the project replace the global ones (settings-manager.ts:65-82). The `+` and `-` entries in `defaultTools` are the exception (settings-manager.ts:123-147). Project settings load only when trusted (settings-manager.ts:366-369). The trust order is in packages/coding-agent/docs/security.md:62-76, and that trust does not limit what tools can touch (security.md:33).

## What you have now

You know how two settings files combine and why pi asks before it reads a project's files. This builds on the agent folder, which holds the global file. Your pack is now a set of files in several places. How do you ship all of it to another machine in one command?
