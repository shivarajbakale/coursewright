# Config rows: the plugin tree written as YAML

Your `main.ts` now calls `ctx.plugin` once for every part: the adapter, the tools, the loop, a timing listener. To change the model, you edit code. To share your setup with a friend who wants one extra plugin, you send a whole file and they edit it. How can the list of plugins and their settings become data that people can read, change and layer?

## An order form

Think of ordering a kitchen from a catalogue. You fill in a form with one line per item: a code, the item, and its options ("worktop, oak, 3 m"). The fitter reads the form and installs each line. To change the oak to slate, you send a correction that names the line by its code. You do not send a new form. To add a shelf, you send a correction that says "add this line".

In mini-dsh, the form is a list of **config rows**. Each row names one plugin to mount. It has an `id` that stays the same, a `name` that says which module to load, and the `config` for the plugin. A **patch** is a correction to that list. It either inserts new rows, or targets one row by its `id` and replaces the keys it gives. 

The comparison differs in one way. A fitter installs the lines in the order on the form. The kernel mounts every row and lets each plugin's `inject` list decide when it starts, so the order of rows does not matter.

## Rows in a file

Save `mini-dsh.yml`. YAML is a text format for lists and objects; this lesson needs one library to read it, `npm install yaml`.

```yaml
- id: llm
  name: ./plugins/deepseek.ts
  config:
    model: deepseek-flash
    max_tokens: 4096
- id: tools
  name: ./plugins/tools.ts
- id: loop
  name: ./plugins/loop.ts
```

The loader mounts each row that is not `disabled`. A plugin may export a `Config` function that checks its settings, and a bad value fails the fiber before `apply` runs:

```ts
import { parse } from 'yaml'

export async function loadRows(ctx: Context, rows: Row[]) {
  for (const row of rows) {
    if (row.disabled) continue
    const mod = await import(row.name)
    const config = mod.Config ? mod.Config(row.config ?? {}) : row.config
    ctx.plugin(mod.default, config)
  }
}

export function applyPatches(rows: Row[], patches: Patch[]): Row[] {
  const out = structuredClone(rows)
  for (const { id, insert, ...keys } of patches) {
    if (insert) { out.push(...structuredClone(insert)); continue }
    const row = out.find(r => r.id === id)
    if (!row) { console.warn(`patch: row ${id} not found`); continue }
    Object.assign(row, keys)          // each key is replaced as a whole
  }
  return out
}
```

Trace one patch file with 2 patches:

1. Read the 3 rows above. The `llm` row has `max_tokens: 4096`.
2. Apply `{ id: llm, config: { max_tokens: 8192 } }`. The patch replaces the whole `config` key. The row's config is now `{ max_tokens: 8192 }`, and `model` is gone.
3. Apply `{ insert: [{ id: timing, name: ./plugins/timing.ts }] }`. The list has 4 rows.
4. Load the rows. The adapter's `Config` fills the missing `model` with its default. If it has no default, the `llm` fiber fails, and the loop waits in `pending`.

Step 2 is the trap: a patch never merges inside `config`. To change one setting, the patch repeats every setting it wants to keep.

> **Key idea:** Config rows list plugins with an id, a module and settings; a patch inserts rows or replaces whole keys of one row.

```inkling
title "A patch replaces a whole key"
layout compare
columns "Before the patch", "After the patch"
row "id": "llm", "llm"
row "model": "deepseek-flash", "missing"!
row "max_tokens": "4096", "8192"
step 1: id "The patch finds the row by its id"
step 2: max-tokens "The new config replaces the old one"
step 3: model "A setting the patch left out is gone"
```

## How dsh does it

A dsh row has the same fields: `id`, `name`, `config`, `group`, `disabled`, `inject` (`vendor/loader/src/config/entry.ts:10-23`), plus `isolate` (`vendor/loader/src/config/isolate.ts:6-9`). `applyPatches` in `vendor/include/src/patch.ts:47-108` appends inserted rows, skips a patch whose `name` does not match the row, and replaces each other key whole. A `!!js` tag computes a value in `config` or `disabled` (`docs/cordis-primer.md:39`). This row is from `packages/bundle/sdk-minimal/cordis.patch.yml:26-31`:

```yaml
- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    defaultContextWindow: !!js Number(process.env.DSH_CONTEXT_WINDOW ?? 1000000)
```

```inkling
title "From a patch file to running plugins"
layout flow
file: sticky "cordis.patch.yml"
include: box "vendor/include\napplyPatches"
loader: box "vendor/loader"
fibers: box "One fiber per row" green
file -> include : "patches"
include -> loader : "rows"
loader -> fibers : "ctx.plugin"
step 1: file "Rows and patches are written as YAML"
step 2: include "Patches are applied to the row list"
step 3: loader, fibers "The loader mounts every row as a plugin"
```

## What you have now

The plugin tree is now a file of rows, and a patch can change one row or add rows without copying the list. A real setup needs several such files: the rows for a product, then the user's own changes on top. In what order do they apply, and what happens to a running program when one file changes?
