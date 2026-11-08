# The SQL analyst: a database expert that can only read

You now have every part of an expert: a prompt, a skill, tools, gates, a container and evals. This lesson puts them together for one domain, the shop database. What does the full SQL analyst look like, and how do you know it is safe and useful?

Think of a bank clerk behind glass. The clerk can look up your balance and read it to you. The glass, the locked drawer and the camera each stop a different kind of mistake. No single barrier does everything.

The picture differs from the field in one way. Each barrier of the clerk is visible. A barrier in the expert is code or a mount flag, and you must test that it holds.

The SQL analyst answers questions about `fleet/data/shop.db`. That file has two tables: `customers(id, name, country)` and `orders(id, customer_id, total, placed_at)`. The analyst may read. It may not change anything.

The pack has these files:

- `packs/sql/prompt.md` holds the role and the rules.
- `packs/sql/skills/monthly-revenue/SKILL.md` holds one procedure: check the schema, group by month of `placed_at` and country, exclude totals of 0 or less, then convert cents to currency.
- `packs/sql/prompts/revenue.md` is a slash command for the common question.
- `packs/sql/extension.ts` holds the tools and the guards.
- `packs/sql/evals/` holds the golden tasks.
- `agents/sql/` is the agent folder, with its own settings and sessions.

The extension holds the safety. This version adds a tight schema, a SELECT-only gate and an email mask:

```ts
import { Type } from "typebox";
import { DatabaseSync } from "node:sqlite";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const db = new DatabaseSync("data/shop.db", { readOnly: true });

export default function sqlPack(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sql_schema", label: "SQL schema",
    description: "List the tables and columns of the shop database",
    promptSnippet: "sql_schema: list tables and columns",
    parameters: Type.Object({}),
    async execute() {
      const tables = db.prepare("select name from sqlite_master where type = 'table'").all() as { name: string }[];
      const text = tables.map((t) => {
        const cols = db.prepare(`pragma table_info(${t.name})`).all() as { name: string }[];
        return `${t.name}(${cols.map((c) => c.name).join(", ")})`;
      }).join("\n");
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  pi.registerTool({
    name: "sql_query", label: "SQL query",
    description: "Run one read-only SQL query on the shop database",
    promptSnippet: "sql_query: run a read-only SELECT on shop.db",
    parameters: Type.Object(
      { sql: Type.String({ maxLength: 4000 }), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })) },
      { additionalProperties: false }),
    async execute(_id, params) {
      const rows = db.prepare(params.sql).all().slice(0, params.limit ?? 200);
      return { content: [{ type: "text", text: JSON.stringify(rows) }], details: { rows: rows.length } };
    },
  });

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "sql_query") return;
    const sql = String(event.input.sql).trim();
    if (!/^(select|with)\b/i.test(sql) || /;\s*\S/.test(sql))
      return { block: true, reason: "Only one SELECT statement is allowed." };
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName !== "sql_query") return;
    const text = event.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    return { content: [{ type: "text", text: text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]") }] };
  });
}
```

Run the expert by hand. The base pack loads first. The tool list keeps `read`, because the model needs it to open the skill:

```sh
PI_CODING_AGENT_DIR=agents/sql pi --model deepseek/deepseek-flash \
  --system-prompt packs/sql/prompt.md -e packs/base/extension.ts -e packs/sql/extension.ts \
  --skill packs/sql/skills --tools read,sql_schema,sql_query
```

For real use, run the same command inside a container. Mount `data` read-only with `-v "$PWD/data:/data:ro"` and the pack with `:ro`. Only the agent folder is writable.

Now the checks. The evals hold 20 golden tasks, and 3 of them are refusals, such as "delete all orders". The graders are `numberClose` for answers and `dbUnchanged` for the file hash. Each task runs 5 times, with and without the pack. The table below shows example numbers, not real measurements. They show the shape to aim for:

| Result | Control (plain pi) | SQL pack |
| --- | --- | --- |
| Tasks passed (of 20) | 9 (45%) | 17 (85%) |
| Lift | | 40 percentage points |
| Flaky tasks | | 1 |
| Average tokens per task | | 14,000 |

The lift is 85% minus 45%, which is 40 percentage points.

The expert has six layers of defence. Each stops a different failure:

```inkling
title "Six layers around the SQL analyst"
layout stack
- Container
- Read-only mount
- Read-only database
- Select-only gate
- Tight schema
- No write tools
step 1: container "The whole process runs in a container"
step 2: read-only-mount "The data folder is mounted read-only"
step 3: read-only-database "The database file opens in read-only mode"
step 4: select-only-gate "The gate refuses anything but one SELECT"
step 5: tight-schema "The schema rejects bad arguments before the gate"
step 6: no-write-tools "The expert has no tool that writes"
```

> **Key idea:** The SQL analyst is safe because six independent layers each stop a write. Evals with a control show whether it is also useful.

## How pi does it

- `registerTool` adds the two tools (packages/coding-agent/src/core/extensions/types.ts:1695).
- The `tool_call` event can block a call (packages/coding-agent/src/core/extensions/types.ts:1270-1275). The `tool_result` handler returns new content (types.ts:1503-1509).
- The skills section appears in the prompt only when `read` or `bash` is available (packages/coding-agent/src/core/system-prompt.ts:173-181).

## What you have now

You have a complete SQL analyst: a pack of files, six layers of defence and an eval that measures lift over plain pi. It uses the router, the base pack and every guard so far. It can only read. What changes when an expert must sometimes change something?
