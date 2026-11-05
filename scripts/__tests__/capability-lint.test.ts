import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error — plain ESM script, no types
import { MAP_FILE, importedSymbols, parseMap, run } from '../capability-lint.mjs';

const projectRoot = join(__dirname, '..', '..');
const mapText = () => readFileSync(join(projectRoot, MAP_FILE), 'utf8') as string;

type Violation = { rule: string; message: string };
const rules = (violations: Violation[]) => violations.map((v) => v.rule);

/**
 * A throwaway project root: the real package.json, node_modules and source
 * tree by symlink, and a map we are free to break. Everything the linter reads
 * is therefore real except the one thing under test.
 */
function rootWithMap(map: string): string {
  const root = mkdtempSync(join(tmpdir(), 'capability-lint-'));
  for (const entry of ['package.json', 'node_modules', 'src', '.storybook', 'docs', 'scripts']) {
    symlinkSync(join(projectRoot, entry), join(root, entry));
  }
  const target = join(root, MAP_FILE as string);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, map);
  return root;
}

/**
 * The knowledge contract.
 *
 * `scripts/capability-lint.mjs` is what replaced a generated kit reference with
 * a hand-written one without losing the guarantee. A generated file could not
 * lie about what existed; this one can, so every rule is pinned here against a
 * map it must reject — a rule that silently stops matching would let the map
 * rot while the build stays green.
 */
