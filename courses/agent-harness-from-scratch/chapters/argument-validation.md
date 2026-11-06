# Argument validation: checking the model's request before running it

The registry finds the right tool by name. But a tool call carries its arguments as raw JSON text, written by the model one token at a time. Usually it is fine. Sometimes a required field is missing, a number arrives as the text `"ten"`, or the text is cut off halfway because the reply hit its length limit. If you hand that to `execute`, the tool crashes somewhere deep inside with a message the model cannot act on. What should happen first?

```inkling
title "How an argument check runs"
layout down
model: box "Model\nwrites raw JSON" yellow
parse: box "parseArgs\nJSON to object"
check: box "checkArgs\nagainst schema"
tool: box "read_file\nthe tool"
err: box "Tool error result\nto the model"
step 1: model "The model writes the arguments as raw JSON text"
step 2: parse "parseArgs turns the text into an object, or reports broken JSON"
step 3: check "checkArgs looks for missing, unknown and mistyped fields"
step 4: tool "Every field is good, so the tool runs"
step 5: err "A problem is found, so the model gets an error result"
model -> parse : "raw text"
parse -> check : "object"
check -> tool : "all fields good"
check -> err : "problem found"
err -> model : "Error: invalid arguments..."
circle check
note err "the model fixes it\non the next step"
```

## Check the form at the counter

Think of handing in a form at a council office. The clerk checks it before it goes to the back room: every required box filled, dates written as dates. If something is wrong, you get it back with a note saying exactly which box, and you fix it on the spot. The picture stops holding in one way: the clerk cannot judge whether your request makes sense, only whether the form is complete. The tool still has to check its own rules.

Argument validation means parsing the model's arguments and checking them against the tool's schema before the tool runs, and turning every problem into a clear tool error result. Two steps:

```ts
// src/tools.ts (additions)
export function parseArgs(raw: string): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  if (raw.trim() === '') return { ok: true, args: {} }
  try {
    const value = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return { ok: false, error: 'invalid arguments: expected a JSON object' }
    return { ok: true, args: value }
  } catch {
    return { ok: false, error: `invalid arguments: not valid JSON: ${raw.slice(0, 200)}` }
  }
}

export function checkArgs(schema: ToolSchema['parameters'], args: Record<string, unknown>): string | null {
  for (const name of schema.required ?? [])
    if (!(name in args)) return `invalid arguments: missing required field "${name}"`
  for (const [name, value] of Object.entries(args)) {
    const want = schema.properties?.[name]?.type
    if (!want) return `invalid arguments: unknown field "${name}"`
    const got = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
    if (got !== want && !(want === 'integer' && Number.isInteger(value)))
      return `invalid arguments: "${name}" should be ${want}, got ${got}`
  }
  return null
}
```

`parseArgs` treats empty text as no arguments, which some models send for tools without parameters. Broken JSON becomes an error that quotes the start of what arrived, so the model can see its own mistake. `checkArgs` is a small subset of JSON Schema: required fields, known fields and simple types. A real project would use a full validator library, but the shape of the result is the same: one sentence the model can act on.

Trace a call to `read_file`, whose schema requires `path` of type string and allows `limit` of type integer:

| Raw arguments | Result sent back |
|---|---|
| `{"path":"a.ts"}` | runs the tool |
| `{"path":"a.ts","limit":"ten"}` | `Error: invalid arguments: "limit" should be integer, got string` |
| `{"file":"a.ts"}` | `Error: invalid arguments: missing required field "path"` |
| `{"path":"a.ts` | `Error: invalid arguments: not valid JSON: {"path":"a.ts` |

In each failing case the tool never runs, the call still receives a result paired with its id, and the next step usually fixes it.

The schema cannot express every rule. An edit tool needs the text to replace to be non-empty and different from its replacement. Those checks stay inside the tool, and they throw with the same kind of plain message.

> **Key idea:** Argument validation parses the model's raw JSON and checks it against the tool's schema before the tool runs, returning each problem as a specific error result the model can fix on its next step.

**In DeepSeek Harness:** malformed JSON is kept as the raw string so the tool can report it, and empty arguments become `{}`. Tools built with `defineTool` declare parameters in a small schema format compiled to JSON Schema, and are validated against it; a failure throws `ToolArgsError` with "invalid arguments: ..." and code `INVALID_ARGS`. Tools that bring raw JSON Schema, such as those from external servers, validate their own input. The edit tool in `packages/fs/tool-fs/src/edit.ts` still rejects an empty `old_string` and an `old_string` equal to `new_string`. Any thrown error becomes `isError: true` with text `Error: <message>`.

## What you have now

Every call is now checked before it runs, and every failure reaches the model as a tool error result it can learn from, building on the tool registry and the schemas it holds. Validation is one check among several you will want around each call: logging, blocking, timing, trimming results. Where do all those checks go, and in what order?
