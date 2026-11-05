import { describe, expect, it } from 'vitest';

// @ts-expect-error — plain ESM script, no types
import { RULES, readDebt, run } from '../../scripts/ui-lint.mjs';

type Rule = { id: string; pattern: RegExp; message: string; boundary?: boolean };
const rules = RULES as Rule[];
const rule = (id: string) => {
  const found = rules.find((r) => r.id === id);
  if (!found) throw new Error(`no such rule: ${id}`);
  return found;
};

/**
 * The design-system contract.
 *
 * `scripts/ui-lint.mjs` is the thing that stops a screen hand-rolling a
 * primitive the kit already owns. A rule that silently stops matching is worse
 * than no rule at all — the check stays green while the drift ships. So each
 * rule is pinned here against a line it must catch and a line it must not.
 */
describe('ui-lint rules', () => {
  it('catches a raw element even when prettier wraps the tag', () => {
    // The regression that let four hand-rolled controls through: with the tag
    // wrapped, the line ends right after `<button` and the old `[\s>]` class
    // had nothing left to match.
    expect(rule('raw-button').pattern.test('                <button')).toBe(true);
    expect(rule('raw-button').pattern.test('<button type="button">')).toBe(true);
    expect(rule('raw-input').pattern.test('              <input')).toBe(true);
    expect(rule('raw-textarea').pattern.test('  <textarea')).toBe(true);
    expect(rule('raw-table').pattern.test('  <table')).toBe(true);
    expect(rule('raw-select').pattern.test('  <select')).toBe(true);
  });

  it('does not mistake a component for the element it is named after', () => {
    expect(rule('raw-button').pattern.test('<Button variant="ghost">')).toBe(false);
    expect(rule('raw-input').pattern.test('<InputGroup>')).toBe(false);
    expect(rule('raw-select').pattern.test('<SelectTrigger>')).toBe(false);
    expect(rule('raw-table').pattern.test('<TableHeader>')).toBe(false);
  });

  it('catches a hand-rolled badge but not the dot inside a real one', () => {
    const badge = rule('hand-rolled-badge').pattern;
    expect(
      badge.test(
        '<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">'
      )
    ).toBe(true);
    // Badge's own status dot: round, but no padding and no type scale.
    expect(badge.test('<span className="size-1.5 rounded-full bg-current" />')).toBe(false);
    // A numbered step circle: round and emphasised, but no horizontal padding.
    expect(
      badge.test("'flex size-6 items-center justify-center rounded-full border text-[11px] font-medium'")
    ).toBe(false);
    expect(badge.test('<Badge variant="success">')).toBe(false);
  });

  it('catches a hand-rolled card but not the Card atom composed with it', () => {
    const card = rule('hand-rolled-card').pattern;
    expect(card.test('<section className="rounded-xl border bg-card p-6">')).toBe(true);
    expect(card.test('<div className="h-full overflow-hidden rounded-lg border bg-card">')).toBe(
      true
    );
    expect(card.test('<Card className="gap-0 py-0 lg:col-span-2">')).toBe(false);
    expect(card.test("tone === 'muted' && 'bg-card/60',")).toBe(false);
    // The 1px-gap grid trick — a surface, but not a card.
    expect(card.test('<div className="bg-card p-4">')).toBe(false);
  });

  it('still catches the layout and token rules it started with', () => {
    expect(rule('page-scroll').pattern.test('className="min-h-0 flex-1 overflow-y-auto"')).toBe(
      true
    );
    expect(rule('page-scroll').pattern.test('className="overflow-hidden rounded-lg"')).toBe(false);
    expect(rule('hardcoded-color').pattern.test('className="bg-slate-800"')).toBe(true);
    expect(rule('hardcoded-color').pattern.test('className="bg-card text-muted-foreground"')).toBe(
      false
    );
    expect(rule('native-dialog').pattern.test('if (confirm("sure?")) remove()')).toBe(true);
  });

  it('every rule carries an id and an actionable message', () => {
    expect(rules.length).toBeGreaterThan(10);
    for (const r of rules) {
      expect(r.id).toMatch(/^[a-z-]+$/);
      expect(r.message.length).toBeGreaterThan(20);
    }
  });
});

/**
 * The contract, applied. `make check` runs the script too, but pinning it here
 * means a hand-rolled primitive fails the ordinary test run — the loop most
 * people actually watch.
 */
