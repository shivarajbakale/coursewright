#!/usr/bin/env node
/**
 * skill-lint — the instructions are graded too.
 *
 * The skills in `.claude/skills/` and the prose in `docs/` are how an agent
 * learns to write this app. They are not compiled, not type-checked and not
 * rendered, so nothing stopped them describing a system the app no longer has:
 * when Tailwind left, `ui-lint` turned the source green in an afternoon while
 * four skills went on teaching `meta: { headClassName: 'w-28' }` and a dark-mode
 * checklist went on naming `bg-card`. An agent following those instructions
 * writes code the build then rejects — the worst kind of stale doc, because it
 * is confidently wrong rather than merely absent.
 *
 * So the two things that cannot be true any more are checked on every run.
 *
 * Rules
 *   S1  no `className="…"` string literal inside a fenced code block. Mantine
 *       props and CSS modules (`className={cols.x}`) are the whole vocabulary;
 *       a quoted class list is the removed system. A line is exempt when the
 *       nearest comment above it inside the fence marks it as the anti-pattern
 *       being taught — `DON'T`, `Never`, `Bad`, `anti-pattern`.
 *   S2  no dead design-token name, anywhere in the file. These identifiers
 *       (`bg-card`, `text-muted-foreground`, `@apply`, `cn(` …) resolve to
 *       nothing in this app. Naming one is always a mistake, in prose as much
 *       as in code, so this rule has no exemption: describe the anti-pattern in
 *       words instead.
 *   S3  anti-vacuity — the scan reached the expected shape of the tree. A glob
 *       that silently matches nothing is a green gate that checks nothing.
 *
 * Usage
 *   node scripts/skill-lint.mjs
 *
 * Dependency-free: Node stdlib only.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Where instructions live. Both are scanned whole, markdown only. */
const ROOT_DIRS = [[".claude", "skills"], ["docs"]];

/**
 * Identifiers from the styling system this app no longer has.
 *
 * Deliberately not a general Tailwind-utility matcher: this list is names that
 * are dead here specifically, so a hit is unambiguous rather than a judgement
 * call about whether some hyphenated word is a class.
 *
 * `bg-grid` and `bg-radial-fade` are deliberately *not* here. They look like
 * Tailwind and are not: `src/App.css` declares them, they paint the auth
 * panel's backdrop, and a doc that names them is telling the truth.
 */
export const DEAD_TOKENS = [
  "bg-card",
  "bg-background",
  "bg-sidebar",
  "bg-primary",
  "bg-muted",
  "text-foreground",
  "text-muted-foreground",
  "border-border",
  "tailwind.config",
  "@apply",
  "cn(",
];

/** A comment line that marks the code under it as the thing not to do. */
const ANTI_PATTERN = /DON'?T|Don'?t\b|Never\b|Bad\b|anti-pattern/;

/** The floor S3 checks. Well under the real count; it catches a broken glob. */
export const MIN_FILES = 15;

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return entry.endsWith(".md") ? [full] : [];
  });
}

/**
 * Grade one markdown file. Pure: takes text, returns violations, touches no
 * disk — so a test can hand it three lines and assert on the rule that fires.
 */
export function scanFile(rel, text) {
  const violations = [];
  const lines = text.split("\n");
  let inFence = false;
  let fences = 0;
  /** The last comment seen inside the current fence, for the S1 exemption. */
  let lastComment = "";

  lines.forEach((line, i) => {
    const no = i + 1;

    if (/^\s*```/.test(line)) {
      if (!inFence) fences += 1;
      inFence = !inFence;
      lastComment = "";
      return;
    }

    if (inFence) {
      if (/^\s*(\/\/|\/\*|\*|#|<!--)/.test(line)) lastComment = line;
      if (/className\s*=\s*"/.test(line) || /\sclass\s*=\s*"/.test(line)) {
        if (!ANTI_PATTERN.test(lastComment)) {
          violations.push({
            rule: "S1",
            rel,
            no,
            text: line.trim(),
            why: "quoted class list — use Mantine props, or a CSS module via className={styles.x}",
          });
        }
      }
    }

    for (const token of DEAD_TOKENS) {
      if (line.includes(token)) {
        violations.push({
          rule: "S2",
          rel,
          no,
          text: line.trim(),
          why: `\`${token}\` does not exist in this app — describe the shape in words instead`,
        });
      }
    }
  });

  return { violations, fences };
}

/** Walk the roots, grade every file, and add the anti-vacuity findings. */
export function run(root = projectRoot) {
  const roots = ROOT_DIRS.map((d) => join(root, ...d));
  const files = roots.flatMap(walk).sort();
  const violations = [];
  let fenceCount = 0;

  for (const file of files) {
    const result = scanFile(relative(root, file), readFileSync(file, "utf8"));
    violations.push(...result.violations);
    fenceCount += result.fences;
  }

  if (files.length < MIN_FILES) {
    violations.push({
      rule: "S3",
      rel: ROOT_DIRS.map((d) => d.join("/")).join(" + "),
      no: 0,
      text: `${files.length} markdown files found`,
      why: `expected at least ${MIN_FILES} — the scan roots moved and this gate was checking nothing`,
    });
  }
  if (files.length && fenceCount === 0) {
    violations.push({
      rule: "S3",
      rel: "(all)",
      no: 0,
      text: "no fenced code blocks found",
      why: "the fence parser matched nothing, so S1 graded nothing",
    });
  }

  return { files, fenceCount, violations };
}

/* Run only as a CLI, so importing this file in a test costs nothing. */
if (process.argv[1] && process.argv[1].endsWith("skill-lint.mjs")) {
  const { files, fenceCount, violations } = run();

  for (const v of violations) {
    console.error(`${v.rel}:${v.no}  [${v.rule}] ${v.why}\n    ${v.text}`);
  }

  if (violations.length) {
    console.error(`\nskill-lint: ${violations.length} violation(s) in ${files.length} files.`);
    process.exit(1);
  }

  console.log(
    `skill-lint: ${files.length} files, ${fenceCount} code blocks — instructions match the app.`,
  );
}
