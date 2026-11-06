# Tool schema: a description of a function the model may request

A model only writes text. It cannot open a file on your disk, check today's date, or run a calculation it is unsure of. Your program can do all of those. So the obvious plan is to let the model ask your program to run a function for it. But the model cannot ask for a function it has never heard of. How do you tell it what is available?

## A menu with order options

Think of a restaurant menu. Each dish has a name, a line saying what it is, and the choices you must make: size, sauce, how spicy. You cannot walk into the kitchen. You can only order from the menu, and the menu tells you how to fill in the order.

You give the model a menu of your functions in the same way. A function the model may request is called a tool. For each tool you describe three things:

```inkling
title "How a tool schema works"
layout down
model: box "Model" yellow
menu: box "Tool schema\nname: read_file\ndescription: ...\nparameters: JSON Schema"
ask: box "Tool request\nread_file"
args: box "Arguments\n{\"path\": \"notes.txt\"}"
run: box "Your program\nruns read_file"
model -> menu : "reads the menu as text"
menu -> model : "the model asks for read_file"
model -> ask : "names the tool it wants"
ask -> args : "carries the arguments"
args -> run : "your program checks, then runs"
note menu "the schema describes; it does not enforce"
step 1: model "The model can only write text"
step 2: menu "It reads a menu of your functions"
step 3: ask "It asks for read_file by name"
step 4: args "It fills in the arguments"
step 5: run "Your program checks the request, then runs it"
```

- a `name`, such as `read_file`, which the model will use to ask for it;
- a `description`, in plain words, saying what it does and when to use it;
- `parameters`: the arguments it takes, written as a JSON Schema.

JSON Schema is a standard way of describing the shape of JSON data in JSON itself. It says which fields an object has, the type of each one, and which are required. Together, these three parts are the tool schema.

The picture stops holding at the waiter. A waiter refuses an order that is not on the menu. The schema does not enforce anything. The model reads it as text and usually follows it, but it can still ask for a tool that does not exist or leave out a required argument. Your program has to check what arrives.

## Your first tool schema

Add the type to your project, then describe one tool that reads a text file.

```ts
// src/types.ts (add)
export type ToolSchema = {
  name: string
  description: string
  parameters: Record<string, unknown> // a JSON Schema object
}
```

```ts
// src/tools.ts
import type { ToolSchema } from './types.ts'

export const readFileSchema: ToolSchema = {
  name: 'read_file',
  description: 'Read a UTF-8 text file in the current folder and return its full contents.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path, for example "notes.txt"' },
    },
    required: ['path'],
  },
}
```

Read the parameters from the outside in. The arguments form one JSON `object`. It has one property, `path`, whose type is `string`. The `required` list says `path` must be present. So a valid set of arguments looks like `{"path": "notes.txt"}`.

To offer the tool, add a `tools` field to the request body. DeepSeek's format wraps each schema in a small envelope:

```ts
body: JSON.stringify({
  model: 'deepseek-flash',
  thinking: { type: 'disabled' },
  messages,
  tools: [{ type: 'function', function: readFileSchema }],
})
```

The provider turns the schemas into tokens and places them in the model's input, much like extra text near the system prompt. Two things follow. Schemas cost tokens in every request, and they take room in the context window. And the description is instructions for the model, so write it for a reader: say what the tool does, what it returns, and what a good argument looks like. A vague description leads to the wrong tool being picked, or the right one being missed.

Nothing runs yet. You have only told the model that `read_file` exists.

> **Key idea:** A tool schema describes one function the model may request: a name, a plain-language description, and a JSON Schema for its arguments, sent in the request's `tools` list.

**In DeepSeek Harness:** tools are written with a `defineTool` helper and a small schema shorthand that compiles to JSON Schema. Its own file reader, in `packages/fs/tool-fs/src/read.ts`, is named `read` and takes `file_path`, plus optional `offset` and `limit`.

## What you have now

The model can now see a menu of your functions, described with a name, a description and a JSON Schema. This is what the third stop reason was hinting at. But when the model decides it wants `read_file`, what exactly does its reply look like?