describe('ui-lint over this app', () => {
  it('finds no hand-rolled primitives in src/', () => {
    const result = run() as {
      scanned: number;
      missingRoot: boolean;
      findings: { file: string; line: number; rule: string; message: string }[];
    };
    expect(result.missingRoot).toBe(false);
    expect(result.scanned).toBeGreaterThan(10);
    expect(
      result.findings.map((f) => `${f.file}:${f.line}  ${f.rule} — ${f.message}`)
    ).toEqual([]);
  });
});

/**
 * The boundary rule and its ratchet.
 *
 * Mantine owns colour, border, radius, elevation *and* layout: this app ships
 * one styling system, so a utility class in `src/` is a class nothing emits.
 * The rule is what makes that a fact rather than an intention, and the debt
 * list is the mechanism that let it land before the migration that satisfied
 * it, rather than after — when 33 files of drift would already be normal.
 */
describe('the Mantine boundary', () => {
  const layout = () => rule('mantine-owns-layout').pattern;

  it('catches a design token used as a utility class', () => {
    expect(layout().test('<div className="bg-card text-card-foreground">')).toBe(true);
    expect(layout().test('className="text-muted-foreground"')).toBe(true);
    expect(layout().test('className="border-sidebar-border"')).toBe(true);
    expect(layout().test('className="bg-success/15"')).toBe(true);
    expect(layout().test('className="hover:bg-accent focus-visible:ring-ring"')).toBe(true);
  });

  it('catches layout too — that half of the split is gone', () => {
    // Every one of these was legal while Tailwind owned layout. `Group`,
    // `Stack`, `Flex`, `SimpleGrid` and the style props answer all of them now.
    expect(layout().test('className="flex min-h-0 flex-1 flex-col gap-4"')).toBe(true);
    expect(layout().test('className="grid grid-cols-1 gap-3 sm:grid-cols-2"')).toBe(true);
    expect(layout().test('className="ml-auto flex items-center gap-2"')).toBe(true);
    expect(layout().test('className="h-svh overflow-hidden"')).toBe(true);
    expect(layout().test('className="p-4"')).toBe(true);
    expect(layout().test('className="w-[520px] p-4"')).toBe(true);
  });

  it('catches borders, radii and shadows', () => {
    expect(layout().test('className="border border-input"')).toBe(true);
    expect(layout().test('className="border-t-2"')).toBe(true);
    expect(layout().test('className="rounded-lg"')).toBe(true);
    expect(layout().test('className="rounded-full"')).toBe(true);
    expect(layout().test('className="shadow-sm"')).toBe(true);
    expect(layout().test('className="drop-shadow"')).toBe(true);
  });

  it('leaves this app\'s own classes and its CSS modules alone', () => {
    // Declared in `src/App.css`, painted on the auth panel.
    expect(layout().test('className="bg-grid bg-radial-fade"')).toBe(false);
    // A CSS-module hook is an expression, not a string literal.
    expect(layout().test('className={cols.owner}')).toBe(false);
    expect(layout().test('className={`${cols.col} ${cols.plan}`}')).toBe(false);
    expect(layout().test('className={className}')).toBe(false);
  });

  it('marks exactly the rule that routes through the debt list', () => {
    expect(
      rules
        .filter((r) => r.boundary)
        .map((r) => r.id)
        .sort()
    ).toEqual(['mantine-owns-layout']);
  });

  it('has no debt list left to forgive anything', () => {
    // `mantine-005` deleted `scripts/ui-lint.tailwind-debt.json` with its last
    // entry. A missing file means exactly one thing — the boundary rules are
    // enforced everywhere, with no escape hatch — and a file reappearing is a
    // permission slip, not a migration.
    expect(readDebt()).toBeNull();
  });

  it('still fails a debt entry that has stopped violating', () => {
    // The ratchet's other half, kept under test because the mechanism outlives
    // the list: hand it a file that does not violate and it says so. This is
    // what would fail loudly if anyone reintroduced the list to buy an
    // exemption for a new screen.
    const result = run({ debt: new Set(['src/App.tsx']) }) as {
      boundary: { stale: string[] };
    };
    expect(result.boundary.stale).toEqual(['src/App.tsx']);
  });

  it('is green with the boundary enforced everywhere', () => {
    const result = run() as {
      findings: { file: string; line: number; rule: string }[];
      boundary: { total: number; allowed: number; stale: string[] };
    };
    expect(result.findings.filter((f) => f.rule.startsWith('mantine-owns-'))).toEqual([]);
    expect(result.boundary.stale).toEqual([]);
    // Nothing is forgiven any more: every boundary finding that exists is an
    // enforced one, and there are none.
    expect(result.boundary.allowed).toBe(0);
  });
});
