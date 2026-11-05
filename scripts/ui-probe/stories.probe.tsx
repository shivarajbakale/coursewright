import * as React from 'react';
import axe from 'axe-core';
import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
import { cleanup, render } from '@testing-library/react';
import { page } from '@vitest/browser/context';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { worker } from '@/mocks/browser';
import * as previewAnnotations from '../../.storybook/preview';
import { toViolations } from './a11y';
import { settle } from './mount';
import { report } from './report';
import { runRules } from './rules';
import { snapshot } from './snapshot';
import type { Violation } from './types';

/**
 * Module D — every story mounts, paints, and is not a stub.
 *
 * The stub check is the load-bearing one. Storybook builds green with 179
 * stories while four flagship screens render `Stubbed page: /login`, because
 * "the build succeeded" and "the screen rendered" are different claims and only
 * the first was ever checked.
 */

const STUB_MARKER = 'Stubbed page:';

setProjectAnnotations([previewAnnotations as never]);

type StoryModule = Record<string, unknown>;
const modules = import.meta.glob<StoryModule>('../../src/**/*.stories.tsx', { eager: true });

const stories = Object.entries(modules).flatMap(([path, mod]) => {
  if (!(mod as { default?: unknown }).default) return [];
  const composed = composeStories(mod as never);
  return Object.entries(composed).map(([name, Story]) => ({
    id: `${path.replace('../../src/', '')} :: ${name}`,
    Story: Story as React.ComponentType & { load?: () => Promise<void> },
  }));
});

describe('module D — story render sweep', () => {
  // Start the MSW worker so stories that call useCustomers / useNotifications
  // / useTeam / useBilling get the same fixtures as `npm run dev` with mocking
  // on. Without this, page stories (Dashboard, CustomersPage, etc.) render
  // error states — the router decorator stub used to mask this because the
  // page component never ran.
  beforeAll(async () => {
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
    expect(stories.length, 'no stories were discovered — check the glob').toBeGreaterThan(100);
  });

  afterAll(() => worker.stop());

  it.each(stories)('$id', async ({ id, Story }) => {
    // Pin a wide viewport before each story. Pages that branch on
    // `useIsMobile()` (Dashboard, CustomersPage) need ≥768px to render the
    // desktop layout the probe is meant to measure — ResizablePanelGroup
    // only mounts above that breakpoint, and the rule B1 list-detail
    // assertion walks its panels. The default browser-mode viewport is
    // narrower, so without this the mobile sheet branch renders and B1
    // reports a missing pane.
    await page.viewport(1280, 720);

    const host = document.createElement('div');
    host.style.width = '100%';
    host.style.minHeight = '100vh';
    document.body.appendChild(host);

    // Mantine portals its overlays (Modal, Drawer, Menu, Popover…) to
    // document.body, not into the mount host. Measuring the host alone would
    // score an open dialog as "rendered nothing" — which is how a Command
    // palette story passed only because a stray sr-only node happened to sit
    // in the host. Anything that appears on body during this render counts.
    const preexisting = new Set(Array.from(document.body.children));
    const portalsOf = () =>
      Array.from(document.body.children).filter(
        (el): el is HTMLElement =>
          el !== host && !preexisting.has(el) && el instanceof HTMLElement
      );

    const violations: Violation[] = [];
    try {
      if (typeof Story.load === 'function') await Story.load();
      render(<Story />, { container: host });
      await settle();
    } catch (error) {
      violations.push({
        rule: 'D1',
        message: `story threw while mounting: ${(error as Error).message}`,
        nodeId: null,
        selectorHint: id,
        detail: {},
      });
    }

    if (violations.length === 0) {
      const s = snapshot(host, id);
      const portals = portalsOf();

      const hasArea = (node: { box: { width: number; height: number }; id: number }) =>
        node.box.width > 0 && node.box.height > 0 && node.id !== 0;
      const painted =
        s.nodes.some(hasArea) ||
        portals.some((el) => snapshot(el, id).nodes.some(hasArea));
      if (!painted) {
        violations.push({
          rule: 'D2',
          message: 'story mounted but rendered nothing with area',
          nodeId: null,
          selectorHint: id,
          detail: { nodes: s.nodes.length },
        });
      }

      if ((host.textContent ?? '').includes(STUB_MARKER)) {
        violations.push({
          rule: 'D3',
          message: `story renders the router decorator's placeholder ("${STUB_MARKER}") instead of the page`,
          nodeId: null,
          selectorHint: id,
          detail: {},
        });
      }

      // Rules that need declared intent only apply where intent was declared.
      if (s.nodes.some((n) => n.data.archetype !== undefined)) {
        violations.push(...runRules(s));
      }

      for (const root of [host, ...portals]) {
        const results = await axe.run(root, { resultTypes: ['violations'] });
        violations.push(...toViolations(results));
      }
    }

    const { enforced } = report(id, violations);
    cleanup();
    host.remove();
    expect(enforced, `${id}: ${enforced.map((v) => `${v.rule} ${v.message}`).join('; ')}`).toEqual([]);
  });
});
