import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Token references have to resolve at runtime.
 *
 * The failure this pins is a `var(--x)` nobody declares: the surface swatches
 * once asked for `var(--white)`, which is not a token, so the label text fell
 * back to whatever it inherited. Nothing catches that — not type-check, not
 * eslint, not ui-lint. The CSS is simply dropped, and the screen looks *almost*
 * right.
 *
 * Most of this app's tokens are declared at runtime rather than in a
 * stylesheet this test can read: Mantine emits `--mantine-*` from the theme,
 * and `cssVariablesResolver` in `src/theme.ts` emits the two `--app-*` ones.
 * `RUNTIME_PREFIXES` is what says so. Everything else has to be in
 * `src/App.css`.
 *
 * There used to be a second failure mode here — `@theme inline`, Tailwind's
 * block whose variables are inlined into utilities and never emitted, so
 * `var(--radius-sm)` resolved to nothing. `mantine-011` removed Tailwind, and
 * with it that whole class of defect.
 */

const ROOT = resolve(__dirname, '../..');
const css = readFileSync(join(ROOT, 'src/App.css'), 'utf8');

/**
 * Custom properties something other than `src/App.css` declares at runtime.
 *
 * - `--radix-` / `--anchor-` / `--available-` — positioning variables a floating
 *   surface sets on the element itself. Mantine's own come through
 *   `--mantine-`; the others are kept so a dependency that ships them cannot
 *   fail this test for declaring a variable at run time.
 * - `--mantine-` — emitted by `@mantine/core/styles.layer.css`, which this file
 *   imports. They are as real as anything in `:root`; they are simply declared
 *   in a stylesheet this test does not read.
 * - `--app-` — declared by the `cssVariablesResolver` in `src/theme.ts`, which
 *   is where a token that Mantine has no equivalent for belongs:
 *   `--app-surface` and `--app-control`.
 */
const RUNTIME_PREFIXES = [
  /^--radix-/,
  /^--anchor-/,
  /^--available-/,
  /^--mantine-/,
  /^--app-/,
];
const isProvided = (name: string) => RUNTIME_PREFIXES.some((re) => re.test(name));

/** Comments talk about `var(--radius-sm)` on purpose; only code counts. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const declarations = (text: string) =>
  new Set(Array.from(text.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g), (m) => m[1]));

const declaredEverywhere = declarations(css);
/** Every declaration in this file is emitted as a real custom property. */
const emitted = declaredEverywhere;

/** `style={{ '--sidebar-width': … }}` declares the variable just as CSS does. */
function inlineDeclarations(files: string[]): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    for (const m of readFileSync(join(ROOT, file), 'utf8').matchAll(
      /['"`](--[a-zA-Z0-9_-]+)['"`]?\s*:/g
    )) {
      names.add(m[1]);
    }
  }
  return names;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (entry === 'node_modules') continue;
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

describe('CSS token references', () => {
  const files = [...sourceFiles('src'), ...sourceFiles('.storybook')].filter(
    (f) => !f.endsWith('css-tokens.test.ts')
  );
  const declaredInSource = inlineDeclarations(files);

  /** Every `var(--x)` with no fallback, as `file:line --x`. */
  function references(): { file: string; line: number; name: string }[] {
    const out: { file: string; line: number; name: string }[] = [];
    for (const file of files) {
      stripComments(readFileSync(join(ROOT, file), 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/var\((--[a-zA-Z0-9_-]+)\s*([,)])/g)) {
            if (m[2] === ',') continue; // has a fallback
            out.push({ file, line: i + 1, name: m[1] });
          }
        });
    }
    return out;
  }

  const show = (r: { file: string; line: number; name: string }) =>
    `${r.file}:${r.line} ${r.name}`;

  it('reads at least one token, so the sweep cannot pass vacuously', () => {
    expect(references().length).toBeGreaterThan(20);
  });

  it('never reads a variable nothing declares', () => {
    expect(
      references()
        .filter(
          (r) =>
            !isProvided(r.name) &&
            !declaredEverywhere.has(r.name) &&
            !declaredInSource.has(r.name)
        )
        .map(show)
    ).toEqual([]);
  });

  it('resolves every token the Tokens story paints with', () => {
    const story = readFileSync(
      join(ROOT, 'src/components/_overview/Tokens.stories.tsx'),
      'utf8'
    );
    // The story names its tokens in one shape: `token: '--x'`.
    const names = Array.from(
      story.matchAll(/token: '(--[a-zA-Z0-9-]+)'/g),
      (m) => m[1]
    );

    expect(names.length).toBeGreaterThan(5);
    expect(
      names.filter((n) => !isProvided(n) && !emitted.has(n))
    ).toEqual([]);
  });
});
