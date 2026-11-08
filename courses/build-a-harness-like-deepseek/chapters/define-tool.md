# defineTool: a typed tool with checked arguments

In the first agent, each tool was two separate things: a JSON Schema you wrote by hand, and a function. Nothing compared the model's arguments with the schema. A model can send `{"path": 42}` to a tool that expects a file name, and the function then fails in a confusing way, or does the wrong thing. The function also returned whatever text it liked. How do you make sure a tool body only runs with arguments that match its schema, and always returns data of a known shape?

## A form at a counter

Think of a clerk at a post office counter. You hand over a form. The clerk checks every box before the form goes to the back office: a name in the name box, a number in the number box. A form with a missing box comes straight back to you. The back office only ever sees correct forms.

In a harness, the form is the model's arguments, the clerk is a check that the harness runs, and the back office is the tool body. The comparison differs in one way. The clerk can talk to you and point at the wrong box. The harness cannot talk to the model during a call. It returns a tool error result that lists each wrong box, and the model reads it and sends a new call.

```inkling
title "One definition, three jobs"
layout flow
spec: sticky "One tool definition"
schema: box "JSON Schema\nfor the model"
check: diamond "Arguments\nmatch?"
body: box "Tool body"
value: box "One value"
text: box "Text for\nthe model"
err: box "Error result" red
spec -> schema
spec -> check
check -> body : "yes"
check -> err : "no"
body -> value -> text
circle check
step 1: spec, schema "One definition produces the schema the model sees"
step 2: check, err "The same definition checks every call's arguments"
step 3: body "Only matching arguments reach the body"
step 4: value, text "The body returns one value, and a render function turns it into text"
```

## The smallest typed tool

Here is `count_lines` written with `defineTool` in `src/tools.ts`. You describe each parameter once, and mark the ones the model must send with `required: true`.

```ts
const countLines = defineTool({
  name: 'count_lines',
  description: 'Count the lines in a text file.',
  parameters: {
    path: { type: 'string', required: true, description: 'File to count' },
  },
  output: {
    schema: { type: 'integer' },
    render: (_args, value) => [{ type: 'text', text: `${value} lines` }],
  },
  async execute(args) {
    const text = await readFile(args.path, 'utf8')
    return text.split('\n').length
  },
})
```

And here is the core of `defineTool` itself:

```ts
export function defineTool(spec: ToolSpec): ToolDefinition {
  const parameters = toJsonSchema(spec.parameters)
  return {
    name: spec.name,
    description: spec.description,
    parameters,
    output: spec.output,
    async execute(args: unknown) {
      const problems = validate(parameters, args)
      if (problems.length > 0) throw new Error(`invalid arguments: ${problems.join('; ')}`)
      return spec.execute(args)
    },
  }
}
```

`toJsonSchema` turns the parameter map into the JSON Schema the model sees: `{"type":"object","properties":{"path":{"type":"string","description":"File to count"}},"required":["path"]}`. The `required: true` flags become the `required` list.

Trace two calls through it:

1. The model sends `{"path": 42}`. `validate` returns one problem, `/path: expected string`. The wrapper throws, the body never runs, and the loop sends back a tool error result with that text.
2. The model sends `{"path": "notes.txt"}`. `validate` returns no problems. The body returns the number `42`.
3. The harness calls `render(args, 42)`. The model receives the text `42 lines`.

The body returns a number, not a sentence. That number is the tool's **value**: the one piece of JSON data a tool body returns, of the shape `output.schema` declares. Text is made from it in one separate place. Because of this, other code can use `42` directly and never has to read it back out of a sentence.

> **Key idea:** defineTool turns one parameter description into a schema, checks every call's arguments against it, and returns one declared value.

## How dsh does it

`defineTool` is in `packages/core/tools/src/schema.ts` (line 555). It compiles the parameters with `parameterSchemaSpecToJsonSchema` (line 450). Its `execute` wrapper (lines 598-602) validates first and throws `ToolArgsError` with the code `INVALID_ARGS` (line 462). The authoring guide, `docs/cookbook/adding-a-tool.md`, says: "Do not return content blocks from the body or make callers parse prose for ids and fields." When the body's value does not match `output.schema`, dsh fails the call with `ToolOutputError`, code `INVALID_TOOL_OUTPUT` (`packages/core/tools/src/contracts.ts`, line 310).

## What you have now

A tool is now one definition that carries its schema, checks its arguments and returns one value, which the loop turns into a tool result. You still pass each tool to the loop by hand. Where should many tools live, so plugins can add them and take them away?
