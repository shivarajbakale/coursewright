import type { Rule, Snapshot, SnapshotNode, Violation } from '../types';
import { ancestors, descendants, hint, visible } from '../tree';

/**
 * Module T — text bounds.
 *
 * Two rules with one subject: text that is not where it looks like it is. T1
 * catches text that has escaped its card. T2 catches text the browser has cut
 * off inside its own box — which is the more common defect here, and the one
 * that has shipped three times.
 *
 * T1: every text-bearing element must stay inside its enclosing card's
 * bounding box. This catches the bug where a page wraps an atom in a sibling div
 * and parks the secondary text there with a `-mt-2` to overlap the card
 * border — the rendered output looks fine in screenshots but the text's
 * measured box extends past the card's box (with no card chrome around
 * the hanging pixels).
 *
 * Skipped cases (the rule is conservative on purpose):
 *  - Decorative non-text elements (icons, separators, spacers).
 *  - Descendants of a `data-slot="scroll-area-viewport"` — those are
 *    allowed to overflow their scroll parent because the scroll parent
 *    clips them. The Cards that hold a ScrollArea are still bounded, so
 *    the user-visible overflow check still fires if the *Card* is the
 *    thing bleeding.
 *  - Elements with `data-probe-ignore="T1"` (or `"all"`) up the tree.
 *
 * Tolerance: 1px, to absorb sub-pixel rendering.
 */

const TOLERANCE = 1;

/** Node carries text the user can read. Empty / whitespace-only counts as no. */
function hasText(n: SnapshotNode): boolean {
  return n.text.trim().length > 0;
}

/** True if any ancestor is a scroll-area viewport (content is scrollable, allowed to overflow). */
function insideScrollableViewport(s: Snapshot, n: SnapshotNode): boolean {
  return ancestors(s, n).some((a) => a.data.slot === 'scroll-area-viewport');
}

function violation(
  rule: string,
  node: SnapshotNode,
  _card: SnapshotNode,
  detail: Violation['detail']
): Violation {
  return {
    rule,
    message: `text bleeds outside its enclosing card (${detail.direction} by ${detail.overflow}px)`,
    nodeId: node.id,
    selectorHint: hint(node),
    detail,
  };
}

export const T1: Rule = {
  id: 'T1',
  title: 'Text stays inside its enclosing card',
  check(s) {
    const out: Violation[] = [];
    for (const card of s.nodes) {
      if (card.data.slot !== 'card' || !visible(card)) continue;
      const cardBox = card.box;
      for (const desc of descendants(s, card)) {
        if (!visible(desc) || !hasText(desc)) continue;
        if (insideScrollableViewport(s, desc)) continue;
        if (ancestors(s, desc).some((a) => a.data.probeIgnore === 'all' || (a.data.probeIgnore ?? '').split(/\s+/).includes('T1'))) continue;

        const db = desc.box;
        // 1px tolerance on each side for sub-pixel rendering.
        const right = db.x + db.width - (cardBox.x + cardBox.width);
        const bottom = db.y + db.height - (cardBox.y + cardBox.height);
        const left = cardBox.x - db.x;
        const top = cardBox.y - db.y;

        if (right > TOLERANCE) {
          out.push(violation('T1', desc, card, {
            direction: 'right',
            overflow: Math.round(right),
            cardWidth: Math.round(cardBox.width),
            cardHeight: Math.round(cardBox.height),
          }));
        } else if (bottom > TOLERANCE) {
          out.push(violation('T1', desc, card, {
            direction: 'bottom',
            overflow: Math.round(bottom),
            cardWidth: Math.round(cardBox.width),
            cardHeight: Math.round(cardBox.height),
          }));
        } else if (left > TOLERANCE) {
          out.push(violation('T1', desc, card, {
            direction: 'left',
            overflow: Math.round(left),
            cardWidth: Math.round(cardBox.width),
            cardHeight: Math.round(cardBox.height),
          }));
        } else if (top > TOLERANCE) {
          out.push(violation('T1', desc, card, {
            direction: 'top',
            overflow: Math.round(top),
            cardWidth: Math.round(cardBox.width),
            cardHeight: Math.round(cardBox.height),
          }));
        }
      }
    }
    return out;
  },
};

