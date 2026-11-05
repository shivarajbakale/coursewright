import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { page } from '@vitest/browser/context';

import { snapshot } from './snapshot';
import type { Snapshot } from './types';

/** Set VITE_UI_PROBE_SHOTS=1 to write a PNG per measured view for the evaluator. */
const SHOTS = Boolean(import.meta.env.VITE_UI_PROBE_SHOTS);

/** The three widths every rule must hold at. Rule A5 compares across them. */
export const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

/**
 * Two animation frames plus a macrotask: layout, fonts, and a React commit —
 * and then the motion.
 *
 * The motion wait is not optional politeness. Every rule in modules A, B, C and
 * T measures geometry and computed style, and an entrance animation is a period
 * during which both are wrong on purpose: a tile mid-fade has an opacity C4
 * reads as a contrast level, and a tile mid-slide has a box A2 reads as
 * overflow. Without this the probe would fail intermittently, and the failures
 * would look like layout bugs rather than like timing.
 */
export async function settle(): Promise<void> {
  if (document.fonts) await document.fonts.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await settleMotion();
}

/** How long to wait for the app to stop moving before measuring it anyway. */
const MOTION_SETTLE_CAP_MS = 2000;

/** Frames the app must look identical across to count as still. */
const QUIET_FRAMES = 2;

/**
 * What every animated element looks like right now, as one comparable string.
 *
 * Opacity and transform because those are what the app animates; the box
 * because a layout animation would move it and M3 needs to have been able to
 * see that before this function waits it out.
 */
function motionFingerprint(): string {
  const parts: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-motion]')) {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    parts.push(
      `${style.opacity}|${style.transform}|${Math.round(box.width)}x${Math.round(box.height)}`
    );
  }
  return parts.join(';');
}

/**
 * Has every animated element reached the state the layout put it in?
 *
 * Quiescence alone is not enough, and this is the reason: a staggered child
 * waiting out its 40ms delay has not started moving yet, so two consecutive
 * frames look identical and a fingerprint comparison calls the page still —
 * while it is sitting at opacity 0. `settleMotion` returned there, and Module M
 * read a page whose tiles had never arrived. So "still" means unchanging *and*
 * arrived.
 */
function arrived(): boolean {
  for (const el of document.querySelectorAll<HTMLElement>('[data-motion]')) {
    const style = getComputedStyle(el);
    if (Number(style.opacity) < 0.99) return false;
    if (style.transform !== 'none' && !/^matrix\(1, ?0, ?0, ?1, ?0, ?0\)$/.test(style.transform)) {
      return false;
    }
  }
  return true;
}

/**
 * Wait until the app stops changing, or give up and let the rules report it.
 *
 * **Not** `Animation.finished` on `document.getAnimations()`, which is the
 * obvious implementation and the wrong one. Framer animates transform and
 * opacity by writing inline styles from its own requestAnimationFrame loop, so
 * none of this app's entrances are in that list — waiting on it returned
 * immediately and the probe measured pages mid-fade. Module M was built on the
 * same mistake and reported nothing; the note is in `rules/motion.ts`.
 *
 * So this watches the rendered result instead, and stops when two consecutive
 * frames are identical. That is correct for anything that animates, whatever
 * drives it, and it terminates on its own for anything that does not.
 *
 * `data-motion-busy` covers the one case a fingerprint cannot see:
 * `AnimatedNumber` animates *text*, which changes no style and no box.
 *
 * The cap matters because a skeleton shimmer or a spinner never stops, and
 * hanging the run is a worse answer than measuring a page with a pulsing
 * placeholder on it. M3 is the rule with an opinion about a loop that has no
 * business being one.
 */
export async function settleMotion(cap = MOTION_SETTLE_CAP_MS): Promise<void> {
  const deadline = performance.now() + cap;
  let previous = motionFingerprint();
  let quiet = 0;

  while (performance.now() < deadline) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const current = motionFingerprint();

    if (current === previous && !document.querySelector('[data-motion-busy]') && arrived()) {
      quiet += 1;
      if (quiet >= QUIET_FRAMES) return;
    } else {
      quiet = 0;
    }
    previous = current;
  }
}

/** Poll until `predicate` holds. Used to wait out MSW-backed queries. */
export async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeoutMs) {
      throw new Error(`waitUntil: predicate never became true within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await settle();
}

/**
 * Mount `ui` into a viewport-filling host, let it settle, and snapshot it.
 *
 * The host is `100vh` and `overflow: hidden` because that is the app's own
 * shell contract (`App.tsx` is `h-svh overflow-hidden`). Measuring in a taller
 * host would hide exactly the overflow the probe is looking for.
 */
export async function measure(
  ui: React.ReactElement,
  label: string,
  viewport: { width: number; height: number },
  until?: () => boolean
): Promise<Snapshot> {
  await page.viewport(viewport.width, viewport.height);

  const host = document.createElement('div');
  host.style.width = '100%';
  host.style.height = '100vh';
  host.style.overflow = 'hidden';
  document.body.appendChild(host);

  try {
    render(ui, { container: host });
    await settle();
    if (until) await waitUntil(until);
    const result = snapshot(host, label);
    if (SHOTS) {
      await page.screenshot({ path: `../../.ui-probe/shots/${label.replace(/[^\w@-]+/g, '_')}.png` });
    }
    return result;
  } finally {
    cleanup();
    host.remove();
  }
}
