# Tool allowlist: the expert sees only its own tools

A plain pi session can read files, run shell commands, edit files and write files. A SQL expert needs none of the last three. If the model can see them, it can ask for them. How do you make sure it cannot?

Think of a tool belt for a job. A plumber who fixes a sink does not carry a chainsaw. The reason is not care. The belt holds only what the job needs.

An **allowlist** works the same way: it names the tools a session may have, and every other tool is absent. The comparison differs in one way. A belt is carried by a person who decides what to use. Here the model decides, so the missing tool must not exist for the model at all.

The flag `--tools` gives pi the exact list. Tools not on the list never enter the session. The model never sees their names, so it cannot call them. A prompt that asks the model to avoid `bash` is a request. A tool that is not there is a fact.

This is the command that runs the SQL expert in `fleet`:

```bash
PI_CODING_AGENT_DIR=agents/sql pi --model deepseek/deepseek-flash \
  --system-prompt packs/sql/prompt.md -e packs/sql/extension.ts \
  --tools read,sql_schema,sql_query
```

```inkling
title "Plain pi against the SQL expert"
layout compare
columns "Plain pi", "SQL expert"
row "read": "yes", "yes"
row "bash": "yes", "no"
row "edit": "yes", "no"
row "write": "yes", "no"
row "sql_schema": "no", "yes"
row "sql_query": "no", "yes"
step 1: read "The expert keeps read"
step 2: bash "bash is not on the list, so it never enters the session"
step 3: sql-schema "The two SQL tools come from the extension"
```

Follow the list. `read` is on it, so the expert can open files. `sql_schema` and `sql_query` are on it, so the expert can look at the tables and run queries. `bash`, `edit` and `write` are not on it. Because of this, the expert cannot change a file or run a command, whatever the model asks.

Keep `read` if the expert has skills. The section of the prompt that lists skills needs `read` or `bash`, so that the model can open a skill file.

Other flags change the list in other ways:

- `-nt` or `--no-tools` starts with no tools.
- `-nbt` or `--no-builtin-tools` drops `read`, `bash`, `edit` and `write` but keeps extension tools.
- `-xt` or `--exclude-tools` removes the names you give.
- A list made only of `+name` and `-name` entries changes the default list instead of replacing it. Mixing plain names with `+` or `-` entries is an error.

One more rule. If an extension registers a tool with the name of a built-in, the extension tool wins. The built-in names are `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find` and `ls`. This lets a pack replace `bash` with a safer version under the same name.

At run time, an extension can call `pi.setActiveTools(names)` to switch the set.

> **Key idea:** An allowlist names the exact tools a session has. A tool not on it never enters the session, so the model cannot call it.

## How pi does it

- The flags `-nt`, `-nbt`, `-t` and `-xt` are defined at packages/coding-agent/src/cli/args.ts:147-167. The error for mixed lists is at packages/coding-agent/src/core/settings-manager.ts:97-105.
- Tools not on the allowlist never enter the registry (packages/coding-agent/src/core/agent-session.ts:3592-3596). An extension tool with a built-in's name wins (packages/coding-agent/src/core/agent-session.ts:3593-3609).
- The built-in names are listed at packages/coding-agent/src/core/tools/index.ts:95-105. An example override is packages/coding-agent/examples/extensions/tool-override.ts:69-129.
- The run-time switch is shown at packages/coding-agent/examples/extensions/plan-mode/index.ts:106-112.

## What you have now

You have a SQL expert that sees three tools and no more, set by one flag. It builds on the custom tool, which supplies the two SQL tools. The tools so far are code you wrote. How does pi reach tools that a program outside it already offers?