/**
 * T2 — no element cuts off its own text.
 *
 * `scrollWidth > clientWidth` on something that does not scroll means the
 * browser had more text than the box and clipped it. The user sees a word that
 * ends early, or — worse — a *number* that ends early.
 *
 * This has shipped three times in this app, each time invisible to every other
 * gate, each time caught by a person looking at a screenshot:
 *
 *  - `Active 19` clipped to `Active 1`. Wrong rather than missing, which is the
 *    worse of the two.
 *  - `ENTERPRISE` clipped to `ENTE…`, because a table column was sized from its
 *    header rather than from its widest badge.
 *  - The Inbox filter counts squeezed to slivers inside `Badge` pills, which is
 *    what made that row look hand-rolled.
 *
 * `SegmentedControl` is the recurring culprit: its labels neither wrap nor push
 * the control wider, so the last thing in a label is the thing that vanishes,
 * and a count is always last. The theme answers it with `whiteSpace: nowrap`
 * on the label; this is the rule that notices when something else does not.
 *
 * Deliberately narrow, because the honest false positives are all scrollers:
 * anything that actually scrolls on that axis is skipped, as is anything inside
 * a scroll-area viewport.
 *
 * `text-overflow: ellipsis` is *mostly* skipped — an ellipsis is a designed
 * truncation with an affordance, not a silent cut. Mostly, because that
 * exemption shipped a defect of its own: Billing's interval toggle held a
 * `Badge` reading `−17%` inside a `SegmentedControl` label, the Badge was given
 * 8px for 25px of text, and what rendered was a dash. An ellipsis is an
 * affordance only while enough of the word survives to be worth abbreviating,
 * so an element that has lost more than half its content is judged like any
 * other clip.
 */
const CLIP_TOLERANCE = 2;
/** Past this share hidden, an ellipsis is not a truncation — it is a squeeze. */
const ELLIPSIS_SURVIVAL = 0.5;

export const T2: Rule = {
  id: 'T2',
  title: 'No element cuts off its own text',
  check(s) {
    const out: Violation[] = [];
    for (const n of s.nodes) {
      if (!visible(n) || !hasText(n)) continue;
      // A scroller is allowed to hold more than it shows; that is its job.
      if (n.style.overflowX === 'auto' || n.style.overflowX === 'scroll') continue;
      if (insideScrollableViewport(s, n)) continue;
      if (
        ancestors(s, n).some(
          (a) => a.data.probeIgnore === 'all' || (a.data.probeIgnore ?? '').split(/\s+/).includes('T2')
        )
      ) {
        continue;
      }

      const clipped = n.scrollWidth - n.clientWidth;
      if (clipped <= CLIP_TOLERANCE) continue;

      const survives = n.scrollWidth > 0 ? n.clientWidth / n.scrollWidth : 1;
      const squeezed = survives < ELLIPSIS_SURVIVAL;
      if (n.style.textOverflow === 'ellipsis' && !squeezed) continue;

      const how = squeezed && n.style.textOverflow === 'ellipsis'
        ? `has ${Math.round(survives * 100)}% of its text left after an ellipsis, which is a squeeze rather than a truncation`
        : `is cut off by ${Math.round(clipped)}px inside its own box — the reader sees a word, or a number, that ends early`;

      out.push({
        rule: 'T2',
        message: `"${n.text.trim().slice(0, 40)}" ${how}`,
        nodeId: n.id,
        selectorHint: hint(n),
        detail: {
          clippedPx: Math.round(clipped),
          scrollWidth: Math.round(n.scrollWidth),
          clientWidth: Math.round(n.clientWidth),
        },
      });
    }
    return out;
  },
};
