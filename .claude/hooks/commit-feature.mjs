#!/usr/bin/env node
/**
 * commit-feature — commit the work when a feature actually becomes `passing`.
 *
 * The harness already decides what "done" means: `feature_list.json` is the
 * register, and a feature only reaches `passing` with executed verification and
 * recorded evidence. What it never had was a moment where that decision becomes
 * a commit. Finished work sat in the working tree until somebody remembered,
 * which is how a session's evidence and the code it describes end up in
 * different commits — or in none.
 *
 * The trigger is precise on purpose: a feature that is `passing` **now** and was
 * not `passing` in `HEAD:feature_list.json`. Not "the tree is dirty", not "the
 * session ended" — the register changed its mind about a feature, which is the
 * one event that means a feature was completed.
 *
 * What it will not do:
 *   - push. Publishing is a separate decision, and this one is automatic.
 *   - commit without verification. `make check` runs first unless the caller
 *     passes --skip-check because it just ran it (that is what the Stop hook
 *     does in strict mode, where the check has already passed seconds earlier).
 *   - commit mid-merge, mid-rebase, or with a detached HEAD.
 *
 * Which project: the register, the Makefile and `docs/evidence/` are looked for
 * in the nearest directory at or above the working directory that has a
 * `feature_list.json`, stopping at the repository root. In a generated project
 * that is the repository root, which is what it always assumed. In a monorepo of
 * projects it is the one you are standing in — `scaffolders/create-flutter-app`
 * has its own register, its own Makefile and its own evidence, and reading the
 * root's instead meant `make commit-feature` there could never see the feature
 * that had just passed. Git still runs from the root, and only that project's
 * paths are staged, so a commit cannot pick up unrelated work elsewhere in the
 * tree.
 *
 * Usage:
 *   node .claude/hooks/commit-feature.mjs             # verify, then commit
 *   node .claude/hooks/commit-feature.mjs --dry-run   # show the commit, write nothing
 *   node .claude/hooks/commit-feature.mjs --skip-check
 *   node .claude/hooks/commit-feature.mjs --skip-check --verified-by "make test + smoke"
 *   node .claude/hooks/commit-feature.mjs --project scaffolders/create-flutter-app
 *
 * --skip-check writes "`make check` was green immediately before this commit"
 * into the message. When that is not the whole truth — a repo whose full check
 * is red for a documented, unrelated reason — pass --verified-by to state what
 * actually ran instead. A commit should not claim a check nobody performed.
 *
 * Env:
 *   ROCKETSHIP_AUTOCOMMIT=0        disable entirely (the Stop hook honours this)
 *   ROCKETSHIP_COMMIT_TRAILER=...  extra trailer line, e.g. a Co-Authored-By
 *
 * Exit codes: 0 nothing to do or committed; 1 refused (reason on stderr).
 * Dependency-free: Node stdlib only.
 */
