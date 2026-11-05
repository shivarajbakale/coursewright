import { describe, expect, it } from 'vitest';

import { C1, C2, C3, C4, C5, C6, C7 } from '../rules/hierarchy';
import { makeSnapshot, type NodeSpec } from './factory';

const text = (over: NodeSpec): NodeSpec => ({ text: 'x', ...over });

describe('C1 — scale census', () => {
  it('accepts five distinct size/weight pairs', () => {
    const s = makeSnapshot([12, 14, 16, 20, 24].map((fontSize) => text({ style: { fontSize } })));
    expect(C1.check(s)).toEqual([]);
  });

  it('flags a sixth', () => {
    const s = makeSnapshot([11, 12, 13, 14, 16, 20].map((fontSize) => text({ style: { fontSize } })));
    expect(C1.check(s)[0].detail.pairs).toBe(6);
  });

  it('counts size and weight together', () => {
    const s = makeSnapshot([
      text({ style: { fontSize: 16, fontWeight: 400 } }),
      text({ style: { fontSize: 16, fontWeight: 600 } }),
    ]);
    expect(C1.check(s)).toEqual([]);
  });
});

describe('C2 — rank correlation', () => {
  it('flags a body element rendering heavier than the h1 above it', () => {
    // The confirmed inversion: h1 at text-xl/600 vs a KPI value at text-2xl/600.
    const s = makeSnapshot([
      text({ tag: 'h1', text: 'Dashboard', style: { fontSize: 20, fontWeight: 600 } }),
      text({ tag: 'span', text: '1,284', style: { fontSize: 24, fontWeight: 600 } }),
    ]);
    const [v] = C2.check(s);
    expect(v.rule).toBe('C2');
    expect(v.detail.heavier).toBe('span');
  });

  it('accepts a title that outranks its body', () => {
    const s = makeSnapshot([
      text({ tag: 'h1', style: { fontSize: 28, fontWeight: 600 } }),
      text({ tag: 'h2', style: { fontSize: 20, fontWeight: 600 } }),
      text({ tag: 'span', style: { fontSize: 14, fontWeight: 400 } }),
    ]);
    expect(C2.check(s)).toEqual([]);
  });

  it('weighs boldness, not just size', () => {
    const s = makeSnapshot([
      text({ tag: 'h1', style: { fontSize: 20, fontWeight: 400 } }),
      text({ tag: 'p', style: { fontSize: 20, fontWeight: 700 } }),
    ]);
    expect(C2.check(s)).toHaveLength(1);
  });
});

describe('C3 — one dominant element', () => {
  it('accepts a single largest element', () => {
    const s = makeSnapshot([
      text({ style: { fontSize: 28 } }),
      text({ style: { fontSize: 16 } }),
      text({ style: { fontSize: 16 } }),
    ]);
    expect(C3.check(s)).toEqual([]);
  });

  it('flags four tiles tying for the top tier — no entry point for the eye', () => {
    const s = makeSnapshot([
      text({ style: { fontSize: 20 } }),
      ...Array.from({ length: 4 }, () => text({ style: { fontSize: 24 } })),
    ]);
    expect(C3.check(s)[0].detail.atTopTier).toBe(4);
  });
});

describe('C4 — contrast ladder', () => {
  const onDark = (color: string): NodeSpec =>
    text({ style: { color, backgroundColor: 'rgb(0, 0, 0)' } });

  it('accepts three clearly separated levels', () => {
    const s = makeSnapshot([
      onDark('rgb(255, 255, 255)'),
      onDark('rgb(160, 160, 160)'),
      onDark('rgb(90, 90, 90)'),
    ]);
    expect(C4.check(s)).toEqual([]);
  });

  it('flags a page rendered at one alpha', () => {
    const s = makeSnapshot([onDark('rgb(255, 255, 255)'), onDark('rgb(255, 255, 255)')]);
    expect(C4.check(s)[0].detail.levels).toBe(1);
  });

  it('does not count two colours that resolve to the same contrast as two levels', () => {
    const s = makeSnapshot([
      onDark('rgb(255, 255, 255)'),
      onDark('rgb(254, 254, 254)'),
      onDark('rgb(253, 253, 253)'),
    ]);
    expect(C4.check(s)[0].detail.levels).toBe(1);
  });
});

describe('C5 — primary-action uniqueness', () => {
  // Mantine's vocabulary: `filled` is the accented call to action, `default` is
  // the neutral button beside it. The kit this app migrated from used those two
  // words the other way round, which is why the rule and these tests both name
  // the variant explicitly rather than relying on "the default one".
  it('flags two filled buttons in one panel', () => {
    const s = makeSnapshot([
      { data: { panel: '' } },
      { parent: 0, tag: 'button', text: 'Save', data: { variant: 'filled' } },
      { parent: 0, tag: 'button', text: 'Publish', data: { variant: 'filled' } },
    ]);
    expect(C5.check(s)[0].detail.primaries).toBe(2);
  });

  it('accepts one primary beside any number of secondaries', () => {
    const s = makeSnapshot([
      { data: { panel: '' } },
      { parent: 0, tag: 'button', text: 'Save', data: { variant: 'filled' } },
      { parent: 0, tag: 'button', text: 'Cancel', data: { variant: 'subtle' } },
      { parent: 0, tag: 'button', text: 'Reset', data: { variant: 'outline' } },
    ]);
    expect(C5.check(s)).toEqual([]);
  });

  it('does not count a pair of neutral buttons as two primaries', () => {
    // A stepper — minus and plus — is two `default` buttons in one panel and
    // has exactly no primaries in it. The pre-migration rule failed this.
    const s = makeSnapshot([
      { data: { panel: '' } },
      { parent: 0, tag: 'button', text: 'Seat', data: { variant: 'default' } },
      { parent: 0, tag: 'button', text: 'Seat', data: { variant: 'default' } },
    ]);
    expect(C5.check(s)).toEqual([]);
  });

  it('scopes each button to its nearest panel', () => {
    const s = makeSnapshot([
      { data: { panel: '' } },
      { parent: 0, tag: 'button', text: 'Save', data: { variant: 'filled' } },
      { parent: 0, data: { panel: '' } },
      { parent: 2, tag: 'button', text: 'Add', data: { variant: 'filled' } },
    ]);
    expect(C5.check(s)).toEqual([]);
  });
});

