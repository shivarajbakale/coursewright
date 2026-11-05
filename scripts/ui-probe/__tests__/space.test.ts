import { describe, expect, it } from 'vitest';

import { A1, A2, A3, A4 } from '../rules/space';
import { makeSnapshot } from './factory';

describe('A1 — trailing dead space', () => {
  it('flags a panel that ends far below its last painted content', () => {
    // The Dashboard "Getting started" shape: 500px panel, ink stops at y=120.
    const s = makeSnapshot([
      { data: { panel: '' }, box: { x: 0, y: 0, width: 400, height: 500 } },
      { parent: 0, text: 'Getting started', box: { x: 0, y: 100, width: 400, height: 20 } },
    ]);
    const [v] = A1.check(s);
    expect(v.rule).toBe('A1');
    expect(v.detail.deadPx).toBe(380);
  });

  it('ignores a small gap even when the panel is short', () => {
    // 90px dead: over the 20% ratio but under the 96px floor. Both must trip.
    const s = makeSnapshot([
      { data: { panel: '' }, box: { x: 0, y: 0, width: 400, height: 200 } },
      { parent: 0, text: 'x', box: { x: 0, y: 100, width: 400, height: 10 } },
    ]);
    expect(A1.check(s)).toEqual([]);
  });

  it('ignores a big gap that is a small share of a tall panel', () => {
    // 100px dead in a 1000px panel: over the floor, under the 20% ratio.
    const s = makeSnapshot([
      { data: { panel: '' }, box: { x: 0, y: 0, width: 400, height: 1000 } },
      { parent: 0, text: 'x', box: { x: 0, y: 800, width: 400, height: 100 } },
    ]);
    expect(A1.check(s)).toEqual([]);
  });

  it('measures to the last element that paints, not the last that fits', () => {
    // A full-height, transparent, empty layout container must not count as ink.
    const s = makeSnapshot([
      { data: { panel: '' }, box: { x: 0, y: 0, width: 400, height: 500 } },
      { parent: 0, box: { x: 0, y: 0, width: 400, height: 500 } },
      { parent: 1, text: 'title', box: { x: 0, y: 0, width: 400, height: 20 } },
    ]);
    expect(A1.check(s)[0].detail.deadPx).toBe(480);
  });

  it('subtracts the panel padding before measuring', () => {
    const s = makeSnapshot([
      { data: { panel: '' }, box: { x: 0, y: 0, width: 400, height: 500 }, style: { paddingBottom: 24 } },
      { parent: 0, text: 'x', box: { x: 0, y: 0, width: 400, height: 20 } },
    ]);
    expect(A1.check(s)[0].detail.deadPx).toBe(456);
  });

  it('respects data-probe-ignore', () => {
    const s = makeSnapshot([
      { data: { panel: '', probeIgnore: 'A1' }, box: { x: 0, y: 0, width: 400, height: 500 } },
      { parent: 0, text: 'x', box: { x: 0, y: 0, width: 400, height: 20 } },
    ]);
    expect(A1.check(s)).toEqual([]);
  });
});

describe('A2 — scroll axes', () => {
  it('flags a pane that scrolls on both axes', () => {
    const s = makeSnapshot([
      {
        box: { x: 0, y: 0, width: 400, height: 300 },
        clientWidth: 400,
        clientHeight: 300,
        scrollWidth: 700,
        scrollHeight: 900,
        style: { overflowX: 'auto', overflowY: 'auto' },
      },
    ]);
    const [v] = A2.check(s);
    expect(v.rule).toBe('A2');
    expect(v.detail.axes).toBe('YX');
  });

  it('flags horizontal scroll that was never opted into', () => {
    const s = makeSnapshot([
      {
        box: { x: 0, y: 0, width: 400, height: 300 },
        clientWidth: 400,
        clientHeight: 300,
        scrollWidth: 700,
        scrollHeight: 300,
        style: { overflowX: 'auto' },
      },
    ]);
    expect(A2.check(s)[0].detail.axes).toBe('X');
  });

  it('allows horizontal scroll that declared itself', () => {
    const s = makeSnapshot([
      {
        data: { scrollX: 'allow' },
        box: { x: 0, y: 0, width: 400, height: 300 },
        clientWidth: 400,
        clientHeight: 300,
        scrollWidth: 700,
        scrollHeight: 300,
        style: { overflowX: 'auto' },
      },
    ]);
    expect(A2.check(s)).toEqual([]);
  });

  it('leaves a single vertical scroller alone — that is the intended shape', () => {
    const s = makeSnapshot([
      {
        box: { x: 0, y: 0, width: 400, height: 300 },
        clientWidth: 400,
        clientHeight: 300,
        scrollWidth: 400,
        scrollHeight: 900,
        style: { overflowY: 'auto' },
      },
    ]);
    expect(A2.check(s)).toEqual([]);
  });
});

describe('A3 — clipped text', () => {
  it('flags text cut off with no ellipsis', () => {
    const s = makeSnapshot([
      { text: '86%', clientWidth: 40, scrollWidth: 96, box: { x: 757, y: 200, width: 40, height: 16 } },
    ]);
    const [v] = A3.check(s);
    expect(v.rule).toBe('A3');
    expect(v.detail.overflowPx).toBe(56);
  });

  it('accepts a deliberate ellipsis', () => {
    const s = makeSnapshot([
      { text: 'long', clientWidth: 40, scrollWidth: 96, style: { textOverflow: 'ellipsis' } },
    ]);
    expect(A3.check(s)).toEqual([]);
  });

  it('ignores an inline element, which reports clientWidth 0 and would always trip', () => {
    const s = makeSnapshot([{ tag: 'span', text: 'inline', clientWidth: 0, scrollWidth: 0 }]);
    expect(A3.check(s)).toEqual([]);
  });

  it('leaves a declared horizontal scroller to A2', () => {
    const s = makeSnapshot([
      { text: 'wide', clientWidth: 40, scrollWidth: 96, data: { scrollX: 'allow' } },
    ]);
    expect(A3.check(s)).toEqual([]);
  });
});

describe('A4 — page-level scroll', () => {
  it('flags a document that scrolls', () => {
    const s = makeSnapshot([{}], {
      scroll: { scrollWidth: 1440, clientWidth: 1440, scrollHeight: 1400, clientHeight: 900 },
    });
    expect(A4.check(s)[0].detail.overflowPx).toBe(500);
  });

  it('passes a fixed viewport', () => {
    expect(A4.check(makeSnapshot([{}]))).toEqual([]);
  });
});
