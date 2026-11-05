import { describe, expect, it } from 'vitest';

import { contrastRatio, flatten, parseRgb, relativeLuminance } from '../color';

describe('color', () => {
  it('parses rgb and rgba', () => {
    expect(parseRgb('rgb(255, 255, 255)')).toEqual([255, 255, 255, 1]);
    expect(parseRgb('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
  });

  it('parses the space/slash form modern browsers return', () => {
    expect(parseRgb('rgb(10 20 30 / 0.4)')).toEqual([10, 20, 30, 0.4]);
  });

  it('returns null for anything else', () => {
    expect(parseRgb('transparent')).toBeNull();
    expect(parseRgb('')).toBeNull();
  });

  it('computes luminance at the two extremes', () => {
    expect(relativeLuminance([0, 0, 0, 1])).toBeCloseTo(0, 5);
    expect(relativeLuminance([255, 255, 255, 1])).toBeCloseTo(1, 5);
  });

  it('composites a translucent foreground over its background', () => {
    expect(flatten([255, 255, 255, 0.5], [0, 0, 0, 1])).toEqual([127.5, 127.5, 127.5, 1]);
  });

  it('reports the WCAG ratio for black on white', () => {
    expect(contrastRatio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 1);
  });

  it('reports 1 for a colour against itself', () => {
    expect(contrastRatio([120, 120, 120, 1], [120, 120, 120, 1])).toBeCloseTo(1, 5);
  });

  it('accounts for alpha — a 50% white on black reads lower than solid white', () => {
    const solid = contrastRatio([255, 255, 255, 1], [0, 0, 0, 1]);
    const faded = contrastRatio([255, 255, 255, 0.5], [0, 0, 0, 1]);
    expect(faded).toBeLessThan(solid);
    expect(faded).toBeGreaterThan(1);
  });
});

/**
 * The oklch half of the parser.
 *
 * Chromium returns computed wide-gamut colours verbatim, and this palette is
 * authored in oklch, so these formats are the common case rather than the edge
 * case. Every expectation below is pinned against a known sRGB value.
 */
describe('oklch and oklab', () => {
  it('parses the palette extremes', () => {
    expect(parseRgb('oklch(1 0 0)')).toEqual([255, 255, 255, 1]);
    expect(parseRgb('oklch(0 0 0)')).toEqual([0, 0, 0, 1]);
  });

  it('round-trips the app background and body text', () => {
    // --mantine-color-dark-8 and dark-0: the two ends of this app's ladder.
    const bg = parseRgb('oklch(0.165 0.004 285)');
    const fg = parseRgb('oklch(0.98 0 0)');
    expect(bg).not.toBeNull();
    expect(fg).not.toBeNull();
    expect(bg![0]).toBeLessThan(40);
    expect(fg![0]).toBeGreaterThan(240);
    expect(contrastRatio(fg!, bg!)).toBeGreaterThan(15);
  });

  it('separates dimmed text from body text — the levels C4 counts', () => {
    const bg = parseRgb('oklch(0.165 0.004 285)')!;
    const body = contrastRatio(parseRgb('oklch(0.98 0 0)')!, bg);
    const dimmed = contrastRatio(parseRgb('oklch(0.68 0.006 285)')!, bg);
    expect(body - dimmed).toBeGreaterThan(0.5); // CONTRAST_STEP
  });

  it('reads the alpha off the slash form', () => {
    expect(parseRgb('oklab(0.88 0.001 -0.004 / 0.7)')?.[3]).toBeCloseTo(0.7, 5);
    expect(parseRgb('oklch(0.7 0.1 200 / 50%)')?.[3]).toBeCloseTo(0.5, 5);
  });

  it('accepts a percentage lightness', () => {
    expect(parseRgb('oklch(100% 0 0)')).toEqual([255, 255, 255, 1]);
  });

  it('still returns null for a keyword', () => {
    expect(parseRgb('oklch')).toBeNull();
    expect(parseRgb('currentcolor')).toBeNull();
  });
});
