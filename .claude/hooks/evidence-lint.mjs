#!/usr/bin/env node
/**
 * evidence-lint — a `passing` feature quotes what its verification printed, and
 * the quote is really in the output.
 *
 * `feature_list.json` evidence used to be free text: "tests pass", "verified
 * manually", a path to a markdown file. Every one of those reads the same
 * whether the command ran or not, so a status could be flipped to `passing` by
 * someone who never executed anything and nothing downstream could tell.
 *
 * The shape this gate asks for is one line per claim:
 *
 *     "make check -> Tests  42 passed (42)"
 *      ^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^
 *      the command   its final result line, quoted verbatim
 *
 * and for a feature that became `passing` since HEAD, at least one quoted result
 * line has to appear in `.harness/last-check.log` — the full output of the last
 * `make check`, written by the Stop hook and by `commit-feature` whenever they
 * run it. A quote that is not in the log was typed, not copied.
 *
 * Migration: features that were already `passing` in HEAD are grandfathered.
 * Free-text evidence on them prints a WARN and never fails, so adopting this
 * gate does not turn a repository with history red. Only a new transition to
 * `passing` is held to the shape. `--all` holds every passing feature to it.
 *
 *   node .claude/hooks/evidence-lint.mjs                 # project = git root
 *   node .claude/hooks/evidence-lint.mjs --project <dir>
 *   node .claude/hooks/evidence-lint.mjs --ids a-001,b-002 --json
 *
 * Exit 0 clean (warnings allowed), 1 at least one error. Node stdlib only.
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LOG_PATH = ".harness/last-check.log";

/** A command a person or a hook can actually run, at the start of the claim. */
const COMMAND_RE = /^(?:make|npm|npx|pnpm|yarn|node|flutter|dart|bash|sh|\.\/|firebase|vitest|playwright)\b/;

/**
 * `"<command> -> <result line>"`, or null when the entry is free text.
 * The arrow may be `->` or `→`; quotes or backticks around the result are
 * stripped because people paste them either way.
 */
export function parseEvidence(entry) {
  if (typeof entry !== "string") return null;
  const m = entry.match(/^\s*`?(.+?)`?\s+(?:->|→)\s+(.+?)\s*$/);
  if (!m) return null;
  const command = m[1].trim();
  if (!COMMAND_RE.test(command)) return null;
  const result = m[2].trim().replace(/^["'`](.*)["'`]$/, "$1").trim();
  if (!result) return null;
  return { command, result };
}

/** Collapse runs of whitespace and strip ANSI colour, so a copied line matches. */
function normalise(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*m/g, "").replace(/[ \t]+/g, " ");
}

export function lintEvidence({ features, newlyPassing, log, all = false }) {
  const errors = [];
  const warnings = [];
  const logText = log == null ? null : normalise(log);

  for (const f of features) {
    if (f?.status !== "passing") continue;
    const entries = Array.isArray(f.evidence) ? f.evidence : f.evidence ? [f.evidence] : [];
    const parsed = entries.map(parseEvidence).filter(Boolean);
    const enforce = all || newlyPassing.has(f.id);

    if (!parsed.length) {
      const msg =
        `${f.id}: no evidence entry names a command and quotes its result ` +
        `(expected e.g. "make check -> <final line it printed>")`;
      (enforce ? errors : warnings).push(msg);
      continue;
    }
    if (!enforce) continue;

    if (logText == null) {
      errors.push(`${f.id}: ${LOG_PATH} does not exist — run \`make check\` so the quoted result can be verified`);
      continue;
    }
    const found = parsed.filter((p) => logText.includes(normalise(p.result)));
    if (!found.length) {
      errors.push(
        `${f.id}: none of its quoted results appear in ${LOG_PATH} ` +
          `(${parsed.map((p) => JSON.stringify(p.result)).join(", ")}) — quote a line \`make check\` actually printed`,
      );
    }
    for (const p of parsed) {
      if (/^make check\b/.test(p.command) && !logText.includes(normalise(p.result))) {
        errors.push(`${f.id}: claims \`${p.command}\` printed ${JSON.stringify(p.result)}, which is not in ${LOG_PATH}`);
      }
    }
  }
  return { errors, warnings };
}

function sh(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function featuresOf(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : (parsed.features ?? []);
  } catch {
    return null;
  }
}

/** Ids passing in the working copy and not passing in HEAD. */
export function newlyPassingIds(project) {
  const now = featuresOf(readFileSync(join(project, "feature_list.json"), "utf8")) ?? [];
  let before = [];
  try {
    const root = sh("git rev-parse --show-toplevel", project).trim();
    const rel = relative(root, join(project, "feature_list.json")) || "feature_list.json";
    before = featuresOf(sh(`git show HEAD:${rel}`, root)) ?? [];
  } catch {
    before = [];
  }
  const was = new Map(before.filter((f) => f?.id).map((f) => [f.id, f.status]));
  return new Set(now.filter((f) => f?.status === "passing" && was.get(f.id) !== "passing").map((f) => f.id));
}

function main() {
  const args = process.argv.slice(2);
  const arg = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
  };
  let project = arg("--project");
  if (!project) {
    try {
      project = sh("git rev-parse --show-toplevel", process.cwd()).trim();
    } catch {
      project = process.cwd();
    }
  }
  project = resolve(project);
  const register = join(project, "feature_list.json");
  if (!existsSync(register)) {
    console.log("evidence-lint: no feature_list.json here — nothing to check.");
    process.exit(0);
  }
  const features = featuresOf(readFileSync(register, "utf8"));
  if (!features) {
    console.error("evidence-lint: feature_list.json does not parse");
    process.exit(1);
  }
  const ids = arg("--ids");
  const newlyPassing = ids ? new Set(ids.split(",").map((s) => s.trim()).filter(Boolean)) : newlyPassingIds(project);
  const logFile = join(project, LOG_PATH);
  const log = existsSync(logFile) ? readFileSync(logFile, "utf8") : null;
  const { errors, warnings } = lintEvidence({ features, newlyPassing, log, all: args.includes("--all") });

  if (args.includes("--json")) {
    console.log(JSON.stringify({ project, checked: features.filter((f) => f?.status === "passing").length, errors, warnings }, null, 2));
  } else {
    for (const w of warnings) console.log(`  WARN ${w}`);
    for (const e of errors) console.log(`  FAIL ${e}`);
    const checked = features.filter((f) => f?.status === "passing").length;
    console.log(
      `evidence-lint: ${checked} passing feature(s), ${newlyPassing.size} newly passing, ` +
        `${errors.length} error(s), ${warnings.length} warning(s)`,
    );
  }
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