import { readFileSync, existsSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import { join, resolve, relative, dirname } from "node:path";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SKIP_CHECK = args.includes("--skip-check");
const VERIFIED_BY = (() => {
  const i = args.indexOf("--verified-by");
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
})();
const QUIET = args.includes("--quiet");
const PROJECT_ARG = (() => {
  const i = args.indexOf("--project");
  if (i === -1 || !args[i + 1] || args[i + 1].startsWith("--")) return null;
  const p = resolve(args[i + 1]);
  return existsSync(p) ? realpathSync(p) : p;
})();

const say = (msg) => { if (!QUIET) console.log(msg); };
const refuse = (msg) => { console.error(`commit-feature: ${msg}`); process.exit(1); };

if (process.env.ROCKETSHIP_AUTOCOMMIT === "0") {
  say("commit-feature: disabled by ROCKETSHIP_AUTOCOMMIT=0");
  process.exit(0);
}

function git(cmd, opts = {}) {
  return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

function gitQuiet(cmd) {
  try { return git(cmd); } catch { return null; }
}

// --- where are we ------------------------------------------------------------

// Through realpath, both of them: on macOS the repository root comes back as
// /private/var/... while the working directory is /var/..., and a project path
// measured against the other spelling produces a `..` relative path that names
// no file in the repository at all.
const rootRaw = gitQuiet("rev-parse --show-toplevel");
if (!rootRaw) refuse("not a git repository");
const root = realpathSync(rootRaw);

/** The nearest directory at or above `from` that holds a register, up to `stop`. */
function nearestProject(from, stop) {
  let dir = realpathSync(resolve(from));
  for (;;) {
    if (existsSync(join(dir, "feature_list.json"))) return dir;
    if (dir === stop || dirname(dir) === dir) return null;
    dir = dirname(dir);
  }
}

const project = PROJECT_ARG ?? nearestProject(process.cwd(), root);
// Git commands run from the root so that every path in this script means the
// same thing whatever directory the caller was standing in.
process.chdir(root);

if (!project || !existsSync(join(project, "feature_list.json"))) {
  say("commit-feature: no feature_list.json here — nothing to watch");
  process.exit(0);
}

// "" at the root, "scaffolders/create-flutter-app" in a monorepo project. Used
// as a pathspec, so it also decides what a commit is allowed to contain.
const rel = relative(root, project).split("\\").join("/");
const scope = rel || ".";
const registerPath = rel ? `${rel}/feature_list.json` : "feature_list.json";
const where = rel ? ` in ${rel}` : "";

// A commit made in the middle of a merge or rebase is a commit nobody meant.
for (const [file, what] of [
  ["MERGE_HEAD", "a merge is in progress"],
  ["REBASE_HEAD", "a rebase is in progress"],
  ["CHERRY_PICK_HEAD", "a cherry-pick is in progress"],
]) {
  if (existsSync(join(root, ".git", file))) refuse(`${what} — finish it first`);
}

const branch = gitQuiet("rev-parse --abbrev-ref HEAD");
if (!branch || branch === "HEAD") refuse("detached HEAD — check out a branch first");

// --- what changed its mind ---------------------------------------------------

function features(json) {
  try {
    const parsed = JSON.parse(json);
    const list = Array.isArray(parsed) ? parsed : (parsed.features ?? []);
    return new Map(list.filter((f) => f?.id).map((f) => [f.id, f]));
  } catch {
    return null;
  }
}

const now = features(readFileSync(join(project, "feature_list.json"), "utf8"));
if (!now) refuse(`${registerPath} is not valid JSON`);

const headJson = gitQuiet(`show HEAD:${registerPath}`);
// No HEAD copy means the very first commit; treat everything already passing as
// history rather than as eleven features completed in one session.
const before = headJson === null ? now : features(headJson);
if (!before) refuse(`the committed ${registerPath} is not valid JSON`);

const completed = [...now.values()].filter(
  (f) => f.status === "passing" && before.get(f.id)?.status !== "passing",
);

if (completed.length === 0) {
  say(`commit-feature: no feature reached \`passing\`${where} since the last commit — nothing to do`);
  process.exit(0);
}

const changed = gitQuiet(`status --porcelain -- ${scope}`) || "";
if (!changed.trim()) {
  say("commit-feature: the register moved but the tree is clean — already committed");
  process.exit(0);
}

const fileCount = changed.split("\n").filter(Boolean).length;
const ids = completed.map((f) => f.id).join(", ");
say(
  `commit-feature: ${completed.length} feature(s) newly passing${where} (${ids}), ${fileCount} path(s) changed`,
);

// --- verify ------------------------------------------------------------------

if (!SKIP_CHECK) {
  if (!existsSync(join(project, "Makefile"))) {
    refuse("no Makefile to verify with — re-run with --skip-check if that is deliberate");
  }
  say(`commit-feature: running \`make check\`${where} before committing…`);
  try {
    // Tee the output to .harness/last-check.log: evidence-lint verifies a
    // feature's quoted result line against it. pipefail keeps make's exit code.
    mkdirSync(join(project, ".harness"), { recursive: true });
    writeFileSync(join(project, ".harness", ".gitignore"), "*\n");
    execSync("set -o pipefail; make check 2>&1 | tee .harness/last-check.log", {
      cwd: project,
      shell: "/bin/bash",
      stdio: QUIET ? ["ignore", "pipe", "pipe"] : "inherit",
    });
  } catch (err) {
    const tail = ((err.stdout?.toString() || "") + (err.stderr?.toString() || "")).slice(-1200);
    refuse(
      "`make check` failed — a feature is not `passing` until it verifies, so nothing was committed." +
        (tail ? `\n${tail}` : ""),
    );
  }
}

// --- the message -------------------------------------------------------------

function wrap(text, width = 76) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if ((line + " " + word).trim().length > width) { out.push(line.trim()); line = word; }
      else line = (line + " " + word).trim();
    }
    out.push(line.trim());
  }
  return out.join("\n");
}

