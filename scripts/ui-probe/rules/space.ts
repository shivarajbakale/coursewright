import type { Rule, Snapshot, SnapshotNode, Violation } from '../types';
import { descendants, hint, ignoredBy, paints, visible } from '../tree';

/**
 * Module A — space and scroll.
 *
 * Every threshold here is a starting value from the design spec, chosen against
 * measurements taken on the running app at 1440x900. Each rule has an opt-out
 * (`data-probe-ignore`), and none is fatal until its id is listed in
 * probe.config.ts.
 */

/** 96px is roughly a card's worth of nothing — smaller gaps are breathing room. */
const DEAD_FLOOR_PX = 96;
/** ...and it only reads as a hole when it is also a fifth of the panel. */
const DEAD_RATIO = 0.2;

const SCROLLABLE = /^(auto|scroll)$/;

function panelsOf(s: Snapshot): SnapshotNode[] {
  return s.nodes.filter((n) => n.data.panel !== undefined && visible(n));
}

/**
 * Bottom edge of the lowest descendant that puts ink on screen.
 *
 * Not the lowest descendant that *fits*: a full-height transparent flex
 * container fits perfectly and paints nothing, and measuring against it reports
 * 100% fill for a panel that is visibly four-fifths empty.
 */
function inkBottom(s: Snapshot, panel: SnapshotNode): number | null {
  let bottom: number | null = null;
  for (const node of descendants(s, panel)) {
    if (!paints(node)) continue;
    const edge = node.box.y + node.box.height;
    if (bottom === null || edge > bottom) bottom = edge;
  }
  return bottom;
}

export const A1: Rule = {
  id: 'A1',
  title: 'Trailing dead space in a panel',
  check(s) {
    const out: Violation[] = [];
    for (const panel of panelsOf(s)) {
      if (ignoredBy(s, panel, 'A1')) continue;
      const ink = inkBottom(s, panel);
      if (ink === null) continue;

      const innerBottom =
        panel.box.y + panel.box.height - panel.style.paddingBottom - panel.style.borderBottomWidth;
      const dead = innerBottom - ink;
      const ratio = panel.box.height > 0 ? dead / panel.box.height : 0;

      if (dead > DEAD_FLOOR_PX && ratio > DEAD_RATIO) {
        out.push({
          rule: 'A1',
          message: `panel ends ${Math.round(dead)}px below its last painted content (${Math.round(
            ratio * 100
          )}% of its height)`,
          nodeId: panel.id,
          selectorHint: hint(panel),
          detail: { deadPx: dead, ratio, panelHeight: panel.box.height },
        });
      }
    }
    return out;
  },
};

function axesOf(n: SnapshotNode): string {
  let axes = '';
  if (SCROLLABLE.test(n.style.overflowY) && n.scrollHeight - n.clientHeight > 1) axes += 'Y';
  if (SCROLLABLE.test(n.style.overflowX) && n.scrollWidth - n.clientWidth > 1) axes += 'X';
  return axes;
}

export const A2: Rule = {
  id: 'A2',
  title: 'Scroll axes per pane',
  check(s) {
    const out: Violation[] = [];
    for (const node of s.nodes) {
      if (!visible(node) || ignoredBy(s, node, 'A2')) continue;
      const axes = axesOf(node);

      if (axes.length > 1) {
        out.push({
          rule: 'A2',
          message: 'pane scrolls on two axes at once — pick one',
          nodeId: node.id,
          selectorHint: hint(node),
          detail: { axes },
        });
      } else if (axes === 'X' && node.data.scrollX !== 'allow') {
        out.push({
          rule: 'A2',
          message: 'horizontal scroll without data-scroll-x="allow"',
          nodeId: node.id,
          selectorHint: hint(node),
          detail: { axes, overflowPx: node.scrollWidth - node.clientWidth },
        });
      }
    }
    return out;
  },
};

export const A3: Rule = {
  id: 'A3',
  title: 'Clipped text',
  check(s) {
    const out: Violation[] = [];
    for (const node of s.nodes) {
      if (!visible(node) || node.text.length === 0) continue;
      if (ignoredBy(s, node, 'A3') || node.data.scrollX === 'allow') continue;
      // Inline elements report clientWidth 0, which would make every one of
      // them look infinitely clipped. Only measurable boxes are checked.
      if (node.clientWidth === 0) continue;
      if (node.style.textOverflow === 'ellipsis') continue;
      if (SCROLLABLE.test(node.style.overflowX)) continue; // a scroller is A2's business

      const overflow = node.scrollWidth - node.clientWidth;
      if (overflow <= 1) continue;

      out.push({
        rule: 'A3',
        message: `text is cut off by ${Math.round(overflow)}px with no ellipsis`,
        nodeId: node.id,
        selectorHint: hint(node),
        detail: { overflowPx: overflow, text: node.text.slice(0, 40) },
      });
    }
    return out;
  },
};

export const A4: Rule = {
  id: 'A4',
  title: 'Page-level scroll',
  check(s) {
    const overflow = s.scroll.scrollHeight - s.scroll.clientHeight;
    if (overflow <= 1) return [];
    return [
      {
        rule: 'A4',
        message: `the document scrolls by ${Math.round(
          overflow
        )}px — the shell is a fixed viewport, pages scroll inside PageShell`,
        nodeId: null,
        selectorHint: 'document',
        detail: { overflowPx: overflow },
      },
    ];
  },
};
