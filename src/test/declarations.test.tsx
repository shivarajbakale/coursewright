import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Card, Paper } from '@mantine/core';

import { PageShell } from '@/components/page-shell';
import { ThemeProvider } from '@/components/theme-provider';

/**
 * Anything built on Mantine needs the provider — without it the component
 * throws rather than merely rendering unstyled, so a bare `render` here is a
 * crash, not a weaker assertion.
 */
const renderThemed = (ui: React.ReactElement) =>
  render(
    <ThemeProvider defaultTheme="dark" storageKey="declarations-test">
      {ui}
    </ThemeProvider>
  );

/**
 * The UI probe reads intent off the DOM rather than inferring it. These three
 * attributes are that contract: without them the archetype, panel, and
 * primary-action rules have nothing to key on.
 */
describe('probe declarations', () => {
  it('PageShell publishes its archetype', () => {
    renderThemed(
      <PageShell title="Projects" archetype="list-detail">
        <p>body</p>
      </PageShell>
    );
    const section = screen.getByText('body').closest('[data-archetype]');
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute('data-archetype', 'list-detail');
  });

  it('PageShell omits the attribute when no archetype is declared', () => {
    renderThemed(
      <PageShell title="Projects">
        <p>body</p>
      </PageShell>
    );
    expect(screen.getByText('body').closest('[data-archetype]')).toBeNull();
  });

  it('Card marks itself as a measurable panel', () => {
    // `data-panel` is a theme default now (src/theme.ts), not something the
    // component hard-codes — so this only holds inside the provider, which is
    // the point: the declaration and the palette come from the same place.
    renderThemed(<Card>panel body</Card>);
    expect(screen.getByText('panel body')).toHaveAttribute('data-panel', 'card');
  });

  it('Paper carries the same declaration as Card', () => {
    // Rule B1 counts surfaces. A `Paper` that did not declare itself would be a
    // surface the probe cannot see, and half the app's panels are Paper.
    renderThemed(<Paper>panel body</Paper>);
    expect(screen.getByText('panel body')).toHaveAttribute('data-panel', 'card');
  });
});

/**
 * Coverage, not correctness: Module B of the UI probe can only check the shape
 * a page declares, so a routed page with no `data-archetype` is a page no
 * archetype rule can reach — it passes by being invisible.
 *
 * The check is on the source rather than on a render because mounting every
 * route needs every route's providers, and the thing being asserted is a
 * declaration, not a behaviour. See docs/principles/screen-archetypes.md.
 */
describe('every routed page declares an archetype', () => {
  const root = path.resolve(__dirname, '../..');
  const router = fs.readFileSync(path.join(root, 'src/router/router.tsx'), 'utf8');

  // `component: X` / `notFoundComponent: X` -> the file X was imported from.
  const imports = new Map(
    [...router.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/(pages\/[^']+)'/g)].flatMap(([, names, file]) =>
      names.split(',').map((n) => [n.trim(), file] as const)
    )
  );
  const routed = [
    ...new Set(
      [...router.matchAll(/(?:notFound)?[Cc]omponent:\s*([A-Z][A-Za-z0-9_]*)/g)]
        .map((m) => m[1])
        .filter((name) => imports.has(name))
    ),
  ];

  it('finds the routed pages', () => {
    expect(routed.length).toBeGreaterThanOrEqual(8);
  });

  const declaresArchetype = (file: string): boolean => {
    const src = fs.readFileSync(file, 'utf8');
    if (/\barchetype=["'{]/.test(src) || /data-archetype=/.test(src)) return true;
    // A page may declare through the layout it renders — the auth pages put the
    // shape on AuthLayout's form column, because the brand panel beside it is
    // chrome and not part of the archetype.
    return [...src.matchAll(/from\s*'(\.[^']+)'/g)].some((m) => {
      const sibling = path.resolve(path.dirname(file), `${m[1]}.tsx`);
      return fs.existsSync(sibling) && declaresArchetype(sibling);
    });
  };

  it.each(routed)('%s declares one', (name) => {
    const file = path.join(root, 'src', `${imports.get(name)}.tsx`);
    const declares = declaresArchetype(file);
    expect(
      declares,
      `${imports.get(name)}.tsx renders a route but declares no archetype. ` +
        `Pick one from docs/principles/screen-archetypes.md and pass it to PageShell.`
    ).toBe(true);
  });
});

/**
 * Every routed page is measured by the UI probe.
 *
 * The probe mounts the list in `scripts/ui-probe/app.tsx`, and that list is not
 * derived from anything — it is typed by hand, so it drifts silently. It held
 * four entries while the app shipped seven routes: Inbox, Team and Billing were
 * routed, linked from the sidebar, and looked at by nothing. All three failed a
 * rule the moment they were added — two for a filter that scrolled away with
 * its rows, one for declaring an archetype it did not have — and one of them
 * shipped a filter row a user described as looking hand-rolled.
 *
 * A page nobody measures is a page nobody has checked. This is the gate that
 * says so.
 *
 * `$param` routes are excluded: the probe reaches the detail view through the
 * story sweep and its own navigation test, because a path with a parameter
 * needs a fixture id to be worth mounting.
 */
describe('every routed page is in the probe’s page list', () => {
  const root = path.resolve(__dirname, '../..');
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  const paths = (source: string): string[] =>
    [...source.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]);

  const routed = paths(read('src/router/router.tsx')).filter((p) => !p.includes('$'));

  /*
    Only the PAGES array, not the whole file.

    The first version of this read every `path:` in `app.tsx` — which includes
    the probe's own route tree, so it passed with `/billing` deleted from PAGES.
    An adversarial check that does not go red has proved nothing.
  */
  const probeSource = read('scripts/ui-probe/app.tsx');
  const pagesBlock = probeSource.slice(
    probeSource.indexOf('export const PAGES'),
    probeSource.indexOf('] as const;', probeSource.indexOf('export const PAGES'))
  );
  const probed = new Set(paths(pagesBlock));

  it('finds the routes', () => {
    expect(routed.length).toBeGreaterThanOrEqual(7);
  });

  it.each(routed)('%s is measured', (route) => {
    expect(
      probed.has(route),
      `${route} is routed but absent from PAGES in scripts/ui-probe/app.tsx — nothing measures it`
    ).toBe(true);
  });
});
