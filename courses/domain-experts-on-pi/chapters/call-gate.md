# Call gate: blocking or changing a call before it runs

A tight schema tells the model what shape an argument has. It cannot say what the argument means. The SQL expert may send `{ "sql": "DROP TABLE orders" }`. This is a valid string, so the schema accepts it. What stops the call?

Think of a door guard at a warehouse. A courier arrives with a delivery slip. The slip is filled in correctly, so the paperwork check passes. The guard then reads what the slip asks for. If it asks for the safe, the guard refuses and writes the reason on the slip.

The picture differs from pi in one way: the guard is a function you write, and it runs on every call without tiring or bending a rule.

In pi, the guard is a handler for an event. An **event** is a signal that pi sends at a fixed point in its work, so that your code can react. After the schema check and before the tool runs, pi sends the event `tool_call`. Your handler receives the tool name and the arguments. It has three choices:

1. Return nothing. The call goes ahead.
2. Change the arguments in place. The call goes ahead with the new values.
3. Return `{ block: true, reason }`. The tool never runs, and the model receives the reason as an error result.

```inkling
title "The gate before a tool runs"
layout flow
call: box "Model's call"
schema: box "Schema check"
gate: diamond "Gate allows?"
run: box "Tool runs"
blocked: box "Reason goes to model" red
call -> schema
schema -> gate
gate -> run : "yes"
gate -> blocked : "no"
step 1: call "The model asks for a tool"
step 2: schema "pi checks the arguments against the schema"
step 3: gate "Your tool_call handler decides"
step 4: run "If it allows, the tool runs"
step 5: blocked "If it blocks, the model reads the reason as an error"
```

Here is the gate in the SQL pack, in `packs/sql/extension.ts`:

```ts
pi.on("tool_call", async (event) => {
  if (event.toolName !== "sql_query") return;
  const sql = String(event.input.sql).trim();
  if (!/^(select|with)\b/i.test(sql) || /;\s*\S/.test(sql))
    return { block: true, reason: "Only one SELECT statement is allowed." };
});
```

Take the call `DROP TABLE orders`. The tool name is `sql_query`, so the handler continues. The text does not start with `select` or `with`, so the test is true, and the handler blocks. The model sees "Only one SELECT statement is allowed." and can write a better query. The call `SELECT 1; DROP TABLE orders` also fails: the second pattern finds text after the first semicolon.

Two details matter. First, a handler that throws also stops the call. The error becomes an error result and the tool does not run. So a gate fails closed: if the gate breaks, the call is refused. Second, pi does not check the schema again after a handler changes `event.input`. If you change an argument, you must keep it valid.

A gate is not the only protection. The database file `fleet/data/shop.db` is also opened read-only. If a clever query passes the pattern, the database still refuses to write. Two independent layers cost little and each covers the gaps in the other.

> **Key idea:** The tool_call event fires before a tool runs; a handler can change the arguments or block the call with a reason.

## How pi does it

The event is described as "Fired before a tool executes. Can block." and `event.input` is mutable, with "No re-validation is performed after mutation" (packages/coding-agent/src/core/extensions/types.ts:1270-1275). The block result is `{ block: true, reason?: string, terminate?: boolean }` (types.ts:1474-1484), and the first handler that blocks ends the chain (packages/coding-agent/src/core/extensions/runner.ts:1249-1266). The model receives the reason as an error result (packages/agent/src/agent-loop.ts:755-765), and a handler that throws is treated the same way (agent-loop.ts:786-791). The event also fires for MCP tools and for calls made from codemode scripts (packages/coding-agent/docs/mcp.md:252-256). A pi example, `packages/coding-agent/examples/extensions/permission-gate.ts:10-34`, blocks `rm -rf`, `sudo` and `chmod 777` in bash.

## What you have now

You can stop a call that the schema allows, or repair its arguments, with a handler on tool_call. The gate works on what goes into a tool. A tool can also return data that the model should never see, such as a customer's email address. What can you do about the output?
