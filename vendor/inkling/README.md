# Inkling (vendored)

The owner's hand-drawn diagram library, copied from `~/Projects/inkling` (see `VERSION`). Both apps load
`inkling.js` lazily through `src/lib/inkling.ts`, only on a chapter with an ```inkling explainer. The agent
checks explainers with its own copy of the command line in `agent/vendor/inkling`.

To update, in `~/Projects/inkling`:

    npm run build:lib && npm run vendor -- ../coursewright/vendor

then keep `inkling.js`, `inkling.js.map`, `inkling.d.ts`, `types/`, `package.json`, `VERSION` here, and copy
`inkling-node.js`, `bin/inkling.mjs`, `package.json` and `VERSION` to `agent/vendor/inkling`.