describe('C6 — proximity', () => {
  const stack = (gap: number, pad: number) =>
    makeSnapshot([
      { box: { x: 0, y: 0, width: 400, height: 400 } },
      ...[0, 1, 2].map((i) => ({
        parent: 0,
        text: `card ${i}`,
        style: { paddingTop: pad, paddingBottom: pad },
        box: { x: 0, y: i * (100 + gap), width: 400, height: 100 },
      })),
    ]);

  it('accepts a gap larger than the padding inside each item', () => {
    expect(C6.check(stack(24, 16))).toEqual([]);
  });

  it('flags a gap equal to the padding — nothing groups, the page reads flat', () => {
    const [v] = C6.check(stack(16, 16));
    expect(v.rule).toBe('C6');
    expect(v.detail.gapPx).toBe(16);
    expect(v.detail.padPx).toBe(16);
  });

  it('ignores containers with fewer than three children', () => {
    const s = makeSnapshot([
      { box: { x: 0, y: 0, width: 400, height: 200 } },
      { parent: 0, text: 'a', style: { paddingTop: 16 }, box: { x: 0, y: 0, width: 400, height: 100 } },
      { parent: 0, text: 'b', style: { paddingTop: 16 }, box: { x: 0, y: 100, width: 400, height: 100 } },
    ]);
    expect(C6.check(s)).toEqual([]);
  });

  it('respects data-probe-ignore', () => {
    const s = stack(16, 16);
    s.nodes[0].data.probeIgnore = 'C6';
    expect(C6.check(s)).toEqual([]);
  });
});

describe('C7 — a raised surface is visible against its ground', () => {
  const PAGE = 'oklch(0.165 0.004 285)';
  const SURFACE = 'oklch(0.2 0.004 285)';

  /** A page, and one Mantine surface sitting on it. */
  const on = (background: string, over: NodeSpec = {}): ReturnType<typeof makeSnapshot> =>
    makeSnapshot([
      { style: { backgroundColor: PAGE }, box: { width: 1440, height: 900 } },
      {
        parent: 0,
        mantine: 'SegmentedControl-root',
        style: { backgroundColor: background },
        ...over,
      },
    ]);

  it('flags a control painted the same colour as the page', () => {
    // The reported defect: the theme moved `--mantine-color-body` onto the
    // index Mantine grounds its controls on, and the track vanished.
    const out = C7.check(on(PAGE));
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe('C7');
    expect(out[0].detail.part).toBe('SegmentedControl-root');
  });

  it('accepts a control one elevation step above the page', () => {
    expect(C7.check(on(SURFACE))).toEqual([]);
  });

  it('accepts a flush surface that carries a border instead', () => {
    // An AppShell header is deliberately flush and divided by a rule. Failing
    // that would be measuring a style preference rather than a defect.
    expect(C7.check(on(PAGE, { style: { backgroundColor: PAGE, borderBottomWidth: 1 } }))).toEqual([]);
  });

  it('ignores a surface it has no opinion about', () => {
    const s = makeSnapshot([
      { style: { backgroundColor: PAGE }, box: { width: 1440, height: 900 } },
      { parent: 0, mantine: 'Group-root', style: { backgroundColor: PAGE } },
    ]);
    expect(C7.check(s)).toEqual([]);
  });

  it('ignores an element Mantine did not render', () => {
    const s = makeSnapshot([
      { style: { backgroundColor: PAGE }, box: { width: 1440, height: 900 } },
      { parent: 0, style: { backgroundColor: PAGE } },
    ]);
    expect(C7.check(s)).toEqual([]);
  });

  it('ignores a transparent surface, which is not claiming to be raised', () => {
    expect(C7.check(on('rgba(0, 0, 0, 0)'))).toEqual([]);
  });

  it('reads the ground through a transparent wrapper', () => {
    // The control's parent is usually a Group with no background of its own.
    const s = makeSnapshot([
      { style: { backgroundColor: PAGE }, box: { width: 1440, height: 900 } },
      { parent: 0, mantine: 'Group-root' },
      { parent: 1, mantine: 'SegmentedControl-root', style: { backgroundColor: PAGE } },
    ]);
    expect(C7.check(s)).toHaveLength(1);
  });

  it('treats a two-channel difference as the same colour', () => {
    const s = makeSnapshot([
      { style: { backgroundColor: 'rgb(20, 20, 20)' }, box: { width: 1440, height: 900 } },
      { parent: 0, mantine: 'SegmentedControl-root', style: { backgroundColor: 'rgb(22, 22, 22)' } },
    ]);
    expect(C7.check(s)).toHaveLength(1);
  });

  it('respects data-probe-ignore', () => {
    const s = on(PAGE);
    s.nodes[1].data.probeIgnore = 'C7';
    expect(C7.check(s)).toEqual([]);
  });
});
