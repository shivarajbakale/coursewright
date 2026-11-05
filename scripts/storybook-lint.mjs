#!/usr/bin/env node
/**
 * Storybook contract lint — the static half of the Storybook gate.
 *
 * Reads `docs/storybook-taxonomy.json` (the single source of truth for the
 * sidebar hierarchy) and checks every `*.stories.tsx` under `src/` against
 * the house rules. Unlike the allowlist-driven tests it replaces, nothing
 * here is hardcoded per file: add a story anywhere and it is graded on the
 * same rules the same day.
 *
 * Rules
 *   R1  title matches the taxonomy exactly (root/section/name at the
 *       required depth) and the section matches the file's directory
 *   R2  >= 3 named story exports (Default + at least two states)
 *   R3  meta carries a JSDoc `component:` description
 *   R4  meta declares `tags: ['autodocs']`
 *   R5  meta declares an explicit `parameters.layout`
 *   R6  meta declares `argTypes` when the component takes props
 *   R7  no raw hex / rgb() / oklch() colour literals (tokens only)
 *   R8  every shell composite in src/components/ has a sibling story
 *   R9  no handlers() spy parked in argTypes (Storybook ignores it)
 *   R10 the generated section docs match docs/storybook-taxonomy.json
 *
 * Usage
 *   node scripts/storybook-lint.mjs          # report, exit 1 on any failure
 *   node scripts/storybook-lint.mjs --fix    # rewrite titles to match R1
 */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const TAXONOMY = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs', 'storybook-taxonomy.json'), 'utf8'),
);
const FIX = process.argv.includes('--fix');

/* -------------------------------------------------------------------------- */
/*                                 display names                              */
/* -------------------------------------------------------------------------- */

/** Basenames whose Title Case cannot be derived mechanically. */
const DISPLAY_OVERRIDES = {
  shell: 'App Shell',
  topbar: 'Topbar',
  ErrorBoundary: 'Error Boundary',
  AuthGuard: 'Auth Guard',
  LoginPage: 'Login',
  CustomersPage: 'Customers',
  CustomerDetailPage: 'Customer',
  Dashboard: 'Dashboard',
  Settings: 'Settings',
};

function displayName(base) {
  if (DISPLAY_OVERRIDES[base]) return DISPLAY_OVERRIDES[base];
  return base
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/* -------------------------------------------------------------------------- */
/*                             taxonomy -> expected title                     */
/* -------------------------------------------------------------------------- */

/** basename -> "Root/Section", built once from the taxonomy. */
const MEMBER_INDEX = new Map();
for (const [root, cfg] of Object.entries(TAXONOMY.roots)) {
  if (!cfg.sections) continue;
  for (const [section, sCfg] of Object.entries(cfg.sections)) {
    for (const member of sCfg.members) {
      if (MEMBER_INDEX.has(member)) {
        throw new Error(
          `taxonomy: "${member}" is listed twice (${MEMBER_INDEX.get(member)} and ${root}/${section})`,
        );
      }
      MEMBER_INDEX.set(member, `${root}/${section}`);
    }
  }
}

/** Which taxonomy root owns a file, by directory. */
function rootFor(relPath) {
  const dir = path.dirname(relPath);
  if (dir === 'components/_overview') return 'Overview';
  if (dir.startsWith('pages')) return 'Pages';
  if (dir === 'components' || dir === 'components/auth') return 'Shell';
  return null;
}

/** The one title a given story file is allowed to declare. */
function expectedTitle(relPath) {
  const base = path.basename(relPath, '.stories.tsx');
  const root = rootFor(relPath);
  if (!root) return null;
  if (root === 'Overview' || root === 'Pages') return `${root}/${displayName(base)}`;
  const owner = MEMBER_INDEX.get(base);
  if (!owner) return { unmapped: true, root, base };
  if (!owner.startsWith(`${root}/`)) {
    return { misfiled: true, owner, root, base };
  }
  return `${owner}/${displayName(base)}`;
}

/* -------------------------------------------------------------------------- */
/*                                   scanning                                 */
/* -------------------------------------------------------------------------- */

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.stories.tsx')) acc.push(full);
  }
  return acc;
}

/** The meta object literal source, so per-story parameters don't false-positive. */
function metaBlock(src) {
  const start = src.indexOf('const meta = {');
  if (start === -1) return '';
  const end = src.indexOf('\n} satisfies Meta', start);
  return end === -1 ? src.slice(start) : src.slice(start, end);
}

const failures = [];
const fixes = [];
function fail(file, rule, message) {
  failures.push({ file, rule, message });
}

const files = walk(SRC).sort();

