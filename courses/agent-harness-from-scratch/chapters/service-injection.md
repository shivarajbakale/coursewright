# Service injection: waiting until needed services exist

Mount `greeter` before `memoryLog` and it finds nothing on the shelf. You could insist that plugins load in the right order, but with dozens of plugins someone will get the order wrong. Worse, a service can disappear while its user is still running. What if the log plugin is reloaded while the agent loop holds the old one? How does a plugin start only when its needs are met, and stop when they no longer are?

## Declare your needs, let the host start you

Think of a recipe card pinned in a shared kitchen that says "needs: eggs, flour". Nobody starts baking until both are on the shelf. If someone takes the eggs back halfway through, the baking stops and waits for eggs again. The picture stops holding at the restart: a real cook would resume, while the plugin starts over from the beginning with a fresh context.

That is service injection: a plugin declares the services it needs, and the host only starts it once they all exist. The host also stops it when one goes away, and starts it again when the service returns. Order on the page stops mattering.

The kernel needs one new piece: a way to tell waiting plugins that the shelf changed.

```ts
// src/plugins.ts (additions)
readonly watchers = new Set<() => void>()

changed(): void {
  for (const check of [...this.root.watchers]) check()
}

// in provide(): after shelf.set(name, value) call this.changed(),
// and the disposer becomes () => { shelf.delete(name); this.changed() }

inject(needs: string[], fn: Plugin<undefined>): Disposer {
  let running: Disposer | undefined
  const check = () => {
    const ready = needs.every((n) => this.root.services.has(n))
    if (ready && !running) running = this.plugin(fn, undefined)
    if (!ready && running) { running(); running = undefined }
  }
  return this.effect(() => {
    this.root.watchers.add(check)
    check()
    return () => { this.root.watchers.delete(check); running?.() }
  })
}
```

`inject` registers a watcher, a small function that compares the shelf with the needs list. When everything is present and the plugin is not running, it mounts it. When something is missing and the plugin is running, it unloads it. The whole arrangement is itself an effect, so removing the waiting plugin also removes its watcher.

Now trace the wrong order from before:

```ts
const app = new Context()
app.inject(['session'], greeter)          // 1. watcher added, not ready
const unloadLog = app.plugin(memoryLog, {})  // 2. session appears, greeter starts
unloadLog()                                // 3. session gone, greeter unloads
app.plugin(memoryLog, {})                  // 4. session back, greeter starts again
```

At step 1, `session` is missing, so `greeter` waits. At step 2, `provide` calls `changed`, the watcher sees `session`, and `greeter` runs and appends its event. At step 3, the disposer deletes `session`, calls `changed`, and the watcher unloads `greeter`, running all of its disposers. At step 4, a fresh copy of `greeter` starts. Inside `greeter`, `ctx.get('session')` can now never return `undefined`, because it only runs while `session` exists.

> **Key idea:** Service injection means a plugin lists the services it needs and the host mounts it only while all of them exist, unloading it when one disappears and remounting it when it returns.

One trap is silent. If a plugin needs a name that no plugin ever provides, it waits forever and prints nothing. When a feature seems missing, check what it is waiting for.

**In DeepSeek Harness:** a plugin module exports `inject = ['greeter']`, which "holds the plugin PENDING until the service exists"; if the service disappears every dependent unloads, and reloads when it returns (`docs/cordis-tutorial/03-services.md`). Optional needs use `ctx.get('x')` instead. Because loading is driven by which services exist, the architecture docs state that row "order carries no load semantics", and entries start concurrently.

## What you have now

Plugins now declare what they need, and the kernel starts and stops them as services come and go. It does this with nothing more than the effects and disposers of the earlier lessons. The agent loop can wait for the event log and the model client without caring about load order. Services cover sharing objects; next is a different kind of cooperation: how does a plugin react when something happens elsewhere, such as a turn ending?
