# Expert prompt: replacing pi's opening and adding your own

An expert needs a role. The role lives in the system prompt, and pi already writes one that says "you are a coding assistant". If you leave it, your SQL expert thinks it should edit files. How do you replace that opening text with your own role, and when is it better to add to it instead?

Think of a uniform. A new hospital worker gets a standard badge and a standard list of rules. For a surgeon, the hospital swaps the whole kit. For a visiting nurse, it keeps the standard kit and adds one extra sheet. A prompt works the same way. The comparison differs in one point: a person can ignore a sheet, but a model reads every word you send it.

As you saw with the prompt patch, pi builds the system prompt from named sections. In order, they are:

1. `preamble`: the opening text that says who the agent is.
2. `tools`: the list of active tools.
3. `rules`: pi's own rules for how to behave.
4. `docs`: pointers to pi's documentation.
5. `addendum`: extra text added after pi's own.
6. `project_context`: instruction files found on disk.
7. `skills`: procedures the model can load.
8. `cwd`: the current working folder.

Two flags change this list. The word **preamble** means the opening section. The word **addendum** means an extra section that pi puts after its own text.

```inkling
title "Replace or add to the prompt"
layout compare
columns "--system-prompt", "--append-system-prompt"
row "Preamble": "your text", "pi's text"
row "Tools, rules, docs": no, yes
row "Your text": "replaces the preamble", "joins the addendum"
row "Procedures and cwd": yes, yes
step 1: system-prompt "The first flag replaces the preamble and drops pi's tools, rules and docs"
step 2: append-system-prompt "The second flag keeps everything and adds an addendum"
step 3: your-text "Each flag decides where your text goes"
```

Here is a small case. You write `packs/sql/prompt.md`, about eight lines:

```ts
// packs/sql/prompt.md, shown as a string for this lesson
const prompt = `You are an SQL analyst for the shop database.
Only read data. Never write.
Never guess column names. Look them up first.
Show the query you ran.
Revenue excludes orders with total <= 0.
Answer first, then show the SQL.`;
```

Then you run pi with `--system-prompt packs/sql/prompt.md`. If the value is a path to a file that exists, pi reads the file. Otherwise it uses the value as text. Now the preamble is your role. pi's coding rules and tool list are gone, and the SQL expert adds its own tools later. The addendum, the project instructions, the procedures and the working folder are still added.

Which flag should you choose? Use replace when the expert must not behave like a coding assistant, as with SQL. Use append when the expert is close to a coding assistant and should keep its habits. `--append-system-prompt` can be given several times, and pi joins the values.

You can also set both without flags. pi reads `SYSTEM.md` and `APPEND_SYSTEM.md` instead. It takes `.pi/SYSTEM.md` from a trusted project, and otherwise `~/.pi/agent/SYSTEM.md`.

> **Key idea:** `--system-prompt` replaces the preamble and drops pi's tools, rules and docs. `--append-system-prompt` keeps all of them and adds an addendum.

## How pi does it

pi builds the sections in this order: preamble, tools, rules, docs, addendum, project_context, skills, cwd (packages/coding-agent/src/core/system-prompt.ts:128-192). With a custom prompt, only the preamble is replaced and tools, rules and docs are left out. The addendum, project_context, skills and cwd are still added (system-prompt.ts:152-185). A flag value that is a path to an existing file is read as that file (packages/coding-agent/src/core/resource-loader.ts:195-210). The repeated `--append-system-prompt` values are joined into the addendum (packages/coding-agent/src/cli/args.ts:123-125). Without flags, pi uses `.pi/SYSTEM.md` in a trusted project, else `~/.pi/agent/SYSTEM.md`, and the same for `APPEND_SYSTEM.md` (resource-loader.ts:1245-1271).

## What you have now

You can give an expert its own role: replace the preamble to drop pi's coding habits, or append to keep them. This builds on the domain pack and on the prompt patch. The prompt is only text you write once. Where can knowledge live that sits in files near the data, so you do not rewrite the prompt for every folder?
