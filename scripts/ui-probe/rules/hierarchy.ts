import { contrastRatio, parseRgb } from '../color';
import type { Rule, Snapshot, SnapshotNode, Violation } from '../types';
import { ancestors, childrenOf, effectiveBackground, hint, ignoredBy, paints, visible } from '../tree';

/**
 * Module C — information hierarchy.
 *
 * These rules catch a hierarchy that is absent or inverted. They do not judge
 * whether the hierarchy is the *right* one for the product — that is the
 * evaluator's job and the human's, and pretending otherwise would make the
 * probe an opinion generator instead of a measurement.
 */

const MAX_SCALE_PAIRS = 5;
const MIN_CONTRAST_LEVELS = 3;
/** Two contrast ratios closer than this read as the same level on screen. */
const CONTRAST_STEP = 0.5;

const RANK: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const BODY_RANK = 7;

function textNodes(s: Snapshot): SnapshotNode[] {
  return s.nodes.filter((n) => n.text.length > 0 && visible(n));
}

function weightOf(n: SnapshotNode): number {
  return n.style.fontSize * (n.style.fontWeight / 400);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function violation(
  rule: string,
  node: SnapshotNode | null,
  message: string,
  detail: Violation['detail'] = {}
): Violation {
  return { rule, message, nodeId: node?.id ?? null, selectorHint: node ? hint(node) : 'view', detail };
}

export const C1: Rule = {
  id: 'C1',
  title: 'Type scale census',
  check(s) {
    const pairs = new Set(
      textNodes(s)
        .filter((n) => !ignoredBy(s, n, 'C1'))
        .map((n) => `${Math.round(n.style.fontSize)}/${n.style.fontWeight}`)
    );
    if (pairs.size <= MAX_SCALE_PAIRS) return [];
    return [
      violation(
        'C1',
        null,
        `${pairs.size} distinct font-size x font-weight pairs in one view; more than ${MAX_SCALE_PAIRS} reads as noise`,
        { pairs: pairs.size, found: [...pairs].sort().join(' ') }
      ),
    ];
  },
};

export const C2: Rule = {
  id: 'C2',
  title: 'Visual weight tracks semantic rank',
  check(s) {
    const heaviest = new Map<number, SnapshotNode>();
    for (const node of textNodes(s)) {
      if (ignoredBy(s, node, 'C2')) continue;
      const rank = RANK[node.tag] ?? BODY_RANK;
      const current = heaviest.get(rank);
      if (!current || weightOf(node) > weightOf(current)) heaviest.set(rank, node);
    }

    const ranks = [...heaviest.keys()].sort((a, b) => a - b);
    const out: Violation[] = [];
    for (let i = 0; i < ranks.length - 1; i++) {
      const higher = heaviest.get(ranks[i]) as SnapshotNode;
      const lower = heaviest.get(ranks[i + 1]) as SnapshotNode;
      if (weightOf(lower) <= weightOf(higher)) continue;

      out.push(
        violation(
          'C2',
          lower,
          `<${lower.tag}> "${lower.text.slice(0, 24)}" renders heavier than <${higher.tag}> "${higher.text.slice(0, 24)}", which outranks it`,
          {
            heavier: lower.tag,
            heavierWeight: weightOf(lower),
            outranks: higher.tag,
            outranksWeight: weightOf(higher),
          }
        )
      );
    }
    return out;
  },
};

export const C3: Rule = {
  id: 'C3',
  title: 'Exactly one dominant element',
  check(s) {
    const nodes = textNodes(s).filter((n) => !ignoredBy(s, n, 'C3'));
    if (nodes.length === 0) return [];

    const top = Math.max(...nodes.map((n) => n.style.fontSize));
    const atTop = nodes.filter((n) => n.style.fontSize === top);
    if (atTop.length === 1) return [];

    return [
      violation(
        'C3',
        atTop[0],
        `${atTop.length} elements tie for the largest type in this view; the eye needs one entry point`,
        { atTopTier: atTop.length, fontSize: top }
      ),
    ];
  },
};

export const C4: Rule = {
  id: 'C4',
  title: 'Contrast ladder',
  check(s) {
    const ratios: number[] = [];
    for (const node of textNodes(s)) {
      if (ignoredBy(s, node, 'C4')) continue;
      const fg = parseRgb(node.style.color);
      const bg = parseRgb(effectiveBackground(s, node));
      if (!fg || !bg) continue;
      ratios.push(contrastRatio(fg, bg));
    }
    if (ratios.length === 0) return [];

    // Collapse ratios that are too close together to read as separate levels.
    const levels: number[] = [];
    for (const ratio of [...ratios].sort((a, b) => a - b)) {
      if (levels.length === 0 || ratio - levels[levels.length - 1] >= CONTRAST_STEP) levels.push(ratio);
    }
    if (levels.length >= MIN_CONTRAST_LEVELS) return [];

    return [
      violation(
        'C4',
        null,
        `only ${levels.length} distinct text-contrast level(s); a page at one alpha is flat by construction`,
        { levels: levels.length, ratios: levels.map((r) => Math.round(r * 10) / 10).join(', ') }
      ),
    ];
  },
};

/**
 * The variant Mantine paints as the primary action.
 *
 * `filled`, not `default` — and the difference is a migration trap worth
 * naming. Under the kit this app used to ship, `variant="default"` *was* the
 * primary button and everything else was a secondary. Under Mantine the words
 * swap: `filled` is the accented call to action and `default` is the neutral
 * one beside it. This rule kept the old string through the migration, which
 * left it flagging pairs of *secondary* buttons while it could never see two
 * real primaries — the exact failure it exists to catch.
 */
const PRIMARY_VARIANT = 'filled';

export const C5: Rule = {
  id: 'C5',
  title: 'Primary-action uniqueness',
  check(s) {
    const byPanel = new Map<number, SnapshotNode[]>();
    for (const node of s.nodes) {
      if (!visible(node) || ignoredBy(s, node, 'C5')) continue;
      if (node.data.variant !== PRIMARY_VARIANT) continue;
      if (node.tag !== 'button' && node.role !== 'button') continue;

      const panel = ancestors(s, node).find((a) => a.data.panel !== undefined);
      if (!panel) continue;
      byPanel.set(panel.id, [...(byPanel.get(panel.id) ?? []), node]);
    }

    const out: Violation[] = [];
    for (const [panelId, buttons] of byPanel) {
      if (buttons.length <= 1) continue;
      out.push(
        violation(
          'C5',
          s.nodes[panelId],
          `${buttons.length} primary buttons in one panel (${buttons.map((b) => `"${b.text}"`).join(', ')}); two primaries means no primary`,
          { primaries: buttons.length }
        )
      );
    }
    return out;
  },
};

export const C6: Rule = {
  id: 'C6',
  title: 'Proximity — grouping beats decoration',
  check(s) {
    const out: Violation[] = [];

    for (const container of s.nodes) {
      if (!visible(container) || ignoredBy(s, container, 'C6')) continue;

      const children = childrenOf(s, container).filter((c) => visible(c) && paints(c));
      if (children.length < 3) continue;

      const vertical =
        Math.max(...children.map((c) => c.box.y)) - Math.min(...children.map((c) => c.box.y)) >
        Math.max(...children.map((c) => c.box.x)) - Math.min(...children.map((c) => c.box.x));

      const start = (c: SnapshotNode) => (vertical ? c.box.y : c.box.x);
      const size = (c: SnapshotNode) => (vertical ? c.box.height : c.box.width);
      const pad = (c: SnapshotNode) =>
        vertical
          ? Math.max(c.style.paddingTop, c.style.paddingBottom)
          : Math.max(c.style.paddingLeft, c.style.paddingRight);

      const ordered = [...children].sort((a, b) => start(a) - start(b));
      const gaps: number[] = [];
      for (let i = 0; i < ordered.length - 1; i++) {
        gaps.push(start(ordered[i + 1]) - (start(ordered[i]) + size(ordered[i])));
      }
      if (gaps.length === 0) continue;

      const minGap = Math.min(...gaps);
      const padding = median(children.map(pad));
      if (padding <= 0 || minGap > padding) continue;

      out.push(
        violation(
          'C6',
          container,
          `items are ${Math.round(minGap)}px apart but padded ${Math.round(padding)}px inside; nothing groups when the gap does not beat the padding`,
          { gapPx: minGap, padPx: padding, items: children.length }
        )
      );
    }
    return out;
  },
};

/**
 * C7 — a raised surface must be visible against its ground.
 *
 * Mantine grounds its dark-mode surfaces on `dark[8]`: a `SegmentedControl`
 * track, a chart tooltip, a dropdown. That index is one step *below* the page
 * in a stock theme, so the control reads as a control. This app's theme moves
 * `--mantine-color-body` down to `dark[8]` so a Card can sit above the page —
 * and every Mantine surface built on that index silently landed at exactly the
 * page colour.
 *
 * Nothing was broken in a way the other gates could see. The markup was right,
 * the component was the standard one, the contrast of the *text* was fine. The
 * control just had no ground under it, so it read as loose text with hairlines
 * between the words — which is what a reader calls hand-rolled, and is the
 * report that produced this rule.
 *
 * A surface may earn its separation two ways, and either passes: a background
 * that differs from its ground, or a border. That second clause is not a
 * loophole — an `AppShell` header is deliberately flush with the page and
 * divided by a rule, and a gate that failed it would be measuring a style
 * preference rather than a defect.
 *
 * The list is the surfaces Mantine paints *on top of* a page. A Card is not on
 * it: `Paper` and `Card` take their colour from this app's own `--app-surface`
 * and are covered by the theme rather than by a rule.
 */
const RAISED_SURFACES = new Set([
  'SegmentedControl-root',
  'ChartTooltip-tooltip',
  'Tooltip-tooltip',
  'Menu-dropdown',
  'Popover-dropdown',
  'HoverCard-dropdown',
  'Modal-content',
  'Drawer-content',
  'Notification-root',
  'Code-root',
]);

/** Same colour to the eye. Two channels of rounding is not a design decision. */
const SURFACE_DELTA = 3;

function borderedAnywhere(n: SnapshotNode): boolean {
  const s = n.style;
  return (
    s.borderTopWidth > 0 ||
    s.borderRightWidth > 0 ||
    s.borderBottomWidth > 0 ||
    s.borderLeftWidth > 0
  );
}

export const C7: Rule = {
  id: 'C7',
  title: 'A raised surface is visible against its ground',
  check(s) {
    const out: Violation[] = [];

    for (const n of s.nodes) {
      if (n.mantine === null || !RAISED_SURFACES.has(n.mantine)) continue;
      if (!visible(n) || ignoredBy(s, n, 'C7')) continue;
      if (borderedAnywhere(n)) continue;

      const parent = n.parent === null ? null : s.nodes[n.parent];
      const groundCss = parent === null ? null : effectiveBackground(s, parent);
      if (groundCss === null) continue;

      const surface = parseRgb(n.style.backgroundColor);
      const ground = parseRgb(groundCss);
      if (!surface || !ground) continue;
      // A transparent surface is not claiming to be raised in the first place.
      if (surface[3] === 0) continue;

      const delta = Math.max(
        Math.abs(surface[0] - ground[0]),
        Math.abs(surface[1] - ground[1]),
        Math.abs(surface[2] - ground[2])
      );
      if (delta > SURFACE_DELTA) continue;

      out.push(
        violation(
          'C7',
          n,
          `${n.mantine} is the same colour as the page behind it and has no border; a control with no ground under it reads as loose text`,
          { part: n.mantine, surface: n.style.backgroundColor, ground: groundCss, delta: Math.round(delta) }
        )
      );
    }

    return out;
  },
};
