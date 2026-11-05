import { describe, expect, it } from 'vitest';

import { B1, B2, B3, B4, B5, B6, B7, B8 } from '../rules/archetype';
import { makeSnapshot, type NodeSpec } from './factory';

const panel = (over: NodeSpec): NodeSpec => ({ data: { panel: '' }, ...over });

describe('B1 — list-detail', () => {
  it('flags a detail pane wider than its master', () => {
    // The measured inversion: master 476px, empty detail 660px.
    const s = makeSnapshot([
      { data: { archetype: 'list-detail' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      panel({ parent: 0, box: { x: 0, y: 0, width: 476, height: 700 } }),
      { parent: 0, role: 'separator', box: { x: 476, y: 0, width: 4, height: 700 } },
      panel({ parent: 0, box: { x: 480, y: 0, width: 660, height: 700 }, text: 'Nothing selected' }),
    ]);
    const messages = B1.check(s).map((v) => v.message);
    expect(messages.some((m) => m.includes('master pane'))).toBe(true);
  });

  it('accepts a master wider than the detail, with a handle and a non-blank detail', () => {
    const s = makeSnapshot([
      { data: { archetype: 'list-detail' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      panel({ parent: 0, box: { x: 0, y: 0, width: 700, height: 700 }, text: 'Billing v2' }),
      { parent: 0, role: 'separator', box: { x: 700, y: 0, width: 4, height: 700 } },
      panel({ parent: 0, box: { x: 704, y: 0, width: 456, height: 700 }, text: 'Nothing selected' }),
    ]);
    expect(B1.check(s)).toEqual([]);
  });

  it('flags a missing resize affordance', () => {
    const s = makeSnapshot([
      { data: { archetype: 'list-detail' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      panel({ parent: 0, box: { x: 0, y: 0, width: 700, height: 700 }, text: 'a' }),
      panel({ parent: 0, box: { x: 704, y: 0, width: 456, height: 700 }, text: 'b' }),
    ]);
    expect(B1.check(s).some((v) => v.message.includes('resize'))).toBe(true);
  });

  it('flags a blank detail pane — an empty state is content, not nothing', () => {
    const s = makeSnapshot([
      { data: { archetype: 'list-detail' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      panel({ parent: 0, box: { x: 0, y: 0, width: 700, height: 700 }, text: 'a' }),
      { parent: 0, role: 'separator', box: { x: 700, y: 0, width: 4, height: 700 } },
      panel({ parent: 0, box: { x: 704, y: 0, width: 456, height: 700 } }),
    ]);
    expect(B1.check(s).some((v) => v.message.includes('empty state'))).toBe(true);
  });

  it('flags anything other than two panes', () => {
    const s = makeSnapshot([
      { data: { archetype: 'list-detail' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      panel({ parent: 0, box: { x: 0, y: 0, width: 380, height: 700 }, text: 'a' }),
      panel({ parent: 0, box: { x: 390, y: 0, width: 380, height: 700 }, text: 'b' }),
      panel({ parent: 0, box: { x: 780, y: 0, width: 380, height: 700 }, text: 'c' }),
    ]);
    expect(B1.check(s).some((v) => v.message.includes('exactly two'))).toBe(true);
  });

  it('is silent on a different archetype', () => {
    expect(B1.check(makeSnapshot([{ data: { archetype: 'form' } }]))).toEqual([]);
  });
});

describe('B2 — dashboard-grid', () => {
  const kpiRow = (widths: number[]): NodeSpec[] => [
    { data: { archetype: 'dashboard-grid' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
    ...widths.map((w, i) =>
      panel({
        parent: 0,
        text: `kpi${i}`,
        box: { x: widths.slice(0, i).reduce((a, b) => a + b, 0), y: 0, width: w, height: 90 },
      })
    ),
  ];

  it('accepts a row of four equal tiles', () => {
    expect(B2.check(makeSnapshot(kpiRow([290, 290, 290, 290])))).toEqual([]);
  });

  it('flags a KPI row with more than four tiles', () => {
    const out = B2.check(makeSnapshot(kpiRow([232, 232, 232, 232, 232])));
    expect(out.some((v) => v.message.includes('2-4 tiles'))).toBe(true);
  });

  it('flags unequal tile widths', () => {
    const out = B2.check(makeSnapshot(kpiRow([400, 290, 290, 180])));
    expect(out.some((v) => v.message.includes('equal width'))).toBe(true);
  });

  it('flags a panel stretched to match a taller sibling', () => {
    const s = makeSnapshot([
      { data: { archetype: 'dashboard-grid' }, box: { x: 0, y: 0, width: 1160, height: 900 } },
      panel({ parent: 0, text: 'a', box: { x: 0, y: 0, width: 580, height: 90 } }),
      panel({ parent: 0, text: 'b', box: { x: 580, y: 0, width: 580, height: 90 } }),
      // Two 500px panels side by side; the right one only has 100px of ink.
      panel({ parent: 0, box: { x: 0, y: 100, width: 580, height: 500 } }),
      { parent: 3, text: 'chart', box: { x: 0, y: 100, width: 580, height: 480 } },
      panel({ parent: 0, box: { x: 580, y: 100, width: 580, height: 500 } }),
      { parent: 5, text: 'Getting started', box: { x: 580, y: 100, width: 580, height: 100 } },
    ]);
    expect(B2.check(s).some((v) => v.message.includes('stretched'))).toBe(true);
  });

  it('allows exactly one panel to absorb leftover height', () => {
    const s = makeSnapshot([
      { data: { archetype: 'dashboard-grid' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      panel({ parent: 0, text: 'a', data: { panel: '', fill: '' }, box: { x: 0, y: 0, width: 580, height: 90 } }),
      panel({ parent: 0, text: 'b', data: { panel: '', fill: '' }, box: { x: 580, y: 0, width: 580, height: 90 } }),
    ]);
    expect(B2.check(s).some((v) => v.message.includes('data-fill'))).toBe(true);
  });
});

describe('B3 — form', () => {
  const form = (over: NodeSpec = {}): ReturnType<typeof makeSnapshot> =>
    makeSnapshot([
      { data: { archetype: 'form' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      { parent: 0, tag: 'form', box: { x: 0, y: 0, width: 560, height: 400 }, ...over },
      { parent: 1, tag: 'label', text: 'Name', box: { x: 0, y: 0, width: 560, height: 16 } },
      { parent: 1, tag: 'input', box: { x: 0, y: 20, width: 560, height: 32 } },
      { parent: 1, tag: 'button', text: 'Save', box: { x: 0, y: 60, width: 100, height: 32 }, data: { submit: '' } },
    ]);

  it('accepts a single 560px column with a label above its control', () => {
    expect(B3.check(form())).toEqual([]);
  });

  it('flags a form wider than 640px', () => {
    const out = B3.check(form({ box: { x: 0, y: 0, width: 900, height: 400 } }));
    expect(out.some((v) => v.message.includes('640'))).toBe(true);
  });

  it('flags a label placed beside its control instead of above it', () => {
    const s = makeSnapshot([
      { data: { archetype: 'form' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      { parent: 0, tag: 'form', box: { x: 0, y: 0, width: 560, height: 400 } },
      { parent: 1, tag: 'label', text: 'Name', box: { x: 0, y: 20, width: 120, height: 32 } },
      { parent: 1, tag: 'input', box: { x: 130, y: 20, width: 430, height: 32 } },
      { parent: 1, tag: 'button', text: 'Save', box: { x: 0, y: 60, width: 100, height: 32 }, data: { submit: '' } },
    ]);
    expect(B3.check(s).some((v) => v.message.includes('above'))).toBe(true);
  });

  it('flags two submit actions', () => {
    const s = form();
    s.nodes.push({
      ...s.nodes[4],
      id: s.nodes.length,
      text: 'Save and close',
      box: { x: 110, y: 60, width: 140, height: 32 },
    });
    s.nodes[1].children.push(s.nodes.length - 1);
    expect(B3.check(s).some((v) => v.message.includes('one submit'))).toBe(true);
  });
});

describe('B4 — centered-card', () => {
  const centered = (over: NodeSpec = {}): ReturnType<typeof makeSnapshot> =>
    makeSnapshot([
      { data: { archetype: 'centered-card' }, box: { x: 0, y: 0, width: 1440, height: 900 } },
      panel({ parent: 0, text: 'Sign in', box: { x: 520, y: 250, width: 400, height: 400 }, ...over }),
    ]);

  it('accepts one 400px card centred in its frame', () => {
    expect(B4.check(centered())).toEqual([]);
  });

  it('flags a card wider than 480px', () => {
    expect(
      B4.check(centered({ box: { x: 420, y: 250, width: 600, height: 400 } })).some((v) =>
        v.message.includes('480')
      )
    ).toBe(true);
  });

  it('flags a card that is not centred', () => {
    expect(
      B4.check(centered({ box: { x: 40, y: 250, width: 400, height: 400 } })).some((v) =>
        v.message.includes('centred')
      )
    ).toBe(true);
  });

  it('flags a scroller inside a centred card view', () => {
    const s = centered();
    s.nodes[1].style.overflowY = 'auto';
    s.nodes[1].scrollHeight = 900;
    s.nodes[1].clientHeight = 400;
    expect(B4.check(s).some((v) => v.message.includes('scroll'))).toBe(true);
  });
});

describe('B5 — detail', () => {
  const section = (over: NodeSpec): NodeSpec => ({ data: { section: '' }, ...over });

  const ok = (): NodeSpec[] => [
    { data: { archetype: 'detail' }, box: { x: 0, y: 0, width: 900, height: 700 } },
    { parent: 0, tag: 'h1', text: 'INV-2043', box: { x: 0, y: 0, width: 200, height: 32 } },
    section({ parent: 0, box: { x: 0, y: 40, width: 900, height: 200 } }),
    section({ parent: 0, box: { x: 0, y: 250, width: 900, height: 200 } }),
  ];

  it('accepts one h1, two sections, and no pinned action', () => {
    expect(B5.check(makeSnapshot(ok()))).toEqual([]);
  });

  it('flags a detail with no h1 and one that has two', () => {
    const none = ok().filter((n) => n.tag !== 'h1');
    expect(B5.check(makeSnapshot(none)).some((v) => v.message.includes('exactly one <h1>'))).toBe(true);

    const two = [...ok(), { parent: 0, tag: 'h1', text: 'Also me', box: { x: 0, y: 500, width: 200, height: 32 } }];
    expect(B5.check(makeSnapshot(two)).some((v) => v.message.includes('exactly one <h1>'))).toBe(true);
  });

  it('flags one wall of content', () => {
    const wall = ok().filter((n) => n.data?.section === undefined);
    expect(B5.check(makeSnapshot(wall)).some((v) => v.message.includes('at least two'))).toBe(true);
  });

  it('flags a primary action that scrolls away', () => {
    const s = makeSnapshot([
      ...ok(),
      {
        parent: 0,
        style: { overflowY: 'auto' },
        box: { x: 0, y: 40, width: 900, height: 400 },
        clientHeight: 400,
        scrollHeight: 2000,
      },
      { parent: 4, data: { primaryAction: '' }, tag: 'button', text: 'Approve' },
    ]);
    expect(B5.check(s).some((v) => v.message.includes('scrolls away'))).toBe(true);
  });

  it('accepts a primary action pinned outside the scroll region', () => {
    const s = makeSnapshot([
      ...ok(),
      {
        parent: 0,
        style: { overflowY: 'auto' },
        box: { x: 0, y: 40, width: 900, height: 400 },
        clientHeight: 400,
        scrollHeight: 2000,
      },
      { parent: 0, data: { primaryAction: '' }, tag: 'button', text: 'Approve', box: { x: 700, y: 650, width: 120, height: 36 } },
    ]);
    expect(B5.check(s)).toEqual([]);
  });

  it('is silent on a different archetype', () => {
    expect(B5.check(makeSnapshot([{ data: { archetype: 'form' } }]))).toEqual([]);
  });
});

describe('B6 — settings', () => {
  const ok = (): NodeSpec[] => [
    { data: { archetype: 'settings' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
    { parent: 0, tag: 'nav', box: { x: 0, y: 0, width: 224, height: 700 } },
    {
      parent: 0,
      style: { overflowY: 'auto' },
      box: { x: 224, y: 0, width: 936, height: 700 },
      clientHeight: 700,
      scrollHeight: 1800,
    },
  ];

  it('accepts a rail plus one scrolling content column', () => {
    expect(B6.check(makeSnapshot(ok()))).toEqual([]);
  });

  it('flags a settings page with no section rail', () => {
    const railless = ok().filter((n) => n.tag !== 'nav');
    expect(B6.check(makeSnapshot(railless)).some((v) => v.message.includes('section rail'))).toBe(true);
  });

  it('flags a second vertical scroll region', () => {
    const s = makeSnapshot([
      ...ok(),
      {
        parent: 0,
        style: { overflowY: 'scroll' },
        box: { x: 224, y: 0, width: 936, height: 300 },
        clientHeight: 300,
        scrollHeight: 900,
      },
    ]);
    expect(B6.check(s).some((v) => v.message.includes('vertical scroll regions'))).toBe(true);
  });

  it('flags a switch inside a form that has a submit', () => {
    const s = makeSnapshot([
      ...ok(),
      { parent: 0, tag: 'form', box: { x: 300, y: 40, width: 500, height: 300 } },
      { parent: 3, role: 'switch', text: 'Weekly digest' },
      { parent: 3, tag: 'button', data: { variant: 'default' }, text: 'Save' },
    ]);
    expect(B6.check(s).some((v) => v.message.includes('needs Save is a checkbox'))).toBe(true);
  });

  it('accepts a switch that stands outside any form', () => {
    const s = makeSnapshot([...ok(), { parent: 0, role: 'switch', text: 'Weekly digest' }]);
    expect(B6.check(s)).toEqual([]);
  });

  it('is silent on a different archetype', () => {
    expect(B6.check(makeSnapshot([{ data: { archetype: 'form' } }]))).toEqual([]);
  });
});

describe('B7 — sequence', () => {
  const ok = (): NodeSpec[] => [
    { data: { archetype: 'sequence' }, box: { x: 0, y: 0, width: 900, height: 700 } },
    { parent: 0, role: 'progressbar', box: { x: 0, y: 16, width: 900, height: 8 } },
    { parent: 0, data: { step: '2' }, box: { x: 0, y: 60, width: 900, height: 500 } },
    { parent: 0, data: { back: '' }, tag: 'button', text: 'Back', box: { x: 0, y: 640, width: 100, height: 36 } },
  ];

  it('accepts one step, progress on top, and a way back', () => {
    expect(B7.check(makeSnapshot(ok()))).toEqual([]);
  });

  it('flags every step rendered at once', () => {
    const s = makeSnapshot([...ok(), { parent: 0, data: { step: '3' }, box: { x: 0, y: 60, width: 900, height: 500 } }]);
    expect(B7.check(s).some((v) => v.message.includes('shows 2 steps'))).toBe(true);
  });

  it('flags progress that shares the bottom edge with the primary', () => {
    const low = ok().map((n) =>
      n.role === 'progressbar' ? { ...n, box: { x: 0, y: 660, width: 900, height: 8 } } : n
    );
    expect(B7.check(makeSnapshot(low)).some((v) => v.message.includes('lower half'))).toBe(true);
  });

  it('flags a sequence with no progress and one with no way back', () => {
    const noProgress = ok().filter((n) => n.role !== 'progressbar');
    expect(B7.check(makeSnapshot(noProgress)).some((v) => v.message.includes('no progress'))).toBe(true);

    const noBack = ok().filter((n) => n.data?.back === undefined);
    expect(B7.check(makeSnapshot(noBack)).some((v) => v.message.includes('no back affordance'))).toBe(true);
  });

  it('is silent on a different archetype', () => {
    expect(B7.check(makeSnapshot([{ data: { archetype: 'form' } }]))).toEqual([]);
  });
});

describe('B8 — list', () => {
  /** The shape a passing list page has: heading, pinned filter, rows region. */
  const listPage = (extra: NodeSpec[] = []): NodeSpec[] => [
    { data: { archetype: 'list' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
    { parent: 0, tag: 'h1', text: 'Customers', box: { x: 0, y: 0, width: 200, height: 28 } },
    { parent: 0, tag: 'input', box: { x: 0, y: 32, width: 400, height: 32 } },
    {
      parent: 0,
      style: { overflowY: 'auto' },
      scrollHeight: 2000,
      clientHeight: 600,
      box: { x: 0, y: 68, width: 1160, height: 600 },
    },
    { parent: 3, tag: 'table', text: 'rows', box: { x: 0, y: 68, width: 1160, height: 2000 } },
    ...extra,
  ];

  it('accepts a heading, a pinned filter and a collection', () => {
    expect(B8.check(makeSnapshot(listPage()))).toEqual([]);
  });

  it('flags a page with no collection region', () => {
    const s = makeSnapshot([
      { data: { archetype: 'list' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      { parent: 0, tag: 'h1', text: 'Customers' },
      { parent: 0, tag: 'input' },
    ]);
    expect(B8.check(s).some((v) => v.message.includes('no collection region'))).toBe(true);
  });

  it('flags a collection the user cannot narrow', () => {
    const s = makeSnapshot([
      { data: { archetype: 'list' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      { parent: 0, tag: 'h1', text: 'Customers' },
      { parent: 0, tag: 'table', text: 'rows' },
    ]);
    expect(B8.check(s).some((v) => v.message.includes('no filter or scope control'))).toBe(true);
  });

  it('accepts a SegmentedControl as the filter — a scope control is a filter', () => {
    const s = makeSnapshot([
      { data: { archetype: 'list' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      { parent: 0, tag: 'h1', text: 'Inbox' },
      { parent: 0, role: 'radiogroup', box: { x: 0, y: 32, width: 300, height: 28 } },
      { parent: 0, tag: 'ul', text: 'rows', box: { x: 0, y: 68, width: 1160, height: 400 } },
    ]);
    expect(B8.check(s)).toEqual([]);
  });

  it('flags a filter that scrolls away with the rows', () => {
    // The filter nested *inside* the scroller rather than pinned above it.
    const s = makeSnapshot([
      { data: { archetype: 'list' }, box: { x: 0, y: 0, width: 1160, height: 700 } },
      { parent: 0, tag: 'h1', text: 'Customers' },
      {
        parent: 0,
        style: { overflowY: 'auto' },
        scrollHeight: 2000,
        clientHeight: 600,
        box: { x: 0, y: 32, width: 1160, height: 600 },
      },
      { parent: 2, tag: 'input', box: { x: 0, y: 32, width: 400, height: 32 } },
      { parent: 2, tag: 'table', text: 'rows', box: { x: 0, y: 68, width: 1160, height: 2000 } },
    ]);
    expect(B8.check(s).some((v) => v.message.includes('filter scrolls away'))).toBe(true);
  });

  it('flags two headings — two collections are two routes', () => {
    const s = makeSnapshot(
      listPage([{ parent: 0, tag: 'h1', text: 'Archived', box: { x: 0, y: 400, width: 200, height: 28 } }])
    );
    expect(B8.check(s).some((v) => v.message.includes('exactly one <h1>'))).toBe(true);
  });

  it('flags a second primary action', () => {
    const s = makeSnapshot(
      listPage([
        { parent: 0, data: { primaryAction: '' }, box: { x: 900, y: 0, width: 120, height: 32 } },
        { parent: 0, data: { primaryAction: '' }, box: { x: 1030, y: 0, width: 120, height: 32 } },
      ])
    );
    expect(B8.check(s).some((v) => v.message.includes('data-primary-action'))).toBe(true);
  });

  it('flags a primary action inside the scroll region', () => {
    const s = makeSnapshot(
      listPage([{ parent: 3, data: { primaryAction: '' }, box: { x: 0, y: 100, width: 120, height: 32 } }])
    );
    expect(B8.check(s).some((v) => v.message.includes('scrolls away'))).toBe(true);
  });

  it('is inert on a page that declares another archetype', () => {
    const s = makeSnapshot([{ data: { archetype: 'detail' }, box: { x: 0, y: 0, width: 1160, height: 700 } }]);
    expect(B8.check(s)).toEqual([]);
  });
});
