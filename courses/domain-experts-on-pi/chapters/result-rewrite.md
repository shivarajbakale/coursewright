# Result rewrite: changing a result before the model sees it

A call gate controls what goes into a tool. The SQL expert runs `SELECT name, email FROM customers`, and the query is allowed. The rows come back with real email addresses. Those rows go into the conversation, and the model, the session log and any later summary now hold them. How do you keep personal data out?

Think of a mail room. A clerk opens each reply that arrives for a manager. The clerk blacks out phone numbers with a marker, then passes the page on. The manager never sees the original. The picture differs from pi in one way: the clerk can keep an untouched copy in a drawer. In pi, your own code can keep the full result in a separate field.

In pi, the clerk is a handler for the event `tool_result`. pi sends this event after a tool runs and before the model sees the result. The event carries the tool name, the call id, the input, the content, the details and an error flag. Your handler may return new values for any of these. pi then uses the new values.

```inkling
title "A handler rewrites the result"
layout sequence
tool: box "sql_query"
pi: box "pi"
handler: box "tool_result handler"
model: box "Model"
tool -> pi : "rows with emails"
pi -> handler : "event with content"
handler --> pi : "emails masked"
pi -> model : "changed result"
steps auto
```

Here is a handler for the SQL pack. It masks anything that looks like an email address:

```ts
pi.on("tool_result", async (event) => {
  if (event.toolName !== "sql_query") return;
  const text = event.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  return { content: [{ type: "text", text: text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]") }] };
});
```

Follow one result through it. The tool returns the text `Ada, ada@example.com`. The handler joins the text blocks into one string. The pattern finds `ada@example.com` and replaces it with `[email]`. The handler returns new content: `Ada, [email]`. The model reads that text.

The full rows stay in `details`, so your own code can still use them. The handler returns only the fields it wants to change. A field it leaves out stays as it was. Several handlers form a chain: each one sees the changes of the one before it.

Rewriting has more uses than hiding data. A handler can cut a very long output down to its first lines, so it does not fill the context window. It can add a note, such as "Only 200 rows are shown". It can also change the error flag.

One difference from the call gate needs care. A gate that throws blocks the call. A `tool_result` handler that throws does not block anything: pi reports an extension error and lets the original result through. So a broken rewrite gives the model the unmasked rows. Test the handler with a real email address before you rely on it.

> **Key idea:** The tool_result event fires after a tool runs; a handler can replace the content, details or error flag before the model sees them.

## How pi does it

The event carries `toolName`, `toolCallId`, `input`, `content`, `details` and `isError` (packages/coding-agent/src/core/extensions/types.ts:1287-1303). A handler returns `{ content?, details?, structuredContent?, isError? }` (types.ts:1503-1509). Handlers chain, and each sees the previous changes (packages/coding-agent/src/core/extensions/runner.ts:1190-1247). A handler that throws is reported as an extension error and does not block the result (runner.ts:1223-1231).

## What you have now

You can now shape both sides of a tool: tool_call guards the input, and tool_result cleans the output. Both run inside pi, without asking anyone. Some calls are risky enough that a person should decide, but an expert may run with nobody at the screen. What should a gate do then?
