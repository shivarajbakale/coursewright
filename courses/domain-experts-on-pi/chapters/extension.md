# Extension: a function that receives pi's API

You have a pi package that can carry files. But a pack for the shop database needs more than text. It needs its own tools and its own commands. Where does that code go, and how does pi find it?

Think of a power socket. A lamp does not build its own electricity. It plugs into a socket that the building provides, and the socket decides what the lamp can reach. An **extension** works the same way. It is a TypeScript file that pi plugs into. The file does not build pi. pi hands the file an object, and the file uses that object to add things.

The comparison differs in one way. A lamp plugs in once. An extension can also listen for events and react each time one happens.

The file has one shape. Its default export is a function. pi calls that function and passes in one argument. That argument is the **ExtensionAPI**: the object pi gives to an extension, with methods such as `registerTool`, `registerCommand` and `on`. Inside the function, the extension uses these methods to register what it adds.

Here is the first version of `packs/sql/extension.ts` in `fleet`:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Shop tools ready", "info");
  });
  pi.registerCommand("tables", {
    description: "List the shop tables",
    handler: async (_args, ctx) => {
      ctx.ui.notify("customers, orders", "info");
    },
  });
}
```

Run it with `pi -e packs/sql/extension.ts`. The `-e` flag gives pi the path of one extension to load.

```inkling
title "From file to running session"
layout flow
file: box "extension.ts"
load: box "pi loads the file"
call: box "Calls the default export"
reg: box "Registers commands and handlers"
start: round "Session starts" green
file -> load -> call -> reg -> start
step 1: file "You pass the path with -e"
step 2: load "pi loads the TypeScript file without a build step"
step 3: call "pi calls the function and passes in the ExtensionAPI"
step 4: reg "The function registers a command and an event handler"
step 5: start "The session starts and the handler runs"
```

Follow what happens. pi loads the file and calls the function. The function registers a command named `tables` and a handler for the `session_start` event. Then the session starts. Because of this, pi runs the handler, and the screen shows "Shop tools ready". When you type `/tables`, pi runs the command handler.

An **event** is a moment in a session that pi announces. The names include `session_start`, `before_agent_start`, `turn_start`, `tool_call`, `tool_result`, `turn_end`, `agent_end` and `session_shutdown`. You subscribe with `pi.on(name, handler)`. This lesson uses only `session_start`.

One rule keeps the function safe. Do not start a process or a timer inside the function itself. Start such work in a `session_start` handler and stop it in a `session_shutdown` handler.

> **Key idea:** An extension is a TypeScript file whose default function receives the ExtensionAPI and registers tools, commands and event handlers with it.

## How pi does it

- The type is `ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>` (packages/coding-agent/src/core/extensions/types.ts:2069).
- pi loads TypeScript directly. A module whose default export is not a function is refused with "Extension does not export a valid factory function" (packages/coding-agent/src/core/extensions/loader.ts:585-589, 651-653).
- pi finds extensions in `.pi/extensions/` of a trusted project, in `~/.pi/agent/extensions/`, in settings, in packages, or from `-e <path>`. The flag `-ne` turns discovery off (packages/coding-agent/src/cli/args.ts:326-332).
- The advice to start work in `session_start` is in packages/coding-agent/docs/extensions.md:252-256. The event list is at packages/coding-agent/src/core/extensions/types.ts:1621-1688.

## What you have now

You have the place where a pack's code lives: one extension file with a function that registers what the pack adds. This rests on the pi package, which carries the file, and on the tool call, which is one thing an extension can add. The extension so far registers a command and a handler. How does it register a tool that the model can call?
