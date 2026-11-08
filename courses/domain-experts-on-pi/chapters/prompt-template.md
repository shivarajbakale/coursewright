# Prompt template: a saved prompt behind a slash command

A skill is chosen by the model. People who use your expert also type the same kind of request again and again, such as "report revenue for Germany". They word it differently each time, and some wordings get weak answers. How can you give them one well-worded request that they fill in with a few words?

Think of a printed order form at a restaurant. The form has blanks for the dish and the table number. The customer writes two words and the kitchen gets a complete order. The comparison differs from pi in one way. A form is fixed when it is printed, but pi fills the blanks at the moment you press Enter.

pi does this with a **prompt template**. It is a Markdown file. The file name becomes a command. If the file is `revenue.md`, you type `/revenue`. A **slash command** is an input that starts with `/` and that pi handles before the model sees it.

The text of the file holds placeholders. pi replaces them with the words you type after the command:

- `$1` is the first word, and `$2` is the second.
- `$@` is all the words together.
- `${1:-default}` is the first word, or the default text if you typed nothing.

The file may start with front matter that has a `description` and an `argument-hint`. Without a description, pi uses the first line of the file, cut to 60 characters.

```inkling
title "From a typed line to a model message"
layout flow
typed: box "You type /revenue Germany"
file: box "revenue.md template"
filled: box "Filled message"
model: box "Model"
typed -> file : "name matches"
file -> filled : "fill $1"
filled -> model : "sent as your message"
step 1: typed "You type the command and one word"
step 2: file "pi finds the file with that name"
step 3: filled "pi fills the blanks in the text"
step 4: model "The model gets a complete request"
```

Here is the `fleet` case. You write `packs/sql/prompts/revenue.md` with this text:

```ts
// packs/sql/prompts/revenue.md, shown as a string for this lesson
const template =
  "Using the monthly-revenue skill, report revenue for " +
  "${1:-all countries} in ${2:-the last 12 months}. Show the SQL.";
```

You type `/revenue Germany`. The first word fills `$1`, so it becomes "Germany". You typed no second word, so `$2` uses its default, "the last 12 months". The model receives: "Using the monthly-revenue skill, report revenue for Germany in the last 12 months. Show the SQL." The template also names the skill, so the request and the procedure work together.

A template and a skill are alike, because both are Markdown files. They differ in who chooses. A person chooses a template by typing its command. The model chooses a skill by reading its description. You find templates in `~/.pi/agent/prompts`, in `.pi/prompts` of a trusted project, or at a path given with `--prompt-template <path>`.

When you type a line, pi handles it in this order: extension commands, then input handlers, then `/skill:` and template expansion.

> **Key idea:** A prompt template is a Markdown file whose name becomes a slash command. Typing it fills $1 and $@ and sends the text as your message.

## How pi does it

The file name becomes the command name (packages/coding-agent/src/core/prompt-templates.ts:134). The front matter has `description` and `argument-hint`, and the first line is the fallback description, cut to 60 characters (prompt-templates.ts:136-147). Placeholders `$1`, `$2`, `$@` and `${1:-default}` are handled in prompt-templates.ts:66-110. The order for a typed line is extension commands, input handlers, then `/skill:` and template expansion (packages/coding-agent/src/core/agent-session.ts:2113-2156).

## What you have now

You can give people a short command that expands into a well-worded request, and you know that a person picks a template while the model picks a skill. Your pack now has a prompt, notes, skills and templates, all in different places. Where does pi keep the settings and history for one expert, so that two experts do not mix them?
