# Config rows: an application described as a list of plugins

Your `main.ts` is now a column of `app.plugin(...)` calls. To get a version for continuous integration that never asks questions, you would copy the file and edit it. To raise one tool's time limit on your own machine, you would edit it again. Each variant becomes another file that drifts out of date. Can the list of plugins be data instead of code, so a variant is a small change on top of a shared base?

## A list of rows you can patch by id

Think of a seating chart for a dinner. The venue keeps a standard chart. For your event you hand over a short note: "seat 12: swap the guest; add seat 31". You do not redraw the chart; you change rows by their seat number. The picture stops holding at one point: changing a seat at a dinner moves a person, while changing a row here replaces that row's whole config, with nothing merged.

A config row is one line in the application's list: an `id`, the plugin's `name`, its `config`, and an optional `disabled` flag. A patch is a list of changes keyed by `id`: a row with a known id replaces that row's config or flag; a row with a new id is inserted. The whole application is the base rows with patches applied in order, then mounted.

```inkling
title "Base rows, patches, then mount"
layout down
base: box "Base rows\nloop, timeout" yellow
patch: box "Patch rows\ntimeout, heartbeat"
apply: box "applyPatch\nreplace config by id\ninsert new ids"
mount: box "mount\nskip disabled rows"
base -> apply : "rows"
patch -> apply : "rows"
apply -> mount : "rows in order"
note apply "config is replaced whole, not merged"
circle apply
step 1: base "The base list holds every plugin row"
step 2: patch "A patch names rows by id"
step 3: apply "Known id replaces the config, new id is inserted"
step 4: mount "Every row that is not disabled is mounted"
```

```ts
// src/config.ts
import { Context, type Plugin } from './plugins.ts'

export type Row = { id: string; name?: string; config?: unknown; disabled?: boolean }

export function applyPatch(rows: Row[], patch: Row[]): Row[] {
  const out = rows.map((r) => ({ ...r }))
  for (const p of patch) {
    const hit = out.find((r) => r.id === p.id)
    if (!hit) { out.push(p); continue }
    if ('config' in p) hit.config = p.config      // whole config replaced
    if ('disabled' in p) hit.disabled = p.disabled
  }
  return out
}

export function mount(app: Context, rows: Row[], catalog: Record<string, Plugin<any>>) {
  for (const r of rows) if (!r.disabled) app.plugin(catalog[r.name!], r.config)
}
```

Walk through a tiny case. The base has two rows:

```ts
const base: Row[] = [
  { id: 'loop', name: 'agent-loop', config: { maxSteps: 25 } },
  { id: 'timeout', name: 'tool-timeout', config: { ms: 30000, log: true } },
]
const ci: Row[] = [{ id: 'timeout', config: { ms: 120000 } }, { id: 'heartbeat', name: 'heartbeat', config: { everyMs: 5000 } }]
```

`applyPatch(base, ci)` finds `timeout` and replaces its config with `{ ms: 120000 }`. Note that `log: true` is gone: the patch replaced the whole config, so a patch must repeat every field it wants to keep. `heartbeat` is new, so it is appended. The result is three rows, and `mount` starts all three. Order in the list does not decide who starts first; service injection does that.

The `id` is what makes this work. Without it, the loader could not tell "change this row" from "remove one row and add another". The id also lets a reloader compare old and new lists and remount only the rows that changed.

Stack this up and you get a profile: a named, ordered set of base row lists plus patches. A "headless" profile might be the shared base plus a few rows for running without a screen.

> **Key idea:** Config rows describe the whole application as a list of plugin entries with ids; layered patches replace or insert rows by id, so every variant is a small change on top of one shared base.

**In DeepSeek Harness:** the base rows live in `packages/bundle/base/cordis.patch.yml`, for example an `insert` of `id: session-title` with `config: { fallbackMaxWords: 5 }`. The headless bundle patches by id in `packages/bundle/headless/cordis.patch.yml`, setting `sandbox-policy`'s mode from `DSH_PERMISSION_MODE` and `hmr` to `disabled: true`. Layers apply in order: the profile's bundles, the profile's own patch, a home patch, then `--patch` overlays. Shipped profiles include `web` and `headless` (`packages/util/official-bundles/src/bundles.ts`). `--dump-config` prints the composed list. Hot reload diffs entries by id and mounts, unmounts or reconfigures only what changed.

## What you have now

The whole application is now data: rows of plugins with ids and configs, adjusted by patches, then mounted, with services deciding start order. Every registration so far lands on one shared shelf and one shared listener list. What happens when two agents run in the same program and each needs its own tools and listeners?
