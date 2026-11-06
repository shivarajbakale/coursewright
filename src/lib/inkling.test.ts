import { describe, expect, it, vi } from 'vitest';
import { fontWait, inklingTitle, mountExplainer, paperFor } from './inkling';

fontWait.ms = 0;

const GOOD = 'title "The loop"\nlayout cycle\nthink: circle "Think"\nact: circle "Act"\ncycle think, act\nstep 1: think "The model thinks"\nstep 2: act "Then it acts"';

describe('Inkling explainers', () => {
  it('picks the paper from the reading theme and reads the title', () => {
    expect([paperFor('dark'), paperFor('light'), paperFor('sepia')]).toEqual(['chalkboard', 'notebook', 'napkin']);
    expect(inklingTitle(GOOD)).toBe('The loop');
    expect(inklingTitle('a -> b')).toBe('');
  });

  it('draws the source finished, labels it with its captions, and steps through', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const seen = vi.fn();
    const c = await mountExplainer(host, GOOD, 'chalkboard', seen);
    const svg = host.querySelector('.cw-inkling svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-label')).toBe('The loop. The model thinks. Then it acts');
    expect((svg as SVGElement).style.aspectRatio).toMatch(/\d+ \/ \d+/);
    expect(seen).toHaveBeenLastCalledWith({ step: 1, steps: [{ caption: 'The model thinks' }, { caption: 'Then it acts' }], playing: false, done: true });
    c.prev();
    expect(seen.mock.lastCall![0]).toMatchObject({ step: 0, done: false });
    c.destroy();
    expect(host.innerHTML).toBe('');
  });

  it('refuses a source with a mistake, with the first error', async () => {
    await expect(mountExplainer(document.createElement('div'), 'layout spiral', 'notebook', () => {})).rejects.toThrow(/No layout called "spiral"/);
  });
});
