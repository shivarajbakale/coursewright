# Agent folder: one settings home for each expert

You now have an expert with a prompt, notes, skills and templates. You run it, and then you run a second expert. Both write their session history to the same place and read the same saved login. Your SQL history ends up next to the Kubernetes history. Where can each expert keep its own state?

Think of lockers at a gym. Each member has a locker for shoes, a lock and a towel. If two members share one locker, their shoes and towels get mixed, and one can open the lock with the other's key. One locker per member keeps the two apart. The comparison differs from pi in one way. A locker only stores items, but pi's folder also holds settings that change how the program behaves.

pi keeps its state in one place, the **agent folder**. By default it is `~/.pi/agent`. It holds these files and folders:

- `settings.json`, `auth.json`, `models.json` and `mcp.json`
- `SYSTEM.md`, `APPEND_SYSTEM.md` and `AGENTS.md`
- `extensions/`, `skills/` and `prompts/`
- `sessions/` and `trust.json`

You can move the whole folder with an **environment variable**. It is a named value that a program reads from the place where it runs. You set it as `NAME=value` in front of a command. pi reads the one called `PI_CODING_AGENT_DIR`. If it is set, pi uses that folder. If not, it uses `~/.pi/agent`.

```inkling
title "One shared folder or one per expert"
layout compare
columns "One shared folder", "One folder per expert"
row "Sessions": "mixed together", "kept apart"
row "Credentials": "shared by all", "separate"
row "Settings": "one set for all", "one set each"
row "Risk of mixing": yes, no
step 1: sessions "Shared sessions put every expert's history in one place"
step 2: credentials "Shared credentials give every expert the same keys"
step 3: settings "A folder for each expert gives it its own settings"
step 4: risk-of-mixing "The shared folder risks mixing; separate folders do not"
```

Here is the `fleet` case. You create `agents/sql/` and run this:

```ts
// shell command, shown as a string for this lesson
const cmd =
  "PI_CODING_AGENT_DIR=agents/sql pi --model deepseek/deepseek-flash";
```

After the run, `agents/sql/sessions/` holds only the SQL expert's sessions. The Kubernetes expert gets `agents/k8s/` in the same way, and its history never lands in the SQL folder.

The move has one cost. `auth.json` lives in the agent folder, so a new folder has no saved login. Give pi the key through the environment variable `DEEPSEEK_API_KEY` instead. Also add `agents/*/auth.json` and the sessions to `.gitignore`, so keys and history do not enter the repository.

To move only the sessions, use `--session-dir` or the variable `PI_CODING_AGENT_SESSION_DIR`.

> **Key idea:** PI_CODING_AGENT_DIR moves pi's settings, sessions, credentials and extras to a folder of your choice, so each expert gets its own.

## How pi does it

The variable name is built as `${APP_NAME.toUpperCase()}_CODING_AGENT_DIR`, which gives PI_CODING_AGENT_DIR (packages/coding-agent/src/config.ts:608-610). The function `getAgentDir()` uses it, else `~/.pi/agent` (config.ts:630-636). The files in the folder are listed in packages/coding-agent/docs/configuration.md:7-25. The sessions alone move with PI_CODING_AGENT_SESSION_DIR (config.ts:611).

## What you have now

You can give each expert its own state, so histories and logins stay apart. This rests on the domain expert: one model, many packs, and now many folders. Settings can live in the agent folder and in a project folder, and the two can disagree. Which one wins?