const primary = completed[0];
/**
 * A feature's behaviour and evidence, wherever they live.
 *
 * The register used to hold both inline, which made it 84% finished history and
 * 246 KB — read in full at the start of every session. Completed features now
 * keep a stub there and their record in `docs/evidence/<id>.md`, so this reads
 * the register first and falls back to the file.
 */
function recordFor(f) {
  // Two registers spell the same field two ways — `evidence` at the root,
  // `verification` in every scaffolder — and reading only the first meant a
  // scaffolder's commit body carried its behaviour and none of its proof.
  const bullets = f.evidence ?? f.verification;
  const inline = {
    behaviour: f.user_visible_behavior ?? null,
    evidence: Array.isArray(bullets) ? bullets : bullets ? [bullets] : [],
  };
  if (inline.behaviour || inline.evidence.length) return inline;

  const docPath = join(project, "docs", "evidence", `${f.id}.md`);
  if (!existsSync(docPath)) return inline;
  const doc = readFileSync(docPath, "utf8");
  return {
    behaviour: firstSection(doc, ["What changed", "What ships"]),
    evidence: bulletsOf(firstSection(doc, ["Evidence", "Verification", "How it was verified"]) ?? ""),
  };
}

/**
 * The bullets of a markdown list, each rejoined with its wrapped continuation
 * lines. Taking only the line that starts with "- " truncates every bullet at
 * the first line break, which is how the first commit written this way lost
 * half of each sentence.
 */
function bulletsOf(section) {
  const out = [];
  for (const line of section.split("\n")) {
    if (line.startsWith("- ")) out.push(line.slice(2).trim());
    else if (out.length && line.trim()) out[out.length - 1] += ` ${line.trim()}`;
  }
  return out;
}

/** The first of several headings a document actually uses. */
function firstSection(doc, headings) {
  for (const h of headings) {
    const found = sectionOf(doc, h);
    if (found) return found;
  }
  return null;
}

/** The body of one `## Heading` section, up to the next `##`. */
function sectionOf(doc, heading) {
  const lines = doc.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim() || null;
}

const area = primary.area ? `(${primary.area})` : "";
const subject = `feat${area}: ${primary.title}${completed.length === 1 ? ` (${primary.id})` : ""}`;

const body = [];
if (completed.length > 1) {
  body.push(wrap(`Completes ${completed.length} features: ${ids}.`), "");
}
for (const f of completed) {
  if (completed.length > 1) body.push(`${f.id} — ${f.title}`, "");
  const record = recordFor(f);
  if (record.behaviour) body.push(wrap(record.behaviour), "");
  const evidence = record.evidence.slice(0, 4);
  if (evidence.length) {
    // A tight list: one blank line after the bullets, not between them.
    for (const e of evidence) body.push(wrap(`- ${e}`, 74).replace(/\n/g, "\n  "));
    body.push("");
  }
}
body.push(
  wrap(
    VERIFIED_BY
      ? `Verified: ${VERIFIED_BY}`
      : SKIP_CHECK
        ? "Verified: `make check` was green immediately before this commit."
        : "Verified: `make check` ran green as part of this commit.",
  ),
);
if (process.env.ROCKETSHIP_COMMIT_TRAILER) {
  body.push("", process.env.ROCKETSHIP_COMMIT_TRAILER);
}

const message = [subject, "", ...body].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

// --- commit ------------------------------------------------------------------

if (DRY) {
  say("commit-feature: --dry-run, nothing written. The commit would be:\n");
  console.log(message);
  say("Paths that would be staged:");
  console.log(changed);
  process.exit(0);
}

try {
  execFileSync("git", ["add", "-A", "--", scope], { stdio: ["ignore", "pipe", "pipe"] });
  execFileSync("git", ["commit", "-m", message], { stdio: ["ignore", "pipe", "pipe"] });
} catch (err) {
  const tail = ((err.stdout?.toString() || "") + (err.stderr?.toString() || "")).slice(-800);
  refuse(`git refused the commit:\n${tail}`);
}

const sha = gitQuiet("rev-parse --short HEAD");
say(`commit-feature: committed ${sha} on ${branch} — ${ids}. Not pushed; publishing stays a decision.`);
