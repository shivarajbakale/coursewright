# Tool schema: describing a function the model may ask for

Ask a model "How many lines are in notes.txt?" and it can only guess. The file is on your computer, and the model only predicts text from the request. Your program can count the lines in two lines of TypeScript. How can the model know that your program offers this, and how must it ask?

## A menu with an order form

Think of a restaurant menu. Each dish has a name, a short description that helps you choose, and the choices you must give: "Pizza. Size: small, medium or large (required)." The kitchen cooks, not you. You read the menu and order in the form it describes.

A function your program offers to the model is called a **tool**. Your program sends a menu of tools with every request. Each entry is a **tool schema**. It has three parts.

- `name`: the exact name the model uses to ask for the tool.
- `description`: plain text that tells the model what the tool does and when to use it.
- `input_schema`: the shape of the arguments, written as **JSON Schema**. JSON Schema is a standard JSON format that describes other JSON. It says which fields an object has, the type of each field and which fields are required.

The comparison differs from the field in one way. A diner understands the menu. The model reads the schema as more tokens in the request, and it predicts a request that fits it. It usually fits, but your program must still check what comes back.

## One tool for counting lines

Describe a `count_lines` tool:

```ts
// src/tools.ts
import type { Tool } from './llm.ts'

export const tools: Tool[] = [
  {
    name: 'count_lines',
    description: 'Count the lines in a text file. Use it when the user asks how long a file is.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file, relative to the current folder' },
      },
      required: ['path'],
    },
  },
]
```

Send the menu with the request. `callModel` gains a second parameter:

```ts
// src/llm.ts
export type Tool = { name: string; description: string; input_schema: Record<string, unknown> }

export async function callModel(messages: Message[], tools: Tool[] = []): Promise<Reply> {
  // ...same fetch as before; the body gains the tools when there are any:
  // { model, max_tokens, system: SYSTEM, messages, ...(tools.length > 0 ? { tools } : {}) }
}
```

```inkling
title "The parts of one tool schema"
layout mindmap
- count_lines
  - name: what to ask for
  - description: when to use it
  - input_schema
    - path: a string
    - path is required
step 1: count-lines "One tool the program offers"
step 2: name-what-to-ask-for "The name the model must use"
step 3: description-when-to-use-it "The text that helps the model choose"
step 4: input-schema "The shape of the arguments"
```

Now test three sets of arguments against the `input_schema`:

1. Check `{ "path": "notes.txt" }`. It has `path`, and `path` is a string, so it fits.
2. Check `{ "file": "notes.txt" }`. The required field `path` is missing, so it does not fit.
3. Check `{ "path": 42 }`. `path` is a number, not a string, so it does not fit.

A good description matters as much as a correct schema. The model chooses a tool only from its name and description, so "Count the lines in a text file" helps more than "Utility function". The schemas are also part of the input. They use tokens in every request and take room in the context window.

> **Key idea:** A tool schema tells the model a tool's name, what it does and, in JSON Schema, which arguments it takes.

## How dsh does it

In DeepSeek Harness every tool lives in its own package. The `bash` tool is in the package `@deepseek-ai/dsh-tool-bash`. Its file `src/index.ts` (lines 368-379) declares a required string `command`. dsh writes parameters in a short form, and `packages/core/tools/src/schema.ts` (line 578) turns them into JSON Schema. The package `packages/core/tools`, named `@deepseek-ai/dsh-tools`, collects the schemas of every tool (`src/index.ts`, line 316). The file `packages/llm/llm-deepseek/src/serialize.ts` (lines 161-166) sends each one as `name`, `description` and `input_schema`.

```inkling
title "Where the tool schemas come from in dsh"
layout right
bash: box "dsh-tool-bash\nbash"
fs: box "dsh-tool-fs\nread, write, edit"
tools: box "dsh-tools"
deepseek: box "dsh-llm-deepseek"
api: icon server "DeepSeek API"
bash -> tools : "schema"
fs -> tools : "schemas"
tools -> deepseek : "every schema"
deepseek -> api : "tools in the request"
highlight tools
step 1: bash, fs "Each tool package declares its own schema"
step 2: tools "dsh-tools collects all of them"
step 3: deepseek "dsh-llm-deepseek writes them as input_schema"
step 4: api "They go to the model with every request"
```

## What you have now

Your request now carries a system prompt, the whole conversation and a menu of tool schemas. The model knows `count_lines` exists and which arguments it takes. What does the model's reply look like when it wants your program to run it?
