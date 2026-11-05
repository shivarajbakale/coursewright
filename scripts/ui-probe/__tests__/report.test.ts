import { afterEach, describe, expect, it, vi } from 'vitest';

import { report } from '../report';
import type { Violation } from '../types';

vi.mock('../probe.config', () => ({ ENFORCED: ['A4'] }));

const violation = (rule: string): Violation => ({
  rule,
  message: `${rule} broke`,
  nodeId: 1,
  selectorHint: '<div> @0,0',
  detail: { got: 1 },
});

describe('report', () => {
  afterEach(() => vi.restoreAllMocks());

  it('splits enforced rules from report-only rules', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = report('Dashboard @1440', [violation('A4'), violation('A1')]);

    expect(result.enforced.map((v) => v.rule)).toEqual(['A4']);
    expect(result.reported.map((v) => v.rule)).toEqual(['A1']);
    const printed = log.mock.calls.flat().join('\n');
    expect(printed).toContain('FAIL A4');
    expect(printed).toContain('WARN A1');
  });

  it('says so plainly when a view is clean', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = report('Login @1280', []);

    expect(result.enforced).toEqual([]);
    expect(result.reported).toEqual([]);
    expect(log.mock.calls.flat().join('\n')).toContain('OK   Login @1280');
  });
});
