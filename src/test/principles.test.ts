import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A principle nobody links to is a principle nobody reads, and it rots without
 * anything going red. `doc-lint`'s D7 checks that links resolve; this checks
 * the other direction — that every document in docs/principles/ is reachable
 * from somewhere an agent actually opens.
 *
 * The reachable set is deliberately wide (the skills, the UX patterns, the
 * contract, the rubric, and the other principles), because the point is
 * "someone points here", not "it is pointed at from one blessed index".
 */
describe('every principle is reachable', () => {
  const root = path.resolve(__dirname, '../..');
  const principlesDir = path.join(root, 'docs/principles');

  const principles = fs
    .readdirSync(principlesDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  /** Every file an agent is pointed at, plus the principles themselves. */
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
  };

  const corpus = [
    ...walk(path.join(root, '.claude/skills')),
    ...walk(principlesDir),
    path.join(root, 'docs/UX.md'),
    path.join(root, 'AGENTS.md'),
    path.join(root, 'CLAUDE.md'),
    path.join(root, 'evaluator-rubric.md'),
  ]
    .filter((f) => fs.existsSync(f))
    .map((f) => ({ file: path.relative(root, f), text: fs.readFileSync(f, 'utf8') }));

  it('finds the principles and the documents that should cite them', () => {
    expect(principles.length).toBeGreaterThanOrEqual(6);
    expect(corpus.length).toBeGreaterThanOrEqual(10);
  });

  it.each(principles)('%s is linked from somewhere', (name) => {
    const citedBy = corpus
      .filter((c) => c.file !== `docs/principles/${name}` && c.text.includes(name))
      .map((c) => c.file);
    expect(
      citedBy.length,
      `docs/principles/${name} is not referenced by any skill, principle, ` +
        `docs/UX.md, AGENTS.md, CLAUDE.md or the rubric. A principle nobody ` +
        `points at is one nobody reads — link it from the task it governs.`
    ).toBeGreaterThan(0);
  });

  it.each(principles)('%s carries a version marker', (name) => {
    const text = fs.readFileSync(path.join(principlesDir, name), 'utf8');
    expect(
      /^<!-- principle:[a-z0-9.-]+:v\d+ -->/m.test(text),
      `docs/principles/${name} has no <!-- principle:<slug>:v<n> --> marker, ` +
        `so a breaking change to it cannot be announced to the files that cite it.`
    ).toBe(true);
  });
});
