import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error — plain ESM script, no types
import { DEAD_TOKENS, MIN_FILES, run, scanFile } from '../skill-lint.mjs';

type Violation = { rule: string; no: number; why: string };
const rules = (violations: Violation[]) => violations.map((v) => v.rule);

const fence = (...body: string[]) => ['```tsx', ...body, '```'].join('\n');

describe('skill-lint', () => {
  it('fails a quoted class list inside a code fence', () => {
    const { violations } = scanFile('SKILL.md', fence('<div className="flex gap-2">'));
    expect(rules(violations as Violation[])).toEqual(['S1']);
  });

  it('allows a class list the fence is teaching you not to write', () => {
    // docs/CONSTRAINTS.md does exactly this: the DO and the DON'T sit in one
    // block, and the DON'T has to be legible or it teaches nothing.
    const { violations } = scanFile(
      'CONSTRAINTS.md',
      fence("// DON'T — hand-rolled styling duplicates the atom", '<button className="rounded-md px-3">x</button>'),
    );
    expect(violations).toEqual([]);
  });

  it('ignores a CSS-module class, which is how a media query reaches a cell', () => {
    const { violations } = scanFile(
      'SKILL.md',
      fence('meta: { headClassName: cols.plan, cellClassName: cols.plan },'),
    );
    expect(violations).toEqual([]);
  });

  it('ignores a quoted class outside a fence — prose is not code', () => {
    const { violations } = scanFile('SKILL.md', 'The old system wrote className="flex" here.');
    expect(violations).toEqual([]);
  });

  it('fails a dead token in prose, where no fence can exempt it', () => {
    const { violations } = scanFile('SKILL.md', 'Helper text lives in `text-muted-foreground`.');
    expect(rules(violations as Violation[])).toEqual(['S2']);
  });

  it('names every dead token it knows about', () => {
    for (const token of DEAD_TOKENS as string[]) {
      const { violations } = scanFile('SKILL.md', `a line mentioning ${token} in passing`);
      expect(rules(violations as Violation[]), token).toContain('S2');
    }
  });

  it('reports the line number, because a violation is a place to go', () => {
    const { violations } = scanFile('SKILL.md', ['one', 'two', '`bg-card`'].join('\n'));
    expect((violations as Violation[])[0].no).toBe(3);
  });

  it('fails when the scan roots find nothing — a vacuous gate is not a green one', () => {
    const empty = mkdtempSync(join(tmpdir(), 'skill-lint-'));
    const { files, violations } = run(empty);
    expect(files).toEqual([]);
    expect(rules(violations as Violation[])).toEqual(['S3']);
  });

  it('passes on this project, which is the whole point', () => {
    const { files, fenceCount, violations } = run();
    expect(violations).toEqual([]);
    expect(files.length).toBeGreaterThanOrEqual(MIN_FILES as number);
    expect(fenceCount).toBeGreaterThan(0);
  });
});
