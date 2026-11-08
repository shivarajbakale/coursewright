# Profile: a named stack of plugin bundles

With config rows, the whole plugin tree is a file, and a patch changes one row. But one file is not enough. Everyone should share the rows for "a command-line agent". Your own changes should sit on top. A one-off test should sit on top of those. In what order do these files apply, and what happens to a running program when one of them changes?

## Layers of tracing paper

Think of an architect's drawing made on sheets of tracing paper. The bottom sheet has the walls. The next sheet adds the wiring. Your sheet on top moves one socket. Looking down through the stack, you see one drawing. If you redraw the socket on your sheet, the walls do not move.

In mini-dsh, each sheet is a patch file. A **bundle** is a package that carries one patch file of rows, such as "core agent" or "run commands". A **profile** is a named folder that lists the bundles it stacks, in order, and holds one patch file of your own. The comparison differs in one way. Tracing paper starts on a drawing. Here the stack starts from an empty list, so every row in the program comes from some layer.

## Composing a profile

A profile folder, `~/.mini-dsh/profiles/agent/`, holds `profile.json` and `patch.yml`:

```json
{ "bundles": ["./bundles/core", "./bundles/shell"] }
```

Each bundle folder holds `rows.yml`, a list of patches such as `- insert: [ … ]`. Composing applies the layers to an empty list:

```ts
export function composeProfile(dir: string, extra: Patch[] = []): Row[] {
  const profile = JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8'))
  const layers: Patch[][] = profile.bundles.map(b => readPatches(join(b, 'rows.yml')))
  layers.push(readPatches(join(dir, 'patch.yml')), extra)
  return applyPatches([], layers.flat())
}
```

Trace one profile:

1. Start from `[]`, 0 rows.
2. Apply `bundles/core`. It inserts `llm`, `tools` and `loop`: 3 rows.
3. Apply `bundles/shell`. It inserts `bash`: 4 rows.
4. Apply your `patch.yml`. It replaces the `llm` row's config with `{ model: deepseek-flash, max_tokens: 8192 }`. Still 4 rows.
5. Apply a test patch given on the command line, `{ id: bash, disabled: true }`. The loader mounts 3 plugins.

A later layer wins because it applies last. A bundle never needs to know your patch exists.

```inkling
title "A profile is a stack of layers"
layout stack
- Command-line patch
- Your profile patch.yml
- Bundle: shell
- Bundle: core
- Empty row list
brace command-line-patch..bundle-core "applied bottom to top"
step 1: empty-row-list, bundle-core "Composition starts from an empty list"
step 2: bundle-shell "Each bundle inserts its rows, in the profile's order"
step 3: your-profile-patch-yml, command-line-patch "Your patches apply last, so they win"
```

## Changing a running program

**Hot reload** means applying a change to a running program without restarting it. Say you save `patch.yml`. The kernel composes the rows again. Then it compares them with the running rows by `id`:

1. A row that is gone: dispose its fiber.
2. A new row: mount it.
3. A row whose fields changed: dispose its fiber, then mount the row again.
4. An unchanged row: keep its fiber.

Disposers undo the old plugin, and `inject` makes the plugins that need it wait and return. Changing `max_tokens` therefore remounts the adapter, and the loop restarts on its own.

```inkling
title "One saved file, one changed row"
layout timeline
- 1: patch.yml saved
- 2: rows composed again
- 3: compare by id
- 4: dispose llm
- 5: mount llm again
steps auto
```

> **Key idea:** A profile stacks bundles of rows, then its own patch, over an empty list; a hot reload remounts only changed rows.

## How dsh does it

`docs/architecture.md` describes the layers. 

A profile at `$DSH_HOME/profiles/<name>` lists bundles in its `package.json` under `dsh.profile.bundles`. A bundle names its patch file under `dsh.bundle.patch`. `composeEntries` (`packages/boot/app-boot/src/profile.ts:755`) applies the layers to an empty list. The order is the bundles, the profile's `cordis.patch.yml`, the home patch, then `--patch` overlays. The `sdk-minimal` bundle is one `insert` of 37 rows and does not stack on `dsh-base` (`packages/bundle/sdk-minimal/cordis.patch.yml`). The `dsh-hmr` plugin injects `loader` and `timer` (`packages/boot/hmr/src/index.ts:211-213`). The loader compares rows by `id`, so a row without one counts as removed and added on every edit (`docs/cordis-tutorial/06-composition-and-hmr.md`).

## What you have now

Every part of mini-dsh is now a plugin that a row in a profile can replace, even while it runs. The tools, though, are still plain functions in a list. What should one tool look like, so its arguments are checked before it runs?
