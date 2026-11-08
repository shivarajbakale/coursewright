# Custom tool: a domain action with a typed schema

An extension can now register things with pi. The SQL pack needs one thing above all: a tool that asks the shop database a question. What does pi need to know about such a tool, and what does the tool give back?

Think of a form at a bank counter. The form has a title and a note on what it is for. It has boxes with labels. A clerk reads the filled form, does the work, and hands back a receipt.

A custom tool has the same parts. It has a name and a description, which tell the model what the tool is for. It has a schema, which lists the boxes. It has an `execute` function, which does the work. The comparison differs in one way: the model fills in the form itself, and it can fill it in wrongly.

The schema is written with **TypeBox**: a library that writes JSON Schema in TypeScript. For example, `Type.Object({ sql: Type.String() })` describes an object with one text field named `sql`. JSON Schema is the format that models read to learn the shape of a tool's arguments.

This is `sql_query` in `packs/sql/extension.ts`. It uses `node:sqlite`, which comes with Node 22.5 and newer, and it opens the database read-only:

```ts
import { Type } from "typebox";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/shop.db", { readOnly: true });

pi.registerTool({
  name: "sql_query",
  label: "SQL query",
  description: "Run one read-only SQL query on the shop database",
  promptSnippet: "sql_query: run a read-only SELECT on shop.db",
  parameters: Type.Object({
    sql: Type.String(),
    limit: Type.Optional(Type.Number()),
  }),
  async execute(_id, params) {
    const rows = db.prepare(params.sql).all().slice(0, params.limit ?? 200);
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      details: { rows: rows.length },
    };
  },
});
```

```inkling
title "One sql_query call"
layout sequence
model: box "Model"
pi: box "pi"
tool: box "sql_query execute"
db: box "shop.db"
model -> pi : "sql_query, sql: SELECT ..."
pi -> tool : "params"
tool -> db : "prepare and run"
db --> tool : "rows"
tool --> pi : "content and details"
pi --> model : "content only"
note pi "details stay with your code"
steps auto
```

Follow one call. The model writes a call to `sql_query` with a query in `sql`. pi passes the arguments to `execute`. The function runs the query and keeps at most `limit` rows, or 200 when the model gives no limit. It returns two parts. `content` is what the model reads, here the rows as JSON text. `details` is data for your own code and for the screen, here a row count. pi does not send `details` to the model.

The `promptSnippet` adds one line about the tool to the tools list in the system prompt. Without it, a custom tool is left out of that list. `promptGuidelines` adds rule bullets to the prompt.

A second tool, `sql_schema`, takes no arguments. Its schema is `Type.Object({})`, and it returns the table and column names.

When something goes wrong, `execute` may throw an error. pi turns it into an error result that the model can read, so the model can correct its query.

> **Key idea:** A custom tool is a name, a description, a TypeBox schema and an execute function that returns content for the model and details for code.

## How pi does it

- The `execute` signature is `execute(toolCallId, params, signal, onUpdate, ctx)`, and it returns `Promise<AgentToolResult>` (packages/coding-agent/src/core/extensions/types.ts:670-676).
- The result has `content` (text or image), `details`, an optional `isError` and an optional `terminate` (packages/agent/src/types.ts:424-445).
- `promptSnippet` and `promptGuidelines` are described at packages/coding-agent/src/core/extensions/types.ts:606-609. `signal` reports cancellation and `onUpdate` streams progress (packages/agent/src/types.ts:457-463).
- A thrown error becomes an error result at packages/agent/src/agent-loop.ts:855-863.

## What you have now

You have a tool the model can call, built on the extension and the tool call. Its schema is loose: the model could send a limit of a million. How can the schema refuse such arguments?