describe('capability-lint', () => {
  it('passes on the map this repo ships', async () => {
    const { violations, entries } = await run();
    expect(violations).toEqual([]);
    expect(entries.length).toBeGreaterThan(30);
  });

  it('reads an entry as component names, a package, and four fields', () => {
    const entries = parseMap(mapText()) as Array<{
      names: string[];
      pkg: string;
      fields: Record<string, string>;
    }>;
    const button = entries.find((e) => e.names.includes('Button'));
    expect(button?.pkg).toBe('@mantine/core');
    expect(Object.keys(button?.fields ?? {}).sort()).toEqual([
      'Gotcha',
      'Instead',
      'Ours',
      'Use when',
    ]);
    // A heading may name a family: `Group` · `Stack` is one decision, not two.
    expect(entries.find((e) => e.names.includes('Stack'))?.names).toContain('Group');
  });

  it('sees every Mantine value import in the source, and no type-only one', () => {
    const imported = importedSymbols() as Map<string, string>;
    expect(imported.has('AppShell')).toBe(true);
    expect(imported.get('AppShell')).toContain('App.tsx');
    expect(imported.has('notifications')).toBe(true);
    // `import type { MantineTheme }` is a type, not a component to document.
    expect([...imported.keys()].some((n) => n.startsWith('type '))).toBe(false);
  });

  it('M1 — fails an entry that lost a field', async () => {
    const broken = mapText().replace(/^- \*\*Instead:\*\* .*$/m, '');
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(rules(violations)).toContain('M1');
  });

  it('M2 — fails a component the installed package does not export', async () => {
    const broken = mapText().replace('#### `Skeleton` — @mantine/core', '#### `Shimmer` — @mantine/core');
    const { violations } = await run({ root: rootWithMap(broken) });
    const m2 = violations.filter((v: Violation) => v.rule === 'M2');
    expect(m2[0]?.message).toContain('does not export `Shimmer`');
  });

  it('M4 — fails a reference slice that has moved', async () => {
    const broken = mapText().replace('`src/App.tsx`', '`src/Shell.tsx`');
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(violations.filter((v: Violation) => v.rule === 'M4')[0]?.message).toContain('src/Shell.tsx');
  });

  it('M5 — fails when a component enters the app with no entry', async () => {
    // Drop Tooltip's entry: the source still imports it, so the map now hides a
    // choice somebody made. This is the rule that keeps the file a map.
    const broken = mapText().replace(/^#### `Tooltip` — @mantine\/core$/m, '#### `Popover` — @mantine/core');
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(violations.filter((v: Violation) => v.rule === 'M5')[0]?.message).toContain('`Tooltip`');
  });

  it('M6 — fails when a family a product cannot ship without is deleted', async () => {
    const broken = mapText().replace('#### `Modal` — @mantine/core', '#### `Affix` — @mantine/core');
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(violations.filter((v: Violation) => v.rule === 'M6')[0]?.message).toContain('`Modal`');
  });

  it('M7 — fails when a section that makes the file usable goes missing', async () => {
    const broken = mapText().replace('\n## Sources\n', '\n## Links\n');
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(rules(violations)).toContain('M7');
  });

  it('M8 — fails an entry still arguing in the deleted kit’s vocabulary', async () => {
    const broken = mapText().replace(
      '- **Instead:** `Title` for anything that is a heading in the document outline.',
      '- **Instead:** the shadcn `Label` atom from `src/components/ui`.'
    );
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(rules(violations)).toContain('M8');
  });

  it('M9 — fails when the stamp and the installed major disagree', async () => {
    const broken = mapText().replace(/@mantine\/core (\d+)\.\d+\.\d+\*\*/, '@mantine/core 7.0.0**');
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(violations.filter((v: Violation) => v.rule === 'M9')[0]?.message).toContain('7.0.0');
  });

  it('M10 — fails when the library ships a component the map never answers', async () => {
    // Stepper is not imported anywhere, so M5 cannot see it going missing.
    // M10 is the rule that does: a component absent from the map reads, to the
    // agent choosing one, as a component that does not exist.
    const broken = mapText().replace(
      '#### `Stepper` — @mantine/core',
      '#### `Timeline` — @mantine/core'
    );
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(violations.filter((v: Violation) => v.rule === 'M10')[0]?.message).toContain('`Stepper`');
  });

  it('M10 — fails a refusal that gives no reason', async () => {
    const broken = mapText().replace(/^- `ModalBase` — .*$/m, '- `ModalBase` — ');
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(violations.filter((v: Violation) => v.rule === 'M10')[0]?.message).toContain(
      'without saying why'
    );
  });

  it('M10 — fails a component that is both routed and refused', async () => {
    const broken = mapText().replace(
      /^- `ModalBase` — /m,
      '- `Modal` — superseded, allegedly\n- `ModalBase` — '
    );
    const { violations } = await run({ root: rootWithMap(broken) });
    expect(violations.filter((v: Violation) => v.rule === 'M10')[0]?.message).toContain(
      'both routes and refuses'
    );
  });

  it('M10 — fails rather than passes when the roster cannot be read', async () => {
    // The anti-vacuity half. Without it, a Mantine layout change would turn
    // "every component is answered" into "no components were checked", and the
    // build would stay green while the guarantee evaporated.
    const root = mkdtempSync(join(tmpdir(), 'capability-lint-noroster-'));
    for (const entry of ['package.json', 'src', '.storybook', 'docs', 'scripts']) {
      symlinkSync(join(projectRoot, entry), join(root, entry));
    }
    mkdirSync(dirname(join(root, MAP_FILE as string)), { recursive: true });
    writeFileSync(join(root, MAP_FILE as string), mapText());
    const { violations } = await run({ root });
    expect(violations.filter((v: Violation) => v.rule === 'M10')[0]?.message).toContain(
      'could not read the component roster'
    );
  });

  it('answers every component the installed @mantine/core ships', async () => {
    const { roster, documented, refused } = (await run()) as {
      roster: string[];
      documented: Set<string>;
      refused: Set<string>;
    };
    expect(roster.length).toBeGreaterThan(100);
    expect(roster.filter((n) => !documented.has(n) && !refused.has(n))).toEqual([]);
  });

  it('keeps the map and the skill that routes through it together', () => {
    expect(existsSync(join(projectRoot, '.claude/skills/use-mantine/SKILL.md'))).toBe(true);
    expect(readFileSync(join(projectRoot, '.claude/skills/use-mantine/SKILL.md'), 'utf8')).toContain(
      'mantine-capabilities.md'
    );
  });
});
