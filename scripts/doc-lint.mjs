#!/usr/bin/env node
/**
 * doc-lint — how much does a session cost before it does anything, and is any
 * of it false?
 *
 * An instruction file earns its place only if an agent would get the task wrong
 * without it and cannot get it right cheaply from the repo itself. Nothing
 * mechanical can judge that sentence by sentence, but the three ways it goes
 * wrong are all measurable:
 *
 *   too big      — a 600-line instruction file spends 10-20K tokens of a finite
 *                  window, and the middle of a long file is the part models use
 *                  least, so a constraint buried at line 400 is a constraint
 *                  nobody applies
 *   duplicated   — this repo's CLAUDE.md says outright that it mirrors
 *                  AGENTS.md, so both are loaded and one is redundant by policy
 *   expired      — create-nestjs-app's shipped instructions have sections on
 *                  Firebase Authentication and TypeORM Repository Methods, in a
 *                  project that uses Better Auth and Prisma
 *
 * Rules:
 *   D1  AGENTS.md is within budget
 *   D2  CLAUDE.md is within budget and is not a copy of AGENTS.md
 *   D3  ARCHITECTURE.md exists and is within budget
 *   D4  claude-progress.md is state, not an append-only log
 *   D5  the whole session prelude is within budget
 *   D6  the instructions describe this project and not a different one
 *   D7  the documents do not link to files that are not there
 *   D8  every hard constraint names the failure it prevents
 *   D9  every passing feature's evidence is where the register says it is
 *
 * `--strict` exits 1 on any violation. That is how it runs in `make check`,
 * here and in every generated project — a budget nothing enforces is a budget
 * that grows back, and each of doc-001..doc-005 was a cleanup with a shelf life
 * until this made it a floor.
 *
 *   node scripts/doc-lint.mjs [dir]      # default: cwd
 *   node scripts/doc-lint.mjs --all      # the root plus every scaffolder tree
 *   node scripts/doc-lint.mjs --strict
 *
 * This file is stamped into every scaffold source tree, so it runs against a
 * generated project too. `--all` is the repository's own mode and is a no-op
 * where there is no `scaffolders/` directory to walk.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------- budgets ---
// Sized from the lecture's 50-200 line entry file, then tightened per role: the
// contract is the only one an agent must hold in full, the pointer exists to
// stop being a copy, and the state file is a snapshot rather than a history.
export const BUDGETS = {
  "AGENTS.md": 150,
  "CLAUDE.md": 30,
  "ARCHITECTURE.md": 150,
  "claude-progress.md": 120,
};

// Everything a session is told to read before its first useful action.
const PRELUDE = ["AGENTS.md", "CLAUDE.md", "claude-progress.md", "feature_list.json"];
const PRELUDE_BUDGET_BYTES = 40 * 1024;

// Mutually exclusive stack choices. Naming the wrong one is not stale prose —
// it points an agent at a library the project cannot import.
const STACK_CHOICES = {
  typeorm: ["typeorm", "@nestjs/typeorm"],
  sequelize: ["sequelize"],
  mongoose: ["mongoose", "@nestjs/mongoose"],
  prisma: ["prisma", "@prisma/client"],
  drizzle: ["drizzle-orm"],
  knex: ["knex"],
  firebase: ["firebase", "firebase-admin", "@firebase/app"],
  auth0: ["auth0", "@auth0/auth0-react"],
  passport: ["passport", "@nestjs/passport"],
  "better-auth": ["better-auth"],
  clerk: ["@clerk/clerk-sdk-node", "@clerk/nextjs"],
  supabase: ["@supabase/supabase-js"],
};

export function lint(root) {
  const violations = [];
  const notes = [];
  const fail = (rule, message) => violations.push({ rule, message });

  const abs = (rel) => path.join(root, rel);
  const exists = (rel) => fs.existsSync(abs(rel));
  const read = (rel) => (exists(rel) ? fs.readFileSync(abs(rel), "utf8") : null);
  const lines = (text) => text.split("\n").length;

  // A project that is not harnessed at all is not this rule set's business.
  if (!exists("AGENTS.md") && !exists("CLAUDE.md")) {
    return { violations, notes: ["no AGENTS.md or CLAUDE.md — not a harnessed project"], stats: null };
  }

  // Claude Code loads `.claude/CLAUDE.md` as well as a root `CLAUDE.md`, and
  // several projects here keep their real instructions in the former.
  // On a case-insensitive filesystem `.claude/CLAUDE.md` and `.claude/claude.md`
  // are one file with two names, and counting it twice doubles every finding in
  // it. Deduplicate by what the path actually resolves to.
  const claudeCandidates = ["CLAUDE.md", ".claude/CLAUDE.md", ".claude/claude.md"];
  const seenReal = new Set();
  const claudeFiles = claudeCandidates.filter((c) => {
    if (!exists(c)) return false;
    // realpath does not normalise case on a case-insensitive volume, so compare
    // the inode: that is the same number for both spellings of one file.
    const { dev, ino } = fs.statSync(abs(c));
    const key = `${dev}:${ino}`;
    if (seenReal.has(key)) return false;
    seenReal.add(key);
    return true;
  });

  const agents = read("AGENTS.md");
  const stats = { files: {}, preludeBytes: 0 };

  // ----------------------------------------------------------------- D1 ---
  if (agents === null) {
    fail("D1", "no AGENTS.md — the contract every agent reads first is missing");
  } else {
    stats.files["AGENTS.md"] = lines(agents);
    if (lines(agents) > BUDGETS["AGENTS.md"]) {
      fail(
        "D1",
        `AGENTS.md is ${lines(agents)} lines, budget ${BUDGETS["AGENTS.md"]}. ` +
          `It is the one file read in full every session, so what it holds has to be the contract and not the history.`,
      );
    }
  }

  // ----------------------------------------------------------------- D2 ---
  for (const rel of claudeFiles) {
    const claude = read(rel);
    stats.files[rel] = lines(claude);
    if (lines(claude) > BUDGETS["CLAUDE.md"]) {
      fail(
        "D2",
        `${rel} is ${lines(claude)} lines, budget ${BUDGETS["CLAUDE.md"]}. ` +
          `It is auto-loaded on top of AGENTS.md, so it should carry only what is specific to this harness — the skills, the hooks, the env switches — and link out for the rest.`,
      );
    }
    if (agents) {
      const shared = sharedParagraphs(claude, agents);
      if (shared.length) {
        fail(
          "D2",
          `${rel} repeats ${shared.length} paragraph(s) verbatim from AGENTS.md, so both are loaded and one is redundant. ` +
            `First: "${truncate(shared[0], 90)}"`,
        );
      }
    }
  }

  // ----------------------------------------------------------------- D3 ---
  const archCandidates = ["ARCHITECTURE.md", "docs/ARCHITECTURE.md"];
  const arch = archCandidates.find((c) => exists(c));
  if (!arch) {
    fail(
      "D3",
      `no ARCHITECTURE.md — without a map of where things live and how a request flows, that knowledge ends up inlined into the instruction file, which is how an entry file grows past a thousand lines.`,
    );
  } else {
    const text = read(arch);
    stats.files[arch] = lines(text);
    if (lines(text) > BUDGETS["ARCHITECTURE.md"]) {
      fail("D3", `${arch} is ${lines(text)} lines, budget ${BUDGETS["ARCHITECTURE.md"]}.`);
    }
    // The failure mode specific to this document: reproducing files that exist.
    const fenced = [...text.matchAll(/```[\w]*\n([\s\S]*?)```/g)].map((m) => m[1]);
    const big = fenced.filter((f) => f.split("\n").length > 20);
    if (big.length) {
      fail(
        "D3",
        `${arch} contains ${big.length} code block(s) over 20 lines. A map points at the file; it does not reproduce it, because a copy of code is a copy that goes stale.`,
      );
    }
  }

  // ----------------------------------------------------------------- D4 ---
  const progress = read("claude-progress.md");
  if (progress !== null) {
    stats.files["claude-progress.md"] = lines(progress);
    if (lines(progress) > BUDGETS["claude-progress.md"]) {
      const sessions = (progress.match(/^##\s+Session/gm) ?? []).length;
      fail(
        "D4",
        `claude-progress.md is ${lines(progress)} lines across ${sessions} session entries, budget ${BUDGETS["claude-progress.md"]}. ` +
          `Its job is what is true now and what is next; the narrative of finished sessions belongs in docs/history/ and in the commit messages that already carry it.`,
      );
    }
  }

  // ----------------------------------------------------------------- D5 ---
  for (const rel of PRELUDE) {
    if (exists(rel)) stats.preludeBytes += fs.statSync(abs(rel)).size;
  }
  for (const rel of claudeFiles) {
    if (rel !== "CLAUDE.md") stats.preludeBytes += fs.statSync(abs(rel)).size;
  }
  if (stats.preludeBytes > PRELUDE_BUDGET_BYTES) {
    fail(
      "D5",
      `the session prelude is ${kb(stats.preludeBytes)}, budget ${kb(PRELUDE_BUDGET_BYTES)} — ` +
        `read in full before the first useful action, every session.`,
    );
  }

  // ----------------------------------------------------------------- D6 ---
  // The instructions describe this project, and not a different one.
  const pkg = safeJson(read("package.json"));
  const deps = new Set([
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
  ]);
  const scripts = new Set(Object.keys(pkg?.scripts ?? {}));
  const makeTargets = new Set(
    [...(read("Makefile") ?? "").matchAll(/^([a-z][\w-]*):/gm)].map((m) => m[1]),
  );

  for (const rel of [...claudeFiles, "AGENTS.md", arch].filter(Boolean)) {
    const text = read(rel);
    if (!text) continue;
    const at = () => `${rel}`;

    for (const block of text.matchAll(/```(?:ts|typescript|js|javascript)\n([\s\S]*?)```/g)) {
      const code = block[1];

      // D6a — a relative import naming a file that is not there. This is the
      // sharpest signal: the sample was written against a tree that has since
      // changed, so following it produces a module-not-found.
      for (const m of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        if (resolvesSomewhere(root, m[1])) continue;
        fail(
          "D6",
          `${at()}: a code sample imports "${m[1]}", which does not resolve to any file in this project. ` +
            `Following this instruction produces a module-not-found.`,
        );
      }

      // D6b — a bare package import that is not a dependency.
      if (deps.size) {
        for (const m of code.matchAll(/from\s+['"]([^.'"][^'"]*)['"]/g)) {
          const spec = m[1];
          const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
          if (name.startsWith("node:") || NODE_BUILTINS.has(name)) continue;
          if (deps.has(name)) continue;
          fail(
            "D6",
            `${at()}: a code sample imports "${name}", which is not a dependency of this project.`,
          );
        }
      }
    }

    // D6c — a heading naming a stack choice the project did not make. Two ORMs
    // or two auth providers in one instruction file is not stale prose; it is a
    // pointer at a library that cannot be imported.
    if (deps.size) {
      for (const m of text.matchAll(/^#{2,4}\s+(.+)$/gm)) {
        const heading = m[1];
        for (const [choice, packages] of Object.entries(STACK_CHOICES)) {
          const named = new RegExp(`\\b${choice.replace("-", "[- ]?")}\\b`, "i").test(heading);
          if (!named) continue;
          if (packages.some((p) => deps.has(p))) continue;
          fail(
            "D6",
            `${at()}: the heading "${heading.trim()}" documents ${choice}, which this project does not depend on. ` +
              `An agent reading it is being told to use a library that is not installed.`,
          );
        }
      }
    }

    // D6d — a command the instructions tell you to run that does not exist.
    for (const m of text.matchAll(/`(?:npm run|yarn)\s+([\w:.-]+)`/g)) {
      if (scripts.size && !scripts.has(m[1])) {
        fail("D6", `${at()}: documents \`npm run ${m[1]}\`, which package.json does not define.`);
      }
    }
    for (const m of text.matchAll(/`make\s+([a-z][\w-]*)`/g)) {
      if (makeTargets.size && !makeTargets.has(m[1])) {
        fail("D6", `${at()}: documents \`make ${m[1]}\`, which the Makefile does not define.`);
      }
    }
  }

  // ----------------------------------------------------------------- D7 ---
  for (const rel of [...claudeFiles, "AGENTS.md", arch, "claude-progress.md"].filter(Boolean)) {
    const text = read(rel);
    if (!text) continue;
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)#:]+\.(?:md|json|mjs|ts|sh))(?:#[^)]*)?\)/g)) {
      const target = m[1];
      if (target.startsWith("http")) continue;
      const resolved = path.resolve(path.dirname(abs(rel)), target);
      if (!fs.existsSync(resolved)) {
        fail("D7", `${rel} links to ${target}, which is not there.`);
      }
    }
  }

  // ----------------------------------------------------------------- D8 ---
  // A rule whose consequence nobody can name is a rule nobody can weigh, and
  // unweighable rules are how a file reaches a thousand lines.
  if (agents) {
    const section = sectionUnder(agents, /^##\s+(hard\s+)?(constraints|rules)\b/im);
    if (section) {
      // A constraint is usually several lines — the marker starts it and the
      // reason lands two lines down. Checking each line on its own would report
      // every wrapped bullet as unexplained.
      const bullets = [];
      for (const line of section.split("\n")) {
        if (/^\s*[-*]\s|^\s*\d+\.\s/.test(line)) bullets.push(line);
        else if (bullets.length && line.trim()) bullets[bullets.length - 1] += ` ${line.trim()}`;
      }
      const unexplained = bullets.filter((b) => !/—|--|\bbecause\b|\bso that\b|\botherwise\b/i.test(b));
      if (unexplained.length) {
        fail(
          "D8",
          `AGENTS.md has ${unexplained.length} constraint(s) that do not say what goes wrong without them. ` +
            `First: "${truncate(unexplained[0].trim(), 90)}"`,
        );
      }
      if (bullets.length > 15) {
        fail("D8", `AGENTS.md lists ${bullets.length} constraints; past about 15 they stop being read as constraints.`);
      }
    } else {
      notes.push("AGENTS.md has no constraints section for D8 to check");
    }
  }

  // ----------------------------------------------------------------- D9 ---
  // Only meaningful once evidence has been split out of the register.
  const evidenceDir = abs("docs/evidence");
  if (fs.existsSync(evidenceDir)) {
    const list = safeJson(read("feature_list.json"));
    const features = Array.isArray(list) ? list : (list?.features ?? []);
    // A finished feature leaves the register for docs/history/completed-features.md
    // so the prelude stops growing by one stub per completed feature. The
    // pairing evidence has to satisfy is therefore register OR archive — and a
    // project with no archive (every scaffolded one) reads this as an empty set.
    const archivedIds = new Set(
      [...(read("docs/history/completed-features.md") ?? "").matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]),
    );
    const onDisk = new Set(
      fs.readdirSync(evidenceDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")),
    );
    for (const f of features) {
      if (f?.status !== "passing") continue;
      if (!onDisk.has(f.id)) fail("D9", `${f.id} is passing but docs/evidence/${f.id}.md is missing.`);
      if (archivedIds.has(f.id)) {
        fail("D9", `${f.id} is in both feature_list.json and the completed-features archive — two answers to whether it is done.`);
      }
    }
    // A feature finished in parts names each part's file in its own evidence
    // list (rn-010 lists rn-010a.md): that file is paired, with that feature.
    const linked = new Set(
      features.flatMap((f) => (Array.isArray(f?.evidence) ? f.evidence : []))
        .map((e) => /^docs\/evidence\/([^/\s]+)\.md$/.exec(String(e))?.[1])
        .filter(Boolean),
    );
    for (const id of onDisk) {
      if (!features.some((f) => f?.id === id) && !archivedIds.has(id) && !linked.has(id)) {
        fail("D9", `docs/evidence/${id}.md has no feature ${id} in the register or the archive.`);
      }
    }
  } else {
    notes.push("no docs/evidence/ — D9 does not apply until evidence is split out of the register");
  }

  return { violations, notes, stats };
}

// ------------------------------------------------------------------ helpers --
const NODE_BUILTINS = new Set([
  "fs", "path", "os", "url", "util", "crypto", "http", "https", "net", "events",
  "stream", "child_process", "assert", "buffer", "zlib", "readline", "process",
]);

function safeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A relative import with no extension can be .ts, .js, /index.ts, and so on. */
function resolvesSomewhere(root, spec) {
  const bases = ["src", "", "test"];
  const exts = ["", ".ts", ".tsx", ".js", ".mjs", ".json", "/index.ts", "/index.js"];
  const cleaned = spec.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
  for (const base of bases) {
    for (const ext of exts) {
      if (fs.existsSync(path.join(root, base, cleaned + ext))) return true;
    }
  }
  return false;
}

