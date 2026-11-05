import { beforeEach, describe, expect, it } from 'vitest';

import { snapshot } from '../snapshot';

/**
 * Structure only. jsdom returns a zero rect for everything, so the geometry
 * half of `snapshot` is proved by the browser probe (scripts/ui-probe/*.probe.tsx),
 * not here.
 */
describe('snapshot', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('numbers nodes in pre-order with the root at 0', () => {
    document.body.innerHTML = `
      <section id="a"><p id="b">one</p><p id="c">two</p></section>
    `;
    const s = snapshot(document.body.querySelector('#a') as Element, 'test');
    expect(s.nodes.map((n) => n.tag)).toEqual(['section', 'p', 'p']);
    expect(s.nodes.map((n) => n.id)).toEqual([0, 1, 2]);
    expect(s.nodes[0].parent).toBeNull();
    expect(s.nodes[0].children).toEqual([1, 2]);
    expect(s.nodes[1].parent).toBe(0);
  });

  it('captures only direct text children, whitespace collapsed', () => {
    document.body.innerHTML = `<div id="r">  hello   world  <span>nested</span></div>`;
    const s = snapshot(document.body.querySelector('#r') as Element, 'test');
    expect(s.nodes[0].text).toBe('hello world');
    expect(s.nodes[1].text).toBe('nested');
  });

  it('captures dataset, role, and testid', () => {
    document.body.innerHTML =
      `<div id="r" data-archetype="form" data-panel data-scroll-x="allow" role="region" data-testid="t"></div>`;
    const s = snapshot(document.body.querySelector('#r') as Element, 'test');
    expect(s.nodes[0].data).toMatchObject({ archetype: 'form', panel: '', scrollX: 'allow' });
    expect(s.nodes[0].role).toBe('region');
    expect(s.nodes[0].testId).toBe('t');
  });

  it('records the label and the document scroll box', () => {
    document.body.innerHTML = `<div id="r"></div>`;
    const s = snapshot(document.body.querySelector('#r') as Element, 'Dashboard @1440');
    expect(s.label).toBe('Dashboard @1440');
    expect(typeof s.scroll.scrollHeight).toBe('number');
    expect(typeof s.viewport.width).toBe('number');
  });

  it('refuses a detached element rather than reporting zeros', () => {
    const orphan = document.createElement('div');
    expect(() => snapshot(orphan, 'test')).toThrow(/not attached/);
  });
});
