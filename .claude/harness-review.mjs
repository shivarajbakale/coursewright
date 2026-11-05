#!/usr/bin/env node
/**
 * Rubric checker (rocketship harness-005) — the "checker" half of the
 * worker/checker loop. Run it AFTER a change and BEFORE acceptance, ideally by
 * a different agent (or a human) than the one that wrote the change, so "done"
 * is externally judged rather than self-declared.
 *
 *   node .claude/harness-review.mjs [--run] [--json]
 *
 * It scores the objective rows of evaluator-rubric.md straight from repo
 * artifacts (feature_list.json, claude-progress.md, DECISIONS.md, the Makefile),
 * each 0 (fails) / 1 (partial) / 2 (meets bar). Rows that need human judgment
 * (Correctness) are surfaced as REVIEW-REQUIRED, never fabricated.
 *
 *   --run   also execute `make check` and score Reliability on the real result
 *           (otherwise Reliability only checks that the gate is defined).
 *   --json  emit the scorecard as JSON instead of a table.
 *
 * Verdict: any objective 0 -> Block (exit 1); any objective 1 -> Revise (exit 0);
 * otherwise Accept (exit 0), pending the human Correctness review. Dependency-free
 * (Node stdlib only); fails safe — an unreadable artifact scores 0, not a crash.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const RUN = args.has("--run");
const JSON_OUT = args.has("--json");

function readText(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}
function readJSON(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const fl = readJSON("feature_list.json");
const progress = readText("claude-progress.md");
const decisions = readText("DECISIONS.md");
const makefile = readText("Makefile");
const rubric = readText("evaluator-rubric.md");

const rows = [];
const add = (category, score, note) => rows.push({ category, score, note });

// ── Verification: passing features must carry evidence ──────────────────────
if (!fl || !Array.isArray(fl.features)) {
  add("Verification", 0, "feature_list.json missing or has no features[]");
} else {
  const passing = fl.features.filter((f) => f.status === "passing");
  const noEvidence = passing.filter(
    (f) => !Array.isArray(f.evidence) || f.evidence.length === 0,
  );
  if (passing.length === 0) add("Verification", 1, "no passing features yet to evidence");
  else if (noEvidence.length === 0)
    add("Verification", 2, `${passing.length} passing feature(s), all with evidence`);
  else
    add(
      "Verification",
      0,
      `passing without evidence: ${noEvidence.map((f) => f.id).join(", ")}`,
    );
}

// ── Scope discipline: at most one in_progress ───────────────────────────────
if (!fl || !Array.isArray(fl.features)) {
  add("Scope discipline", 0, "cannot read feature_list.json");
} else {
  const active = fl.features.filter((f) => f.status === "in_progress");
  if (active.length <= 1)
    add("Scope discipline", 2, `${active.length} feature in progress`);
  else
    add(
      "Scope discipline",
      0,
      `${active.length} in_progress (single-active-feature rule violated): ${active
        .map((f) => f.id)
        .join(", ")}`,
    );
}

// ── Reliability: the verification gate exists (and passes, with --run) ──────
const hasCheck = makefile && /^check:/m.test(makefile);
if (!hasCheck) {
  add("Reliability", 0, "Makefile has no `check:` target");
} else if (RUN) {
  try {
    execSync("make check", { stdio: ["ignore", "pipe", "pipe"] });
    add("Reliability", 2, "`make check` passed");
  } catch (e) {
    const tail = ((e.stdout?.toString() || "") + (e.stderr?.toString() || "")).slice(-300);
    add("Reliability", 0, `\`make check\` failed: ${tail.replace(/\s+/g, " ").trim()}`);
  }
} else {
  add("Reliability", 2, "`make check` gate defined (pass --run to execute it)");
}

// ── Maintainability: non-obvious work has DECISIONS.md entries ──────────────
const decisionsEmpty = !decisions || /No decisions logged yet\./.test(decisions);
const nonBaselinePassing =
  fl && Array.isArray(fl.features)
    ? fl.features.filter((f) => f.status === "passing" && !/^(boilerplate|harness)-0*1$/.test(f.id))
        .length
    : 0;
if (!decisions) add("Maintainability", 0, "DECISIONS.md missing");
else if (nonBaselinePassing > 0 && decisionsEmpty)
  add("Maintainability", 1, "features shipped but DECISIONS.md is still the empty stub");
else add("Maintainability", 2, "DECISIONS.md present");

// ── Handoff readiness: a fresh session can continue from artifacts ──────────
const hasSession = progress && /###\s+Session/i.test(progress);
const missing = [];
if (!fl) missing.push("feature_list.json");
if (!progress) missing.push("claude-progress.md");
if (!rubric) missing.push("evaluator-rubric.md");
if (missing.length) add("Handoff readiness", 0, `missing: ${missing.join(", ")}`);
else if (!hasSession)
  add("Handoff readiness", 1, "claude-progress.md has no `### Session` log entry");
else add("Handoff readiness", 2, "progress log + feature_list + rubric present");

// ── Correctness: needs human/checker judgment, never auto-scored ────────────
const manual = [
  {
    category: "Correctness",
    note: "does behavior match feature_list.json user_visible_behavior? (human/checker judgment)",
  },
];

// ── Verdict ─────────────────────────────────────────────────────────────────
const objectiveScores = rows.map((r) => r.score);
const anyBlock = objectiveScores.includes(0);
const anyPartial = objectiveScores.includes(1);
let verdict;
if (anyBlock) verdict = "Block";
else if (anyPartial) verdict = "Revise";
else verdict = "Accept";

const total = objectiveScores.reduce((a, b) => a + b, 0);
const max = rows.length * 2;

if (JSON_OUT) {
  process.stdout.write(
    JSON.stringify({ verdict, score: total, max, rows, manualReview: manual }, null, 2) + "\n",
  );
} else {
  const pad = Math.max(...rows.map((r) => r.category.length));
  console.log("Rubric review — checker separated from worker\n");
  for (const r of rows) {
    const mark = r.score === 2 ? "✓" : r.score === 1 ? "~" : "✗";
    console.log(`  [${mark}] ${r.category.padEnd(pad)}  ${r.score}/2  ${r.note}`);
  }
  for (const m of manual) {
    console.log(`  [?] ${m.category.padEnd(pad)}  —/2  ${m.note}`);
  }
  console.log(`\n  Objective score: ${total}/${max}`);
  console.log(`  Verdict: ${verdict}` + (verdict === "Accept" ? " (pending Correctness review)" : ""));
}

process.exit(verdict === "Block" ? 1 : 0);
