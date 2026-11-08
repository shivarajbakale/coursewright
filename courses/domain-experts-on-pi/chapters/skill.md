# Skill: a procedure the model reads when needed

A good expert knows many procedures. The SQL expert needs one for monthly revenue, one for customer churn and one for cleaning dates. If you paste all of them into the prompt, the prompt grows long and every request pays for text it does not use. How can an expert carry many procedures and still keep the prompt short?

Think of a cookbook on a shelf. You do not memorise every recipe. You know the titles, and you open the book at the page when you decide to cook that dish. The comparison differs from pi in one way. The model, not a person, decides to open the page. It does so by calling the `read` tool.

pi does this with a **skill**. A skill is a folder with one file in it, called **SKILL.md**. The file starts with front matter: a small block of `name` and `description` lines between `---` marks. Below it are the steps in Markdown.

pi does not put the steps in the prompt. It puts only each skill's name, description and file path. The prompt tells the model to use the `read` tool to load a skill's file when the task matches its description. So the cost in the prompt is a few lines for each skill, not the whole procedure.

```inkling
title "The model loads a skill when a task matches"
layout sequence
user: person "You"
pi: box "pi"
model: box "Model"
file: box "SKILL.md"
user -> pi : "Revenue by country?"
pi -> model : "Question and skill descriptions"
model -> file : "read the file"
file --> model : "The four steps"
model -> pi : "Follow the steps"
pi --> user : "Answer"
steps auto
```

Here is the `fleet` case. You create `packs/sql/skills/monthly-revenue/SKILL.md`. Its description is "Monthly revenue by country from the orders table". It has four steps:

1. Check the schema.
2. Group by the month of `placed_at` and by country.
3. Exclude orders with a total of 0 or less.
4. Convert cents to currency.

You run the expert with `--skill packs/sql/skills`. A user asks for revenue by country. The model sees the description in its prompt, decides the task matches and reads the file. Then it follows the four steps. If the question is about something else, the model never opens the file.

The rules for the front matter are strict. The `name` has lowercase letters, digits and hyphens, and at most 64 characters. The `description` is required and has at most 1024 characters. A skill without a description is not loaded. Write the description so the model can tell when it applies.

There is a trap. pi adds the skills section only when the `read` or `bash` tool is active. An expert with only tools of its own domain silently loses its skills. That is why the SQL expert keeps `read` in its tool list. A user can also force one skill by typing `/skill:name`.

> **Key idea:** Only a skill's name, description and path sit in the prompt. The model reads the full SKILL.md when a task needs it.

## How pi does it

The front matter limits are in packages/coding-agent/src/core/skills.ts:11, 14, 95 and 122. A skill without a description is not loaded (packages/coding-agent/docs/skills.md:81). The prompt text lists each skill as `<skill><name>…</name><description>…</description><location>…</location></skill>` (skills.ts:358-389). The skills section appears only if the read or bash tool is available (packages/coding-agent/src/core/system-prompt.ts:173-181). A user forces a skill with `/skill:name` (packages/coding-agent/src/core/agent-session.ts:2228-2257). pi finds skills in `~/.pi/agent/skills`, in `.pi/skills` of a trusted project, and at paths given with `--skill <path>`.

## What you have now

You can give an expert many procedures at a small cost in the prompt, because the model loads each file only when the task needs it. The model chooses a skill, but sometimes the person wants to choose the request. How can you give people a ready-made, well-worded request to type?
