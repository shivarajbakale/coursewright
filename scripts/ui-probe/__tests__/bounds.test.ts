import { describe, expect, it } from 'vitest';

import { T1, T2 } from '../rules/bounds';
import { makeSnapshot } from './factory';

/**
 * T1 — text stays inside its enclosing card.
 *
 * Catches the bug where a wrapper puts text outside the Card atom (e.g.
 * `<p className="-mt-2 px-1">` parked between the Card and the next grid
 * row). The screenshot looks fine because the negative margin overlaps the
 * card's bottom border by a few pixels, but the text's measured box extends
 * past the card's box — with no card chrome around the hanging pixels.
 */
describe('T1 — text stays inside its enclosing card', () => {
  it('flags a text node that extends past the card bottom edge (the bug)', () => {
    // Reproduces the StatCardWithSub regression: Card at y=0-92, sub text
    // rendered at y=92 (just outside the card) — `-mt-2` overlapped the
    // card by 4px but the text box itself is OUTSIDE the card.
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 200, height: 92 } },
      { parent: 0, text: '6 active · 1 invited', box: { x: 8, y: 88, width: 184, height: 16 } },
    ]);
    const [v] = T1.check(s);
    expect(v.rule).toBe('T1');
    expect(v.detail.direction).toBe('bottom');
    expect(v.detail.overflow).toBe(12); // 88+16 - 92 = 12
  });

  it('flags text that extends past the card right edge', () => {
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 200, height: 200 } },
      { parent: 0, text: 'long email that overflows', box: { x: 0, y: 0, width: 250, height: 16 } },
    ]);
    const [v] = T1.check(s);
    expect(v.rule).toBe('T1');
    expect(v.detail.direction).toBe('right');
    expect(v.detail.overflow).toBe(50);
  });

  it('passes when all text fits inside the card (the fix)', () => {
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 200, height: 200 } },
      { parent: 0, text: 'Value', box: { x: 8, y: 8, width: 100, height: 16 } },
      { parent: 0, text: 'Sub caption', box: { x: 8, y: 80, width: 184, height: 16 } },
    ]);
    expect(T1.check(s)).toEqual([]);
  });

  it('allows 1px tolerance on every edge', () => {
    // 200px-wide card, text extends to 201 (1px past) — still clean.
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 200, height: 200 } },
      { parent: 0, text: 'edge of card', box: { x: 0, y: 0, width: 201, height: 16 } },
    ]);
    expect(T1.check(s)).toEqual([]);
  });

  it('ignores descendants of a scroll-area viewport (tables, code blocks)', () => {
    // ScrollArea's viewport clips its children; they can legitimately exceed
    // the parent card horizontally. The Card around the ScrollArea is still
    // bounded by T1, so the user-visible chrome is still checked.
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 200, height: 200 } },
      {
        parent: 0,
        data: { slot: 'scroll-area-viewport' },
        tag: 'div',
        box: { x: 0, y: 0, width: 200, height: 200 },
      },
      {
        parent: 1,
        text: 'very long table row that scrolls horizontally',
        box: { x: 0, y: 0, width: 800, height: 16 },
      },
    ]);
    expect(T1.check(s)).toEqual([]);
  });

  it('ignores decorative elements that carry no text', () => {
    // An icon div with no text is not the user's data — let it overflow.
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 100, height: 100 } },
      { parent: 0, tag: 'svg', text: '', box: { x: -10, y: -10, width: 200, height: 200 } },
    ]);
    expect(T1.check(s)).toEqual([]);
  });

  it('honors data-probe-ignore="T1" up the tree', () => {
    // A card that opts out (e.g. special-case animated entry) is exempt.
    const s = makeSnapshot([
      {
        data: { slot: 'card', probeIgnore: 'T1' },
        box: { x: 0, y: 0, width: 100, height: 100 },
      },
      { parent: 0, text: 'overflowing on purpose', box: { x: 0, y: 200, width: 100, height: 16 } },
    ]);
    expect(T1.check(s)).toEqual([]);
  });

  it('flags ALL overflowing descendants in one card, not just the first', () => {
    // A card with two bleeders should produce two violations.
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 100, height: 100 } },
      { parent: 0, text: 'overflow right', box: { x: 90, y: 10, width: 200, height: 16 } },
      { parent: 0, text: 'overflow bottom', box: { x: 10, y: 90, width: 80, height: 50 } },
    ]);
    const violations = T1.check(s);
    expect(violations.length).toBe(2);
    expect(violations.map((v) => v.detail.direction).sort()).toEqual(['bottom', 'right']);
  });

  it('checks every card in a multi-card snapshot', () => {
    // Two cards on the page, one clean and one bleeder.
    const s = makeSnapshot([
      { data: { slot: 'card' }, box: { x: 0, y: 0, width: 100, height: 100 } },
      { parent: 0, text: 'clean', box: { x: 10, y: 10, width: 80, height: 16 } },
      { data: { slot: 'card' }, box: { x: 200, y: 0, width: 100, height: 100 } },
      { parent: 2, text: 'bleeder', box: { x: 210, y: 110, width: 80, height: 16 } },
    ]);
    const violations = T1.check(s);
    expect(violations.length).toBe(1);
    expect(violations[0].nodeId).toBe(3);
  });
});

describe('T2 — an ellipsis is an affordance only while the word survives', () => {
  it('still exempts an ordinary truncation', () => {
    // A long customer name in a fixed column, ending in a visible ellipsis.
    const s = makeSnapshot([
      {
        text: 'Northwind Trading Company Ltd',
        style: { textOverflow: 'ellipsis', overflowX: 'hidden' },
        clientWidth: 180,
        scrollWidth: 240,
      },
    ]);
    expect(T2.check(s)).toEqual([]);
  });

  it('flags an element that has lost more than half its text', () => {
    // Billing's interval toggle: a Badge reading "−17%" given 8px for 25px of
    // text, which rendered as a dash and passed every gate in the repo.
    const s = makeSnapshot([
      {
        text: '−17%',
        style: { textOverflow: 'ellipsis', overflowX: 'hidden' },
        clientWidth: 8,
        scrollWidth: 25,
      },
    ]);
    const out = T2.check(s);
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain('squeeze rather than a truncation');
    expect(out[0].detail.clientWidth).toBe(8);
  });

  it('reads exactly half as a truncation, not a squeeze', () => {
    const s = makeSnapshot([
      {
        text: 'Enterprise',
        style: { textOverflow: 'ellipsis', overflowX: 'hidden' },
        clientWidth: 100,
        scrollWidth: 200,
      },
    ]);
    expect(T2.check(s)).toEqual([]);
  });
});
