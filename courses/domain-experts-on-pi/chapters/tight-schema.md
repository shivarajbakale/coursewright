# Tight schema: only safe arguments get through

The model fills in the arguments of every tool call, and it can fill them in badly. It may ask for a limit of a million rows, or send a query as long as a book. Can you stop such a call before your code runs?

Think of a vending machine. It accepts only certain coins, and it has only certain buttons. If you push a coin it does not accept, the machine gives the coin back and does nothing else. The machine does not need a guard, because the shape of the slot already refuses the wrong input. A tool schema is the slot. The comparison differs in one way: the machine gives the coin back silently, but pi sends the model a message that says what was wrong, so the model can try again.

pi checks the arguments of every call against the tool's schema before anything else runs. If the check fails, the tool never runs. The model receives an error result instead. The message starts with `Validation failed for tool "<name>":`. Then it lists one line per problem, each with its path. Then it shows the arguments that pi received.

Here is `sql_query` with a tight schema:

```ts
parameters: Type.Object(
  {
    sql: Type.String({ maxLength: 4000 }),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
  },
  { additionalProperties: false },
),
```

Three rules do the work. `maxLength: 4000` caps the query text. `minimum: 1` and `maximum: 200` keep the limit between 1 and 200, and `Type.Integer` refuses a value such as 2.5. `additionalProperties: false` refuses any field that the schema does not name.

```inkling
title "The schema check comes first"
layout flow
call: box "Tool call from the model"
check: diamond "Arguments fit the schema?"
run: box "Tool runs" green
err: box "Error result to the model" red
call -> check
check -> run : "pass"
check -> err : "fail"
highlight check
step 1: call "The model sends a tool call with arguments"
step 2: check "pi checks the arguments against the schema"
step 3: run "A passing call reaches the tool"
step 4: err "A failing call never runs; the model reads what was wrong"
```

Take a call with `limit: 5000`. The schema allows 200 at most, so the check fails. The tool does not run. The model reads a line that gives the path `limit` and the problem.

In the next reply, the model can send a limit of 200 or less. No database work happened for the bad call.

pi also loosens the arguments before the check. A numeric string such as "10" becomes the number 10. The string "true" becomes `true`. A single value becomes a list of one item. Only plain JSON Schema rules apply. TypeBox refinements, which are custom checks written in code, are not run.

For a field with a fixed list of allowed values, use an **enum**: a fixed list of allowed values. For string enums, use `StringEnum` from `@earendil-works/pi-ai`. The Kubernetes pack will use it for `kind: StringEnum(["pod","deployment","service"])`.

A schema has a limit. It checks the shape of the arguments, not their meaning. It cannot tell a `SELECT` from a `DELETE`, because both are strings under 4000 characters. That needs a check written in code.

> **Key idea:** pi checks every call's arguments against the schema first. A failing call never runs, and the model gets an error that says what was wrong.

## How pi does it

- Validation is in `validateToolArguments`, which compiles the schema and parses the arguments (packages/ai/src/utils/validation.ts:54-69). It runs before the `beforeToolCall` hook (packages/agent/src/agent-loop.ts:736-737).
- The error text starts with `Validation failed for tool "<name>":`, then one line per problem, then the received arguments (packages/ai/src/utils/validation.ts:66-68).
- The loosening of arguments and the rule about refinements are in packages/coding-agent/docs/extensions.md:172-184.
- An example of `StringEnum` is at packages/coding-agent/examples/extensions/todo.ts:13, 32.

## What you have now

You have a first guard that costs nothing: a strict schema stops bad shapes before any code runs. It builds on the custom tool, whose schema you wrote. It cannot judge what a string means. How do you choose which tools the expert can reach at all?
