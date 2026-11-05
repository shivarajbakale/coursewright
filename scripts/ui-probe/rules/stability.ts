import type { Violation } from '../types';

export interface ViewportRun {
  label: string;
  violations: Violation[];
}

/**
 * Rule A5 — a rule that passes at one width and fails at another is a failure.
 *
 * This is the only rule that is not a function of a single snapshot, so it does
 * not implement `Rule`. A rule failing at *every* width is that rule doing its
 * job and is already reported; the instability is the in-between case — the
 * measured 1 / 1 / 0 scroller count on Customers across 1280 / 1440 / 1920.
 */
export function compareAcrossViewports(runs: ViewportRun[]): Violation[] {
  if (runs.length < 2) return [];

  const rulesIn = (run: ViewportRun) => new Set(run.violations.map((v) => v.rule));
  const seen = new Set(runs.flatMap((run) => [...rulesIn(run)]));

  const out: Violation[] = [];
  for (const rule of [...seen].sort()) {
    const failing = runs.filter((run) => rulesIn(run).has(rule)).map((run) => run.label);
    if (failing.length === runs.length) continue;

    out.push({
      rule: 'A5',
      message: `${rule} fails at some viewport widths but not others — the layout changes shape`,
      nodeId: null,
      selectorHint: `rule ${rule}`,
      detail: { failingAt: failing.join(', '), across: runs.map((run) => run.label).join(', ') },
    });
  }
  return out;
}
