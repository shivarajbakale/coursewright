import { describe, expect, it } from 'vitest';
import { MantineProvider, Paper, Title } from '@mantine/core';

import { cssVariablesResolver, theme } from '../../src/theme';

import { measure, VIEWPORTS } from './mount';
import { paints } from './tree';

/**
 * Proves the driver, not the app.
 *
 * If this file passes, the probe is measuring a real layout engine: boxes have
 * size, computed styles resolve, overflow is detectable, and the viewport is
 * actually being resized. Every rule in Modules A-C depends on all four.
 */
describe('browser geometry', () => {
  it('returns non-zero boxes — the whole reason for not using jsdom', async () => {
    const s = await measure(
      <div style={{ width: 200, height: 40 }}>measured</div>,
      'geometry',
      VIEWPORTS[1]
    );
    const el = s.nodes.find((n) => n.text === 'measured');
    expect(el?.box.width).toBe(200);
    expect(el?.box.height).toBe(40);
  });

  it('resolves computed styles from the app stylesheet', async () => {
    // A Mantine component, not a utility class: the app ships one styling
    // system, so "the app stylesheet resolved" and "Mantine's CSS resolved" are
    // the same question. The provider is what emits the theme's variables, and
    // a heading is sized from them.
    const s = await measure(
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
        <Title order={2}>heading-ish</Title>
      </MantineProvider>,
      'geometry',
      VIEWPORTS[1]
    );
    const el = s.nodes.find((n) => n.text === 'heading-ish');
    // The theme's own h2 size, not a number this test picked: an identity
    // that re-scales its headings should not have to edit the probe.
    const h2 = parseFloat(String(theme.headings?.sizes?.h2?.fontSize)) * 16;
    expect(el?.style.fontSize).toBeCloseTo(h2, 0);
    // Likewise the weight: the theme's heading weight (500 since the unslop pass), not a fixed 600.
    expect(el?.style.fontWeight).toBe(Number(theme.headings?.fontWeight));
  });

  it('detects horizontal overflow', async () => {
    const s = await measure(
      <div style={{ width: 100, overflowX: 'auto' }}>
        <div style={{ width: 400, height: 10 }} />
      </div>,
      'geometry',
      VIEWPORTS[1]
    );
    const scroller = s.nodes[0].children.map((id) => s.nodes[id])[0];
    expect(scroller.scrollWidth - scroller.clientWidth).toBeGreaterThan(1);
  });

  it('honours the requested viewport width', async () => {
    for (const viewport of VIEWPORTS) {
      const s = await measure(<div>vp</div>, `geometry @${viewport.width}`, viewport);
      expect(s.viewport.width).toBe(viewport.width);
    }
  });

  it('agrees with the ink test on a bordered box', async () => {
    const s = await measure(
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
        <Paper withBorder radius="md" p="md" data-bordered="1">
          <span>ink</span>
        </Paper>
      </MantineProvider>,
      'geometry',
      VIEWPORTS[1]
    );
    // Found by its own marker rather than by position: MantineProvider emits
    // <style> elements alongside its children, so the first child of the mount
    // host is one of those, not the box.
    const box = s.nodes.find((n) => n.data.bordered === '1');
    if (!box) throw new Error('bordered box not in the snapshot');
    expect(box.style.borderTopWidth).toBe(1);
    expect(paints(box)).toBe(true);
  });
});