/** Paragraphs of `a` that also appear in `b`, ignoring whitespace and headings. */
function sharedParagraphs(a, b) {
  const norm = (t) =>
    t
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      // Short lines collide by accident; a shared heading is not duplication.
      .filter((p) => p.length > 80 && !p.startsWith("#"));
  const inB = new Set(norm(b));
  return norm(a).filter((p) => inB.has(p));
}

/** The body of the first section whose heading matches, up to the next `##`. */
function sectionUnder(text, headingRe) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ------------------------------------------------------------------- main ---
// Only when run as a command. `lint()` is imported by the test suite, and a
// module that calls process.exit on import takes the test runner down with it.
const RUN_AS_CLI =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (RUN_AS_CLI) main();

function main() {
const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const ALL = args.includes("--all");
const targetArg = args.find((a) => !a.startsWith("--"));

// `--all` is only meaningful in the repository that holds the scaffolders. In a
// generated project the same flag lints that project, so a copied command line
// does something sensible instead of throwing ENOENT.
const scaffoldersDir = path.join(REPO_ROOT, "scaffolders");
const targets = ALL && fs.existsSync(scaffoldersDir)
  ? [
      REPO_ROOT,
      ...fs
        .readdirSync(scaffoldersDir)
        .flatMap((name) => {
          const base = path.join(scaffoldersDir, name);
          return [base, path.join(base, "boilerplate"), path.join(base, "template")];
        })
        .filter((p) => fs.existsSync(p)),
    ]
  : [path.resolve(targetArg ?? process.cwd())];

let total = 0;
const rows = [];

for (const target of targets) {
  const { violations, notes, stats } = lint(target);
  const label = path.relative(REPO_ROOT, target) || ".";
  if (!stats && !violations.length) continue;
  total += violations.length;
  rows.push({ label, violations, notes, stats });
}

console.log("\ndoc-lint — what a session costs before it does anything\n");

for (const { label, violations, stats } of rows) {
  const size = stats ? kb(stats.preludeBytes) : "—";
  const mark = violations.length === 0 ? "ok  " : `${String(violations.length).padStart(2)} ✗`;
  console.log(`  ${mark}  ${label.padEnd(46)} prelude ${size.padStart(9)}`);
}

if (total) {
  console.log("");
  for (const { label, violations } of rows) {
    if (!violations.length) continue;
    console.log(`\n${label}`);
    for (const v of violations) console.log(`  [${v.rule}] ${v.message}`);
  }
}

console.log(
  `\n${total} violation(s) across ${rows.length} target(s).` +
    (STRICT ? "" : " Reporting only — pass --strict to make this a gate."),
);

process.exit(STRICT && total ? 1 : 0);
}
