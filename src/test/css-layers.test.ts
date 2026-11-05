import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The cascade contract, now that there is only one styling system.
 *
 * This app used to run Tailwind alongside Mantine, and `src/App.css` carried a
 * six-layer order whose only job was to keep Tailwind's preflight from
 * flattening every Mantine button. Tailwind is gone; what is left still has to
 * hold two rules, and neither of them fails loudly when broken:
 *
 * 1. **Never give a Mantine stylesheet an explicit layer.** Each
 *    `styles.layer.css` already wraps itself in `@layer mantine`. Adding
 *    `layer(mantine)` at the import site nests it into `mantine.mantine`, which
 *    sorts *inside* the layer and quietly changes precedence.
 * 2. **This file's own rules live above `mantine`.** A layer wins on order, not
 *    specificity, so an app rule outside a layer or in a layer declared before
 *    `mantine` loses to a Mantine component style no matter how specific it is.
 */

const ROOT = resolve(__dirname, '../..');
const css = readFileSync(join(ROOT, 'src/App.css'), 'utf8');
/** The header comment names things in order to talk about them; only code counts. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Character offset of an `@import` line, or -1. */
const importAt = (specifier: string) => css.indexOf(`@import '${specifier}'`);

const MANTINE_IMPORTS = [
  '@mantine/core/styles.layer.css',
  '@mantine/notifications/styles.layer.css',
  '@mantine/dates/styles.layer.css',
  '@mantine/spotlight/styles.layer.css',
  '@mantine/charts/styles.layer.css',
  '@mantine/carousel/styles.layer.css',
];

describe('CSS layer contract', () => {
  it('declares the layer order before anything else', () => {
    const statement = '@layer mantine, app;';
    expect(css).toContain(statement);
    // Nothing may come before it but comments — a rule ahead of a bare `@layer`
    // statement makes the statement invalid and the browser drops it.
    expect(css.slice(0, css.indexOf(statement)).replace(/\/\*[\s\S]*?\*\//g, '').trim()).toBe('');
  });

  it('imports no Tailwind stylesheet at all', () => {
    expect(code).not.toMatch(/@import\s+['"]tailwindcss/);
    expect(code).not.toMatch(/@theme\b/);
    expect(code).not.toMatch(/@apply\b/);
  });

  it('imports every Mantine stylesheet, none of them layered at the import site', () => {
    for (const specifier of MANTINE_IMPORTS) {
      expect(importAt(specifier), `${specifier} is not imported`).toBeGreaterThan(-1);
      expect(css).toContain(`@import '${specifier}';`);
    }
  });

  it('puts every app rule in the `app` layer, above mantine', () => {
    // A rule outside a layer would win over both — which reads as "it works",
    // right up until a Mantine update needs to override it and cannot.
    const withoutLayerBlocks = code.replace(/@layer\s+app\s*\{[\s\S]*\}/, '');
    expect(withoutLayerBlocks).not.toMatch(/[^@\s][^{}]*\{/);
  });
});
