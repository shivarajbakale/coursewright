# UI probe

`make ui-probe` renders this app in real chromium and checks the layout
arithmetic that a text gate cannot see: dead space, scroll axes, clipped text,
archetype conformance, and information hierarchy.

## Running it

    make ui-probe     # the gate
    make ui-shots     # the same run, writing PNGs to .ui-probe/shots/

The first run downloads chromium. `npm run ui-probe` shells `playwright
install chromium` before the suite, so a fresh clone needs no separate
step — the install is a no-op once the binary is cached. Without it the
gate fails with "Executable doesn't exist" rather than a layout finding,
which reads as a broken app instead of a missing browser.

## Reading the output

`OK` is a clean view. `FAIL` is a rule in `scripts/ui-probe/probe.config.ts`'s
`ENFORCED` list and stops the run. `WARN` is a rule that is measured and printed
but not yet fatal — a known defect with a number attached, not a suggestion.

## Adding a rule

Rules are pure functions of a `Snapshot` (`scripts/ui-probe/types.ts`), so they
are unit-tested in jsdom without a browser — see `scripts/ui-probe/__tests__/`.
Write the test first, add the rule to `rules/index.ts`, and only put its id in
`ENFORCED` once this app actually satisfies it.

## Opting out

`data-probe-ignore="A1 C6"` on an element, or `"all"`, exempts it and its
subtree. Use it where a rule is genuinely wrong for a case, and say why in a
comment. Do not use it to silence a rule that is right.
