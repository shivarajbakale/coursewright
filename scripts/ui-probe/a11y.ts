import type { AxeResults } from 'axe-core';

import type { Violation } from './types';

/**
 * Rule D4 — axe findings, as probe violations.
 *
 * `@storybook/addon-a11y` has been installed all along and gated on nothing.
 * Routing axe through the same report path as every other rule means heading
 * order, contrast, and label wiring get the same treatment: printed every run,
 * fatal the moment D4 joins ENFORCED.
 */
export function toViolations(results: AxeResults): Violation[] {
  return results.violations.flatMap((v) =>
    v.nodes.map((node) => ({
      rule: 'D4',
      message: `${v.id}: ${v.help}`,
      nodeId: null,
      selectorHint: String(node.target[0] ?? 'unknown'),
      detail: { impact: v.impact ?? 'unknown', axeRule: v.id, ...contrastOf(node) },
    }))
  );
}

/**
 * For a contrast finding, the two colours and the ratio axe measured. The
 * selector alone says *where*; without these the reader has to reproduce the
 * render to learn *what* — which pair failed, and by how much.
 */
function contrastOf(node: { any?: { data?: unknown }[] }): Record<string, string> {
  const data = node.any?.[0]?.data as
    | { fgColor?: string; bgColor?: string; contrastRatio?: number }
    | undefined;
  if (!data?.fgColor || !data.bgColor) return {};
  return {
    fg: data.fgColor,
    bg: data.bgColor,
    ratio: String(data.contrastRatio ?? ''),
  };
}
