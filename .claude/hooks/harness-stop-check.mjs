#!/usr/bin/env node
/**
 * Stop harness hook (rocketship) — enforce clean-state-checklist, not advisory
 * markdown. Blocks a dirty exit so the harness primitive can't be bypassed.
 *
 * Two tiers (chosen 2026-07-01, see DECISIONS.md harness-004):
 *   1. ALWAYS (cheap, deterministic): scan THIS SESSION'S changes (the working
 *      tree diff vs HEAD) for unambiguous debug artifacts — `debugger`
 *      statements, `console.log`/`console.debug`, and `TODO(me)`/`FIXME(me)`
 *      scratch markers. Scanning the diff (not the whole repo) means legitimate
 *      logging already in the boilerplate never traps the agent — only debug
 *      code the session ADDED does. A `console.log` under `scripts/`, `tool/`
 *      or `bin/` is exempt: those are command-line programs and stdout is how
 *      they report, so the rule was firing on the success line of every passing
 *      gate.
 *   2. DEFAULT when a feature reached `passing` since the last commit and the
 *      tree is dirty: run `make check` (output to .harness/last-check.log), then
 *      evidence-lint (the evidence must quote a line that log contains), then
 *      commit via commit-feature. Any failure blocks. `HARNESS_STRICT=0` opts
 *      out and the hook only names the command; `HARNESS_STRICT=1` also runs
 *      `make check` on every stop. Ordinary turns with no completed feature
 *      stay fast. `ROCKETSHIP_AUTOCOMMIT=0` turns tiers 2 and 3 off.
 *
 * Blocking contract: prints {"decision":"block","reason":...} and exits 0.
 * Honors `stop_hook_active` on stdin to avoid an infinite stop loop. Fails open
 * (allows stop) on any internal error — the hook must never wedge a session.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOG_PATH = ".harness/last-check.log";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}");
} catch {
  payload = {};
}
// Already blocked once this turn — let the session stop to avoid a loop.
if (payload.stop_hook_active) process.exit(0);

// ── Tier 1: debug-artifact scan over this session's added lines ─────────────
function addedLines() {
  // Lines added in the working tree (staged + unstaged) relative to HEAD.
  let diff = "";
  try {
    diff = execSync("git diff HEAD --unified=0 --no-color", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return []; // no git repo / no HEAD → nothing to enforce, fail open
  }
  const out = [];
  let file = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      file = line.slice(6);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      out.push({ file, text: line.slice(1) });
    }
  }
  return out;
}

const SRC_RE = /\.(js|jsx|ts|tsx|mjs|cjs|dart|vue|svelte)$/;
const IS_TEST = /(\.(test|spec)\.|(^|\/)(test|tests|__tests__|e2e)\/)/;
// A command-line program's own output is not a debug print.
//
// Every gate in this repository is a script that reports what it found —
// `ui-lint: 58 components scanned, 0 violation(s)`, `web-probe: clean` — and
// stdout is the only channel it has. Flagging those made the rule fire on the
// success line of a passing gate, which is a false positive on the most
// ordinary change there is; and a rule that cries wolf on ordinary work is one
// that gets switched off, taking the real catches with it.
//
// Narrow on purpose: only `console.log`, and only in a directory that holds
// command-line entry points. `console.debug` says in its own name what it is
// for, and a `debugger` statement is never output, so both still block here.
const IS_CLI_OUTPUT = /(^|\/)(scripts|tool|bin)\//;
// ux-005: raw form elements are banned outside the design-system kit
// (components/ui = atom internals; chrome contents/ scripts are sandboxed from
// app styles and are a documented sanctioned exception). Only JSX files are
// scanned — lint configs and docs legitimately name the elements they ban.
const RAW_ELEMENT_RE = /<(button|input|select|textarea)(?=[\s/>])/;
const DS_EXEMPT_RE = /(^|\/)(components\/ui|src\/contents)\//;
const IS_JSX = /\.(tsx|jsx)$/;
const problems = [];
for (const { file, text } of addedLines()) {
  if (!file || !SRC_RE.test(file) || IS_TEST.test(file)) continue;
  if (/\bdebugger\b/.test(text)) problems.push(`${file}: debugger statement`);
  else if (
    /console\.(log|debug)\s*\(/.test(text) &&
    !(/console\.log\s*\(/.test(text) && IS_CLI_OUTPUT.test(file))
  )
    problems.push(`${file}: console.${/console\.debug/.test(text) ? "debug" : "log"}(...)`);
  else if (/\b(TODO|FIXME)\(me\)/.test(text))
    problems.push(`${file}: ${/FIXME/.test(text) ? "FIXME" : "TODO"}(me) scratch marker`);
  else if (IS_JSX.test(file) && !DS_EXEMPT_RE.test(file) && RAW_ELEMENT_RE.test(text))
    problems.push(
      `${file}: raw <${text.match(RAW_ELEMENT_RE)[1]}> — use the design-system atom (see docs/CONSTRAINTS.md "Design System Usage")`,
    );
}
if (problems.length) {
  const uniq = [...new Set(problems)].slice(0, 25);
  block(
    "clean-state-checklist: remove debug code added this session before stopping:\n  - " +
      uniq.join("\n  - ") +
      "\n(If a line is intentional, remove the debug marker or commit it deliberately.)",
  );
}

// ── Tier 2 + 3: a completed feature is verified, then becomes a commit ─────
//
// The register is the signal: a feature that is `passing` now and was not
// `passing` in HEAD means a feature was completed this session. If the tree is
// still dirty, that work is finished and uncommitted.
//
// Verification is the default, not an opt-in. When a feature has just reached
// `passing` the hook runs `make check` (output kept in .harness/last-check.log)
// and then evidence-lint, which requires the feature's evidence to quote a line
// that log really contains. `HARNESS_STRICT=0` skips both and falls back to
// naming the command; `HARNESS_STRICT=1` additionally runs `make check` on every
// stop, feature or not. A project with no Makefile has nothing to run, so it
// gets the naming block too.
const STRICT = process.env.HARNESS_STRICT;
const AUTOCOMMIT = process.env.ROCKETSHIP_AUTOCOMMIT !== "0";
const root = gitRoot();
const completed = newlyPassing();
const dirty = (() => {
  try {
    return execSync("git status --porcelain", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().length > 0;
  } catch {
    return false;
  }
})();
const featureDone = completed.length > 0 && dirty;
const canCheck = root !== null && existsSync(join(root, "Makefile"));
const wantCheck = canCheck && STRICT !== "0" && (STRICT === "1" || (featureDone && AUTOCOMMIT));

let checkPassed = false;
if (wantCheck) {
  const run = runMakeCheck(root);
  if (!run.ok) {
    block(
      "`make check` failed — a feature is not `passing` until it verifies" +
        ` (full output: ${LOG_PATH}):\n` +
        run.tail +
        "\n(Set HARNESS_STRICT=0 to skip verification in this hook.)",
    );
  }
  checkPassed = true;
  if (featureDone) {
    const lint = runEvidenceLint(root, completed);
    if (!lint.ok) {
      block(
        `evidence-lint refused ${completed.join(", ")} — evidence must name a command and quote ` +
          `its result line from ${LOG_PATH}:\n${lint.output}`,
      );
    }
  }
}

if (AUTOCOMMIT && featureDone) {
  const ids = completed.join(", ");
  const tool = ".claude/hooks/commit-feature.mjs";
  if (checkPassed) {
    // `make check` passed seconds ago and the evidence matches its output;
    // committing here costs nothing more.
    try {
      execSync(`node ${tool} --skip-check --quiet`, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      const tail =
        ((err.stdout?.toString() || "") + (err.stderr?.toString() || "")).slice(-1200) ||
        String(err.message || err);
      block(`auto-commit failed for ${ids} — the work is verified but uncommitted:\n${tail}`);
    }
  } else {
    block(
      `${ids} reached \`passing\` but the work is not committed.\n` +
        `Run \`node ${tool}\` — it runs \`make check\` first and refuses to commit if it fails.\n` +
        (canCheck
          ? "(HARNESS_STRICT=0 is set, so this hook did not verify it. ROCKETSHIP_AUTOCOMMIT=0 turns this off.)"
          : "(No Makefile at the repository root, so this hook could not verify it. ROCKETSHIP_AUTOCOMMIT=0 turns this off.)"),
    );
  }
}

process.exit(0);

/**
 * Feature ids that are `passing` now and were not `passing` in HEAD.
 *
 * Deliberately narrower than "the register changed": a title edit, a new
 * `not_started` row, or evidence added to an already-passing feature are all
 * ordinary bookkeeping, not a completion.
 */
function gitRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * `make check` with its whole output kept, because evidence-lint verifies the
 * quoted result against it. `.harness/` ignores itself so the log never makes a
 * clean tree look dirty or rides along in a commit.
 */
function runMakeCheck(cwd) {
  // One stream, in the order it was written. Reading stdout and stderr as two
  // pipes and concatenating them put every error after every success line, so
  // the log said a gate failed somewhere below the output of the gate after it.
  const r = spawnSync("sh", ["-c", "make check 2>&1"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}${r.error ? String(r.error) : ""}`;
  try {
    mkdirSync(join(cwd, ".harness"), { recursive: true });
    writeFileSync(join(cwd, ".harness", ".gitignore"), "*\n");
    writeFileSync(join(cwd, LOG_PATH), output);
  } catch {
    // an unwritable log is evidence-lint's problem to report, not a crash here
  }
  return { ok: r.status === 0, tail: output.slice(-1800) || "(no output)" };
}

function runEvidenceLint(cwd, ids) {
  const here = dirname(fileURLToPath(import.meta.url));
  const script = join(here, "evidence-lint.mjs");
  if (!existsSync(script)) return { ok: true, output: "" };
  const r = spawnSync("node", [script, "--project", cwd, "--ids", ids.join(",")], {
    cwd,
    encoding: "utf8",
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.slice(-1800) };
}

function newlyPassing() {
  const parse = (json) => {
    try {
      const parsed = JSON.parse(json);
      const list = Array.isArray(parsed) ? parsed : (parsed.features ?? []);
      return new Map(list.filter((f) => f?.id).map((f) => [f.id, f.status]));
    } catch {
      return null;
    }
  };
  let now, before;
  try {
    // Resolve the register from the repository root, not from the process's
    // working directory. `git show HEAD:feature_list.json` is always
    // root-relative, so reading the working copy relative to cwd compared two
    // different files whenever a session ran from a subdirectory — which is
    // every session that works on one scaffolder from inside another. It read
    // as "nothing completed" and the tier silently never fired.
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    now = parse(readFileSync(join(root, "feature_list.json"), "utf8"));
    before = parse(
      execSync("git show HEAD:feature_list.json", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return []; // no register, or no HEAD copy — nothing to compare, fail open
  }
  if (!now || !before) return [];
  return [...now.entries()]
    .filter(([id, status]) => status === "passing" && before.get(id) !== "passing")
    .map(([id]) => id);
}
