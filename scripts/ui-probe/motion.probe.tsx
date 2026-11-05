/// <reference types="@vitest/browser/providers/playwright" />
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page } from '@vitest/browser/context';
import { cleanup, render } from '@testing-library/react';

import { worker } from '@/mocks/browser';
import { AppAt, PAGES, pageReady, sessionHandler } from './app';
import { collectMotion } from './motion-audit';
import { report } from './report';
import { M4, runMotionRules } from './rules/motion';
import { settleMotion, VIEWPORTS } from './mount';
import type { Violation } from './types';
import type { MotionAudit } from './rules/motion';

/**
 * Module M against the real shell, in both motion modes.
 *
 * This file exists rather than folding into `pages.probe.tsx` because it needs
 * two things no other probe does.
 *
 * The first is a *browser-level* setting. The reduced-motion pass emulates
 * `prefers-reduced-motion: reduce` through CDP, which changes the answer
 * `matchMedia` gives the app — the same lever the OS pulls, rather than a prop
 * the test hands the component. A gate that switched motion off through the
 * app's own API would be testing that a flag it set is the flag it set. Framer
 * confirms the emulation landed by logging its own reduced-motion warning, and
 * that line in the run output is worth as much as the assertion beside it.
 *
 * The second is the opposite of what every other probe wants: this one must
 * measure the app *before* it settles. `measure()` in `mount.tsx` deliberately
 * waits out every animation, because modules A, B, C and T read geometry and an
 * entrance in flight is geometry that is wrong on purpose. Module M reads the
 * flight itself, so it does its own waiting.
 *
 * One viewport, not three. Motion has no width: an entrance that finishes at
 * 1280 finishes at 1920, and the three-viewport sweep is Module A's argument.
 */
const VIEWPORT = VIEWPORTS[1];

/** The media features CDP overrides for the reduced-motion pass. */
async function emulateReducedMotion(reduce: boolean): Promise<void> {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  });
}

/** Mount a page into a viewport-filling host. Returns the host to audit. */
function mountHost(path: string): HTMLElement {
  const host = document.createElement('div');
  host.style.width = '100%';
  host.style.height = '100vh';
  host.style.overflow = 'hidden';
  document.body.appendChild(host);
  render(<AppAt path={path} />, { container: host });
  return host;
}

/**
 * Poll for the page's data without waiting out its motion.
 *
 * `waitUntil` in `mount.tsx` ends in `settle()`, which is exactly the wait this
 * file has to avoid: by the time it returns the entrance is over and there is
 * nothing left to measure.
 */
