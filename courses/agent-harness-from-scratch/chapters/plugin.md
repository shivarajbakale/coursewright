# Plugin: a piece of code that adds one feature

Your `minidsh` now streams replies, runs tools, records every event, retries failed requests and stops when asked. All of that lives in a few files that call each other directly. Now someone wants a version with no file tools, for a demo. Someone else wants a new tool for one project only. Each wish means editing the core files and hoping nothing else breaks. How do you add or remove a feature without touching the rest?

## A host that does nothing on its own

Think of a power strip. The strip does nothing by itself. Every useful thing, a lamp or a charger, is a separate device you plug in. Unplug the lamp and the charger keeps working. You never open the strip to add a device.

A plugin works the same way. It is a self-contained piece of code that adds one feature to a host program. The host offers a few ways to plug in, and every feature arrives through them. The picture stops holding in one place: devices on a power strip never talk to each other, while plugins often must. One plugin offers a tool, another runs the agent loop that calls it. The next lessons build the ways they cooperate.

Here is the smallest version, the start of `src/plugins.ts`:

```ts
// src/plugins.ts
export type Plugin<C = unknown> = (ctx: Context, config: C) => void

export class Context {
  plugin<C>(fn: Plugin<C>, config: C): void {
    fn(this, config)
  }
}
```

A plugin is a function. It receives a context, the object it uses to reach the host, and a config, the settings for this one copy. Two plugins for `minidsh`:

```ts
// src/main.ts
import { Context, type Plugin } from './plugins.ts'

const banner: Plugin<{ name: string }> = (ctx, config) => {
  console.log(`${config.name} is starting`)
}

const heartbeat: Plugin<{ everyMs: number }> = (ctx, config) => {
  setInterval(() => console.log('still alive'), config.everyMs)
}

const app = new Context()
app.plugin(banner, { name: 'minidsh' })
app.plugin(heartbeat, { everyMs: 5000 })
```

Walk through it. `new Context()` makes an empty host. The first `app.plugin` call runs `banner` with `{ name: 'minidsh' }`, so it prints `minidsh is starting`. The second runs `heartbeat`, which prints `still alive` every 5,000 milliseconds. Delete the second line and the heartbeat is gone, with no other file touched. Mount `heartbeat` twice with different configs and you get two independent copies.

The goal is bigger than banners. In the finished kernel, the agent loop, each tool and the event log are all plugins too. The host program is only the context plus the list of plugins to mount.

> **Key idea:** A plugin is a function that receives the host's context and its own config and adds exactly one feature; the host itself has no features, only ways to plug them in.

Notice the problem the heartbeat leaves. Once mounted, nothing can stop it. The interval keeps firing forever, because the host never learned what the plugin set up.

**In DeepSeek Harness:** the plugin system is Cordis, vendored at `vendor/cordis/src`. A plugin can be a bare function, an object with an `apply(ctx)` method, or a class (`docs/cordis-tutorial/01-first-plugin.md`). Each plugin's config is checked against a schema before `apply(ctx, config)` runs, and an invalid config marks it failed. `ctx.plugin(p, config)` returns a handle called a fiber, the runtime record of one loaded copy, which moves through the states pending, loading, active, unloading and disposed. The architecture docs put the design in one line: "There is no privileged core to patch". Even the agent loop is a plugin.

## What you have now

You have a host that is only a context, and features that arrive as plugin functions with their own config. This builds on the agent loop and everything around it: those parts will become plugins too. The open question is the heartbeat: how does a plugin undo what it set up when it is removed?
