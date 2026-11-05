import { describe, expect, it } from 'vitest';

import { ancestors, descendants, effectiveBackground, hint, ignoredBy, paints, visible } from '../tree';
import { makeSnapshot } from './factory';

describe('tree', () => {
  it('walks descendants and ancestors', () => {
    const s = makeSnapshot([
      { tag: 'main' },
      { tag: 'section', parent: 0 },
      { tag: 'p', parent: 1 },
      { tag: 'aside', parent: 0 },
    ]);
    expect(descendants(s, s.nodes[0]).map((n) => n.tag).sort()).toEqual(['aside', 'p', 'section']);
    expect(ancestors(s, s.nodes[2]).map((n) => n.tag)).toEqual(['section', 'main']);
  });

  it('treats a zero-area or hidden node as invisible', () => {
    const s = makeSnapshot([
      { box: { x: 0, y: 0, width: 0, height: 0 } },
      { style: { visibility: 'hidden' } },
      { style: { display: 'none' } },
      {},
    ]);
    expect(s.nodes.slice(0, 3).map((n) => visible(n))).toEqual([false, false, false]);
    expect(visible(s.nodes[3])).toBe(true);
  });

  it('only counts a node as painting when it has ink', () => {
    const s = makeSnapshot([
      {}, // bare div: no ink
      { text: 'hello' }, // text
      { style: { backgroundColor: 'rgb(20, 20, 20)' } }, // fill
      { style: { borderTopWidth: 1 } }, // border
      { tag: 'svg' }, // self-painting
    ]);
    expect(s.nodes.map((n) => paints(n))).toEqual([false, true, true, true, true]);
  });

  it('honours data-probe-ignore on the node and on any ancestor', () => {
    const s = makeSnapshot([
      { data: { probeIgnore: 'A1 C6' } },
      { parent: 0 },
      { parent: 0, data: { probeIgnore: 'all' } },
      {},
    ]);
    expect(ignoredBy(s, s.nodes[0], 'A1')).toBe(true);
    expect(ignoredBy(s, s.nodes[1], 'C6')).toBe(true); // inherited
    expect(ignoredBy(s, s.nodes[1], 'A2')).toBe(false);
    expect(ignoredBy(s, s.nodes[2], 'anything')).toBe(true);
    expect(ignoredBy(s, s.nodes[3], 'A1')).toBe(false);
  });

  it('resolves a background through transparent ancestors', () => {
    const s = makeSnapshot([
      { style: { backgroundColor: 'rgb(10, 10, 12)' } },
      { parent: 0 },
      { parent: 1 },
    ]);
    expect(effectiveBackground(s, s.nodes[2])).toBe('rgb(10, 10, 12)');
  });

  it('renders a hint a human can find on screen', () => {
    const s = makeSnapshot([
      { tag: 'section', data: { archetype: 'list-detail' }, box: { x: 24, y: 180, width: 10, height: 10 } },
    ]);
    expect(hint(s.nodes[0])).toBe('<section data-archetype="list-detail"> @24,180');
  });
});