async function waitForContent(timeoutMs = 5000): Promise<void> {
  const start = performance.now();
  while (!pageReady()) {
    if (performance.now() - start > timeoutMs) {
      throw new Error('waitForContent: the page never rendered its content');
    }
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
}

/** The session every protected route needs before it renders anything. */
function authorize(): void {
  localStorage.setItem(
    'demo-session',
    JSON.stringify({
      user: { id: 'probe', name: 'Probe User', email: 'probe@rocketship.dev' },
      session: {
        id: 'probe',
        token: 'probe',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
  );
}

/** One animation frame. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Login is the one page with no shell, so nothing there declares motion. */
const MOTION_PAGES = PAGES.filter((p) => p.path !== '/login');

function assertClean(label: string, violations: Violation[]): void {
  const { enforced } = report(label, violations);
  expect(enforced, enforced.map((v) => `${v.rule} ${v.message}`).join('\n')).toEqual([]);
}

describe('motion', () => {
  beforeAll(async () => {
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
    worker.use(sessionHandler);
  });

  afterAll(async () => {
    await emulateReducedMotion(false);
    worker.stop();
  });

  afterEach(() => cleanup());

  it.each(MOTION_PAGES)('$name animates, then settles visible', async ({ name, path }) => {
    authorize();
    await emulateReducedMotion(false);
    await page.viewport(VIEWPORT.width, VIEWPORT.height);

    const host = mountHost(path);
    const audits: MotionAudit[] = [];
    try {
      // Three moments, because an entrance is not one event. The shell and the
      // page frame animate the instant they mount; the rows and tiles animate
      // when their data lands, which is later; and everything has to be still
      // and visible at the end. Sampling only the last of those is how a
      // motion gate ends up measuring an app that no longer moves.
      await nextFrame();
      audits.push(await collectMotion(host, `${name} at mount`));

      await waitForContent();
      audits.push(await collectMotion(host, `${name} with data`));

      await settleMotion();
      audits.push(await collectMotion(host, `${name} settled`, { settled: true }));

      for (const audit of audits) assertClean(audit.label, runMotionRules(audit));
      assertClean(`${name} moved at all`, M4(audits));
    } finally {
      host.remove();
    }
  });

  /**
   * A route change must not replay.
   *
   * The only test here that measures a *transition* rather than a mount, and
   * the reason M5 exists. Samples 40 frames across a navigation, which is the
   * span a flicker hides in: its start and its end look identical, and every
   * other rule in this module reads exactly those two moments.
   *
   * It caught `AnimatePresence mode="wait"` rendering the destination page as
   * its own exiting child — the new page arrived, faded to zero, and faded
   * back in, on every navigation in the app.
   */
  it('a route change does not replay the page it just showed', async () => {
    authorize();
    await emulateReducedMotion(false);
    await page.viewport(VIEWPORT.width, VIEWPORT.height);

    const host = mountHost('/');
    try {
      await waitForContent();
      await settleMotion();

      // Navigate through the app's own nav, not the router API: the defect
      // lived in the shell's outlet, and reaching past it would have missed it.
      // Sources: a data-backed page reached from the rail, as /customers was in
      // the template this probe was written against.
      const link = host.querySelector<HTMLAnchorElement>('a[href="/sources"]');
      expect(link, 'the sidebar has no link to /sources to navigate with').not.toBeNull();
      link!.click();

      const crossing = await collectMotion(host, 'route change', {
        frameGap: 1,
        samples: 40,
      });
      console.log('NAVDEBUG h1=', host.querySelector('h1')?.textContent,
        'routeOpacity=', crossing.frames.map((f) => f.filter((e) => e.kind === 'route').map((e) => Math.round(e.opacity * 100)).join('')).join(','));
      assertClean('route change', runMotionRules(crossing));

      await settleMotion();
      const settled = await collectMotion(host, 'route change settled', { settled: true });
      assertClean('route change settled', runMotionRules(settled));
    } finally {
      host.remove();
    }
  });

  /**
   * WCAG 2.3.3, measured rather than asserted.
   *
   * Sampled at the same two moments as the pass above and held to the opposite
   * standard: the first sample must already be the end state, and the second
   * must be identical to it. An app that respects the setting has nothing to
   * measure here, which is the point — M1 is the rule that fails when it does
   * not, and M4 is switched off under reduced motion for the same reason.
   */
  it.each(MOTION_PAGES)('$name does not animate under reduced motion', async ({ name, path }) => {
    authorize();
    await emulateReducedMotion(true);
    await page.viewport(VIEWPORT.width, VIEWPORT.height);

    const host = mountHost(path);
    try {
      await nextFrame();
      assertClean(
        `${name} reduced at mount`,
        runMotionRules(await collectMotion(host, `${name} reduced at mount`, { reducedMotion: true }))
      );

      await waitForContent();
      assertClean(
        `${name} reduced with data`,
        runMotionRules(await collectMotion(host, `${name} reduced with data`, { reducedMotion: true }))
      );

      // And it still ends up readable. Reduced motion means the end state on
      // the first frame, not the hidden state forever — which is the failure a
      // naive implementation of it ships.
      await settleMotion();
      assertClean(
        `${name} reduced settled`,
        runMotionRules(await collectMotion(host, `${name} reduced settled`, { reducedMotion: true, settled: true }))
      );
    } finally {
      host.remove();
    }
  });
});