for (const full of files) {
  const rel = path.relative(SRC, full);
  const src = fs.readFileSync(full, 'utf8');
  const meta = metaBlock(src);

  /* ---- R1: title matches the taxonomy ---- */
  const declared = src.match(/const meta = \{[\s\S]*?title: '([^']+)'/)?.[1] ?? null;
  const want = expectedTitle(rel);
  if (!declared) {
    fail(rel, 'R1', 'meta declares no title');
  } else if (want === null) {
    fail(rel, 'R1', `file sits outside every taxonomy sourceDir (dir: ${path.dirname(rel)})`);
  } else if (typeof want === 'object' && want.unmapped) {
    fail(
      rel,
      'R1',
      `"${want.base}" is not listed in any ${want.root} section of docs/storybook-taxonomy.json — add it there first`,
    );
  } else if (typeof want === 'object' && want.misfiled) {
    fail(
      rel,
      'R1',
      `taxonomy files "${want.base}" under ${want.owner} but the file lives in a ${want.root} directory`,
    );
  } else if (declared !== want) {
    if (FIX) {
      fs.writeFileSync(full, src.replace(`title: '${declared}'`, `title: '${want}'`));
      fixes.push(`${rel}: '${declared}' -> '${want}'`);
    } else {
      fail(rel, 'R1', `title '${declared}' should be '${want}'`);
    }
  }

  /* ---- R2: >= 3 named story exports ---- */
  const named = (src.match(/^export const [A-Z]/gm) || []).length;
  if (named < 3) fail(rel, 'R2', `only ${named} named story export(s), need >= 3`);

  /* ---- R3: meta has a component description ---- */
  const hasDoc =
    /\/\*\*[\s\S]*?\*\/\s*const meta = \{/.test(src) || /component:\s*\{/.test(meta);
  if (!hasDoc) fail(rel, 'R3', 'meta has no JSDoc block (autodocs renders an empty description)');

  /* ---- R4: autodocs ---- */
  if (!/tags: \[[^\]]*'autodocs'/.test(meta)) fail(rel, 'R4', "meta must declare tags: ['autodocs']");

  /* ---- R5: explicit layout ---- */
  if (!/layout: '(centered|fullscreen|padded)'/.test(meta))
    fail(rel, 'R5', "meta must declare an explicit parameters.layout ('centered' | 'fullscreen' | 'padded')");

  /* ---- R6: argTypes when the component takes props ---- */
  // Only files that actually feed `args` into a story have anything for the
  // Controls panel to type. A file built entirely from `render:` (or from
  // bare `{}` stories driven by decorators/globals) has no controls to label,
  // so requiring argTypes there would be dead weight.
  const argsDriven = /^\s{2}args: \{/m.test(src) || /\.\.\.\w+,?\s*args:/.test(src);
  if (argsDriven && !/argTypes/.test(meta))
    fail(rel, 'R6', 'stories pass args but meta declares no argTypes (Controls shows bare text inputs)');

  /* ---- R9: no spy functions inside argTypes ---- */
  // `handlers()` returns spy *functions*; Storybook only reads argTypes
  // entries that are objects, so a spy parked there is silently dropped and
  // the Actions panel stays empty. Events belong in `eventArgTypes()`.
  const argTypesBlock = meta.match(/argTypes: \{[\s\S]*?\n {2}\},/)?.[0] ?? '';
  if (/handlers\(/.test(argTypesBlock))
    fail(
      rel,
      'R9',
      'handlers() spy inside argTypes — Storybook ignores it; use eventArgTypes([...]) in argTypes, or handlers() in args',
    );

  /* ---- R7: tokens only ---- */
  const rawColour = src.match(/(?<![\w-])(#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\()/g);
  if (rawColour) fail(rel, 'R7', `raw colour literal(s): ${[...new Set(rawColour)].join(', ')}`);
}

/* ---- R8: every shell composite has a sibling story ---- */
// It used to be the kit: `src/components/ui/` was where the graded components
// lived, and every atom in it owed a story. `mantine-005` deleted that
// directory — the atoms are Mantine's now, documented by Mantine — so the rule
// follows what is left that this repo actually owns: the shell composites.
const COMPOSITE_DIRS = [
  path.join(SRC, 'components'),
  path.join(SRC, 'components', 'auth'),
];
const graded = [];
for (const dir of COMPOSITE_DIRS) {
  const rel = path.relative(SRC, dir);
  const composites = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx') && !e.name.endsWith('.stories.tsx'))
    .map((e) => e.name.replace(/\.tsx$/, ''));
  graded.push(...composites);
  for (const composite of composites) {
    if (!fs.existsSync(path.join(dir, `${composite}.stories.tsx`)))
      fail(`${rel}/${composite}.tsx`, 'R8', 'composite has no sibling .stories.tsx');
    if (!MEMBER_INDEX.has(composite))
      fail(`${rel}/${composite}.tsx`, 'R8', 'composite is missing from docs/storybook-taxonomy.json');
  }
}

/* ---- R10: generated section docs are in sync with the taxonomy ---- */
// Without this, editing docs/storybook-taxonomy.json silently leaves the
// Introduction table and the section landing pages describing the old shape —
// the exact drift that put four fictional sections in the docs.
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'gen-storybook-docs.mjs'), '--check'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
} catch (err) {
  const detail = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(1).join('; ');
  fail('.storybook/', 'R10', `generated docs are stale — run \`make storybook-docs\` (${detail})`);
}

/* -------------------------------------------------------------------------- */
/*                                   report                                   */
/* -------------------------------------------------------------------------- */

if (fixes.length) {
  console.log(`storybook-lint --fix retitled ${fixes.length} file(s):`);
  for (const f of fixes) console.log(`  ${f}`);
}

if (failures.length === 0) {
  console.log(
    `storybook-lint: ${files.length} story files OK (${graded.length} composites mapped)`,
  );
  process.exit(0);
}

const byRule = failures.reduce((acc, f) => {
  (acc[f.rule] ||= []).push(f);
  return acc;
}, {});
console.error(`\nstorybook-lint: ${failures.length} failure(s) across ${files.length} story files\n`);
for (const rule of Object.keys(byRule).sort()) {
  console.error(`${rule} (${byRule[rule].length})`);
  for (const f of byRule[rule]) console.error(`  ${f.file}: ${f.message}`);
  console.error('');
}
process.exit(1);
