import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-expect-error — plain .mjs, no types; this is a script, not app source.
import { renderFeaturePlanMarkdown, validateFeaturePlan, ARCHETYPES } from '../feature-plan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', '__fixtures__');
const plan = JSON.parse(
  fs.readFileSync(path.join(fixtures, 'invoices.feature-plan.json'), 'utf8'),
);

describe('feature-plan renderer', () => {
  it('renders the fixture byte-identically to the committed golden', () => {
    // The whole point of a deterministic renderer is that the wireframe you
    // approved is the wireframe that gets built. A drifting template breaks
    // that quietly, so the golden is the guard: regenerate it deliberately
    // (`node scripts/feature-plan.mjs <fixture> -o <golden>`) or fix the bug.
    const golden = fs.readFileSync(path.join(fixtures, 'invoices.FEATURE-PLAN.md'), 'utf8');
    expect(renderFeaturePlanMarkdown(plan)).toBe(golden);
  });

  it('is idempotent — rendering twice produces the same bytes', () => {
    expect(renderFeaturePlanMarkdown(plan)).toBe(renderFeaturePlanMarkdown(plan));
  });

  it('draws every full-width frame square — no torn shell', () => {
    // A frame tears when a content row resolves to a different width than its
    // own border; that is exactly what the shell arithmetic got wrong first
    // time. Checked on single-frame blocks only: side-by-side layouts (mobile
    // list→detail, the states grid, the overlay pair) have their trailing
    // whitespace trimmed per line, so their rows are legitimately ragged.
    const md: string = renderFeaturePlanMarkdown(plan);
    const blocks: string[] = md.split('```').filter((_: string, i: number) => i % 2 === 1);
    expect(blocks.length).toBeGreaterThan(0);
    let checked = 0;
    for (const block of blocks) {
      const lines = block.split('\n').filter((l: string) => l.length > 0);
      if (!/^┌─+┐$/.test(lines[0] ?? '')) continue;
      checked++;
      const width = [...lines[0]].length;
      for (const line of lines) {
        expect([...line].length, `torn frame in:\n${line}`).toBe(width);
      }
    }
    // The desktop shell for the one surface, at minimum.
    expect(checked).toBeGreaterThan(0);
  });

  it('accepts the fixture', () => {
    expect(validateFeaturePlan(plan)).toEqual([]);
  });
});

describe('feature-plan validation', () => {
  const clone = () => JSON.parse(JSON.stringify(plan));

  it('rejects an archetype the probe cannot check', () => {
    const bad = clone();
    bad.surfaces[0].archetype = 'masonry';
    expect(validateFeaturePlan(bad).join('\n')).toContain('archetype');
    // The vocabulary is closed on purpose. It is the same list PageShell's
    // union, Module B of the probe and docs/principles/screen-archetypes.md
    // carry — plan-lint's P5 fails when the four disagree.
    expect(ARCHETYPES).toEqual([
      'dashboard-grid',
      'list',
      'list-detail',
      'detail',
      'form',
      'settings',
      'sequence',
      'centered-card',
    ]);
  });

  it('rejects a surface with no panels', () => {
    const bad = clone();
    bad.surfaces[0].panels = [];
    expect(validateFeaturePlan(bad).join('\n')).toContain('panels');
  });

  it('rejects a missing state — all four are mandatory', () => {
    const bad = clone();
    delete bad.surfaces[0].states.empty;
    expect(validateFeaturePlan(bad).join('\n')).toContain('states.empty');
  });

  it('rejects a list-detail with one panel (probe rule B1)', () => {
    const bad = clone();
    bad.surfaces[0].panels = [bad.surfaces[0].panels[0]];
    expect(validateFeaturePlan(bad).join('\n')).toContain('B1');
  });

  it('rejects a component choice with no justification', () => {
    const bad = clone();
    bad.components[0].why = '';
    expect(validateFeaturePlan(bad).join('\n')).toContain('why');
  });

  it('rejects a plan with no problem statement', () => {
    const bad = clone();
    delete bad.feature.problem;
    expect(validateFeaturePlan(bad).join('\n')).toContain('problem');
  });

  it('refuses to render an invalid plan rather than drawing something wrong', () => {
    const bad = clone();
    bad.surfaces[0].archetype = 'masonry';
    expect(() => renderFeaturePlanMarkdown(bad)).toThrow(/Invalid feature plan/);
  });
});

/**
 * The three shapes added with the screen-archetypes principle. A frame that
 * tears is a plan nobody can read, and the failure is silent — the box just
 * stops lining up — so each new archetype gets a render.
 */
describe('feature-plan renders the shapes added with the principle doc', () => {
  const surface = (archetype: string, panels: unknown[]) => ({
    feature: { id: 'x', title: 'X', problem: 'p' },
    surfaces: [
      {
        id: 's',
        name: 'Surface',
        archetype,
        moments: { peak: 'the thing lands', end: 'the state it settles into' },
        panels,
        states: { loading: 'l', empty: 'e', error: 'r', success: 's' },
      },
    ],
  });

  const twoPanels = [
    { title: 'One', rows: [['a', 'b']] },
    { title: 'Two', fields: [{ label: 'Plan', value: 'Pro' }] },
  ];

  for (const archetype of ['detail', 'settings', 'sequence']) {
    it(`${archetype} validates and draws a square frame`, () => {
      const p = surface(archetype, twoPanels);
      expect(validateFeaturePlan(p)).toEqual([]);
      const md: string = renderFeaturePlanMarkdown(p);
      expect(md).toContain(`Archetype: \`${archetype}\``);
      // Every line of a fenced frame is the same width, or the box has torn.
      const frame = md
        .split('```')[1]
        .split('\n')
        .filter((l: string) => l.includes('│'));
      expect(frame.length).toBeGreaterThan(3);
      expect(new Set(frame.map((l) => [...l].length)).size).toBe(1);
    });

    it(`${archetype} needs at least two panels`, () => {
      const errors = validateFeaturePlan(surface(archetype, [twoPanels[0]]));
      expect(errors.join('\n')).toContain('at least two panels');
    });
  }
});

/**
 * The peak and the end are named before the layout is drawn. See
 * docs/principles/emotional-design.md — a surface whose author cannot say
 * which moment the user takes away is a surface with neither.
 */
describe('feature-plan requires the moments', () => {
  const clone = () => JSON.parse(JSON.stringify(plan));

  it('rejects a surface with no moments at all', () => {
    const bad = clone();
    delete bad.surfaces[0].moments;
    expect(validateFeaturePlan(bad).join('\n')).toContain('moments: required');
  });

  it.each(['peak', 'end'])('rejects a surface missing its %s', (moment) => {
    const bad = clone();
    delete bad.surfaces[0].moments[moment];
    expect(validateFeaturePlan(bad).join('\n')).toContain(`moments.${moment}: required`);
  });

  it('rejects an empty string, which is a field filled in to pass the gate', () => {
    const bad = clone();
    bad.surfaces[0].moments.peak = '';
    expect(validateFeaturePlan(bad).join('\n')).toContain('moments.peak: required');
  });

  it('renders both above the wireframe, so intent is read before layout', () => {
    const md: string = renderFeaturePlanMarkdown(plan);
    const peak = md.indexOf('**Peak**');
    const end = md.indexOf('**End**');
    const frame = md.indexOf('**Desktop @1440**');
    expect(peak).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(peak);
    expect(frame).toBeGreaterThan(end);
  });
});
