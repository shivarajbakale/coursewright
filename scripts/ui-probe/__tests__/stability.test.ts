import { describe, expect, it } from 'vitest';

import { compareAcrossViewports } from '../rules/stability';
import type { Violation } from '../types';

const v = (rule: string): Violation => ({
  rule,
  message: '',
  nodeId: null,
  selectorHint: '',
  detail: {},
});

describe('A5 — viewport stability', () => {
  it('flags a rule that fails at some widths but not others', () => {
    // The measured 1/1/0 scroller instability on Customers.
    const out = compareAcrossViewports([
      { label: 'Customers @1280', violations: [v('A2')] },
      { label: 'Customers @1440', violations: [v('A2')] },
      { label: 'Customers @1920', violations: [] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe('A5');
    expect(out[0].detail.failingAt).toBe('Customers @1280, Customers @1440');
  });

  it('stays quiet when a rule fails everywhere — that is the rule reporting, not instability', () => {
    const out = compareAcrossViewports([
      { label: 'a', violations: [v('A1')] },
      { label: 'b', violations: [v('A1')] },
    ]);
    expect(out).toEqual([]);
  });

  it('stays quiet when nothing fails anywhere', () => {
    expect(
      compareAcrossViewports([
        { label: 'a', violations: [] },
        { label: 'b', violations: [] },
      ])
    ).toEqual([]);
  });

  it('needs at least two runs to say anything', () => {
    expect(compareAcrossViewports([{ label: 'a', violations: [v('A1')] }])).toEqual([]);
  });
});
