import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { worker } from '@/mocks/browser';
import { AppAt, PAGES, pageReady, sessionHandler } from './app';
import { measure, VIEWPORTS } from './mount';
import { report } from './report';
import { runRules } from './rules';
import { compareAcrossViewports } from './rules/stability';
import type { Violation } from './types';

/**
 * Modules A, B and C against the real shell at three viewports.
 *
 * Every defect in the design spec's measurement table was measured on this
 * composition — shell plus page — not on a page in isolation, which is why the
 * story sweep in stories.probe.tsx does not replace this.
 */
describe('page sweep', () => {
  beforeAll(async () => {
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
    worker.use(sessionHandler);
  });

  afterAll(() => worker.stop());

  it.each(PAGES)('$name holds at every viewport', async ({ name, path }) => {
    // Auth gate for the probe: set up a demo session in localStorage so
    // AuthGuard doesn't bounce protected routes to /login. The /login test
    // specifically clears it so LoginPage renders the form instead of the
    // dev auto-login redirect. This is the one place the probe declares its
    // auth intent — pages don't need to know they're being probed.
    if (path === '/login' || path === '/signup') {
      localStorage.removeItem('demo-session');
    } else {
      const session = {
        user: { id: 'probe', name: 'Probe User', email: 'probe@rocketship.dev' },
        session: { id: 'probe', token: 'probe', expiresAt: new Date(Date.now() + 86400000).toISOString() },
      };
      localStorage.setItem('demo-session', JSON.stringify(session));
    }

    const runs: Array<{ label: string; violations: Violation[] }> = [];
    const fatal: Violation[] = [];

    for (const viewport of VIEWPORTS) {
      const label = `${name} @${viewport.width}`;
      const s = await measure(<AppAt path={path} />, label, viewport, pageReady);
      const violations = runRules(s);
      runs.push({ label, violations });
      fatal.push(...report(label, violations).enforced);
    }

    const unstable = compareAcrossViewports(runs);
    fatal.push(...report(`${name} across viewports`, unstable).enforced);

    expect(fatal, fatal.map((v) => `${v.rule} ${v.message}`).join('\n')).toEqual([]);
  });
});
