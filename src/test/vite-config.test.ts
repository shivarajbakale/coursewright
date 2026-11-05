import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The route tree in `src/router/router.tsx` is code-based — built by hand with
 * `createRoute`. The TanStack Router *generator* plugin exists to write a
 * file-based tree from a routes directory. Pointing it at `src/router` gives it
 * nothing to generate and it throws on boot. `.storybook/main.ts` already strips
 * it by name; this test stops it coming back.
 *
 * The assertion reads the config as source rather than importing it: the app and
 * the vite vitest bundles are different majors, so pulling `vite.config.ts` into
 * the app's TS project produces an unresolvable clash between the two `Plugin`
 * types. Source is enough — the plugin can only get back in via this file.
 */
const source = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

describe('vite config', () => {
  it('does not register the TanStack Router generator plugin', () => {
    expect(source).not.toMatch(/TanStackRouter/);
    expect(source).not.toMatch(/@tanstack\/router-plugin/);
  });

  it('registers react, and nothing that used to style the app', () => {
    expect(source).toMatch(/plugins:\s*\[\s*react\(\)\s*,?\s*\]/);
    expect(source).not.toMatch(/tailwind/);
  });
});
