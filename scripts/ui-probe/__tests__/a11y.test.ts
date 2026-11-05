import { describe, expect, it } from 'vitest';

import { toViolations } from '../a11y';

describe('a11y adapter', () => {
  it('maps axe results onto probe violations', () => {
    const out = toViolations({
      violations: [
        {
          id: 'heading-order',
          impact: 'moderate',
          help: 'Heading levels should only increase by one',
          nodes: [{ target: ['.card > h3'] }, { target: ['.panel > h4'] }],
        },
      ],
    } as never);

    expect(out).toHaveLength(2);
    expect(out[0].rule).toBe('D4');
    expect(out[0].message).toContain('heading-order');
    expect(out[0].selectorHint).toBe('.card > h3');
    expect(out[0].detail.impact).toBe('moderate');
  });

  it('returns nothing for a clean result', () => {
    expect(toViolations({ violations: [] } as never)).toEqual([]);
  });
});
