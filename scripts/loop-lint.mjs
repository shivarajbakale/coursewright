#!/usr/bin/env node
/**
 * loop-lint — was the definition of done written before the work, and did
 * anything actually run against it?
 *
 * Every artifact in this harness answers a different question.
 * `feature_list.json` holds *what* and *whether*. A feature plan holds *how a
 * screen is shaped*. Evidence holds *what was run, afterwards*. The gap between
 * them is the one this gate closes: **the definition of done is written after
 * the work, by the same agent that did the work.**
 *
 * That is not a hypothetical. `make check` is a fixed chain — it cannot know
 * that this feature's empty state has to render when the list is empty, or that
 * a person was supposed to look at the archived row. So the feature-specific
 * half of "done" gets decided at the end, by whoever is holding the diff, and it
 * is decided in favour of the diff every time. Nothing in the repository ever
 * sees the version of "done" that would have failed.
 *
 * A goal contract moves that decision to the front and writes it down:
 *
 *   docs/loops/<feature-id>.goal.json         the outcome, the scope, the
 *                                             exclusions, and the checks
 *   docs/loops/<feature-id>.loop-state.json   what each maker/checker cycle did
 *                                             and what the checks returned
 *
 * The maker changes the code. The checker runs the contract's checks and
 * records their exit codes. Neither is allowed to redefine the checks, because
 * they are in a file that was written first and is diffed like any other.
 *
 * Rules:
 *   L1  the goal contract is well-formed — outcome, scope, exclusions, checks
 *   L2  every check names a command this project can actually run
 *   L3  the goal names a feature the register knows about
 *   L4  the loop state is well-formed and its cycles are numbered
 *   L5  a claimed pass is backed by a result per check, and a loop has a contract
 *   L6  the register and the loop do not disagree about whether this is done
 *   L7  the shipped schema and this gate agree about the shape they both own
 *   L8  once a project has opted into goal contracts, the feature in flight has one
 *
 * The gate is inert in a project with no goal contracts, and bites on the first
 * one — the same shape as `plan-lint`. Inert is loud, though: a run that checked
 * nothing prints WARN, because "0 violations" over zero files reads like a pass.
 *
 * L8 decides when a missing contract is itself a failure. A project opts in
 * explicitly, with `rules.require_goal_contracts: true` in feature_list.json;
 * from then on every `in_progress` feature needs `docs/loops/<id>.goal.json`.
 * The opt-in is a flag rather than "the first contract", because one contract
 * for one hard feature is not a decision that every future feature needs one.
 * `passing` features are history and are not asked for one retroactively, and a
 * project without the flag is never failed by L8. (flutter's Dart port,
 * tool/loop_lint.dart, implements L8 the same way.) A harness that demanded a contract for
 * work already finished would fail on arrival and be switched off, which is
 * worse than not having it.
 *
 *   node scripts/loop-lint.mjs [dir]     # default: cwd
 *   node scripts/loop-lint.mjs --strict  # exit 1 on any violation
 *   node scripts/loop-lint.mjs --json
 *
 * This file is stamped into every scaffold source tree whose check chain has
 * Node in it, so it runs against a generated project too. `create-flutter-app`
 * carries the Dart port at `tool/loop_lint.dart` for the same reason its
 * `doc_lint.dart` exists.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------- shapes ---

export const LOOPS_DIR = "docs/loops";

/**
 * The four files a fresh project ships. They are templates, not contracts, so
 * the rules skip them — a rule that failed on the seed the harness itself
 * installed would be red in every project on day one.
 */
export const TEMPLATE_FILES = new Set([
  "goal-template.json",
  "loop-state.schema.json",
  "maker-prompt.md",
  "checker-prompt.md",
]);

const VERDICTS = new Set(["pass", "fail"]);

/**
 * L7. `docs/loops/loop-state.schema.json` ships beside the state files so an
 * editor can complete them and a person can read the shape without reading this
 * file. That makes it a second description of one artifact, and this repository
 * has lost days to exactly that: a gate holding its own copy of a list the tree
 * maintains, both correct on the day they were written.
 *
 * So the schema is not documentation here, it is checked. These are the keys
 * the rules above actually demand; if the schema stops requiring one of them,
 * or starts requiring something the gate never asks for, the two have diverged
 * and one of them is lying to whoever reads it next.
 */
export const SCHEMA_CONTRACT = {
  "": ["cycles", "feature", "satisfied"],
  "cycles[]": ["checker", "maker", "n"],
  "cycles[].checker": ["results", "verdict"],
};

export function schemaViolations(schema, file) {
  const out = [];
  const at = (message) => out.push({ rule: "L7", message: `${file}: ${message}` });

  const cycles = schema?.properties?.cycles?.items;
  const checker = cycles?.properties?.checker;
  const found = {
    "": schema?.required,
    "cycles[]": cycles?.required,
    "cycles[].checker": checker?.required,
  };

  for (const [where, expected] of Object.entries(SCHEMA_CONTRACT)) {
    const actual = found[where];
    if (!Array.isArray(actual)) {
      at(`${where || "the root"} declares no \`required\` list, and the gate demands ${expected.join(", ")}`);
      continue;
    }
    const sorted = [...actual].sort();
    if (sorted.join(",") !== expected.join(",")) {
      at(
        `${where || "the root"} requires ${sorted.join(", ") || "nothing"} while the gate demands ` +
          `${expected.join(", ")} — the schema and loop-lint have drifted`,
      );
    }
  }
  return out;
}

// ------------------------------------------------------------- L2 command ---

/**
 * A check whose command cannot be run is the failure this whole artifact is
 * meant to prevent, wearing the costume of the fix. `verification: run the ui
 * probe` in a project with no probe reads as rigour and grades nothing, and
 * nobody finds out until someone types it by hand.
 *
 * So the command forms are a closed set, and anything else is a violation
 * rather than a pass. Failing closed matters more than breadth here: a form
 * this function does not understand is a form it cannot confirm, and reporting
 * "ok" for it would restore exactly the hole being closed. The escape hatch is
 * `observation`, which says out loud that a human is the instrument.
 */
export function resolveCommand(command, project) {
  const cmd = String(command).trim();
  if (!cmd) return { ok: false, reason: "is empty" };

  const make = cmd.match(/^make\s+([a-zA-Z0-9_.-]+)$/);
  if (make) {
    const target = make[1];
    const makefile = path.join(project, "Makefile");
    if (!fs.existsSync(makefile)) return { ok: false, reason: "there is no Makefile" };
    const text = fs.readFileSync(makefile, "utf8");
    const declared = new RegExp(`^\\.?${escapeRegExp(target)}\\s*:`, "m").test(text);
    return declared
      ? { ok: true }
      : { ok: false, reason: `the Makefile has no \`${target}\` target` };
  }

  const npm = cmd.match(/^npm\s+(?:run\s+([a-zA-Z0-9_:.-]+)|(test|start))$/);
  if (npm) {
    const script = npm[1] ?? npm[2];
    const pkgPath = path.join(project, "package.json");
    if (!fs.existsSync(pkgPath)) return { ok: false, reason: "there is no package.json" };
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch {
      return { ok: false, reason: "package.json does not parse" };
    }
    return pkg.scripts && pkg.scripts[script]
      ? { ok: true }
      : { ok: false, reason: `package.json has no \`${script}\` script` };
  }

  const node = cmd.match(/^node\s+([^\s]+)/);
  if (node) {
    const script = node[1];
    return fs.existsSync(path.join(project, script))
      ? { ok: true }
      : { ok: false, reason: `${script} is not there` };
  }

  return {
    ok: false,
    reason:
      "loop-lint can confirm `make <target>`, `npm run <script>`, `npm test` and " +
      "`node <file>`. Rewrite it as one of those, or record it as an `observation` " +
      "so it is clear a person is the instrument",
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ------------------------------------------------------------------ L1/L4 ---

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

/**
 * L1. A contract missing any of these is not a weaker contract, it is a
 * different artifact: without `exclusions` it cannot settle a scope argument,
 * and without `verification` it is a wish.
 */
export function goalShapeViolations(goal, file) {
  const out = [];
  const at = (message) => out.push({ rule: "L1", message: `${file}: ${message}` });

  if (!goal || typeof goal !== "object" || Array.isArray(goal)) {
    at("is not a JSON object");
    return out;
  }
  if (!nonEmptyString(goal.feature)) at("has no `feature` id");
  if (!nonEmptyString(goal.outcome)) {
    at("has no `outcome` — one sentence naming what is true when this is done");
  }
  if (!stringList(goal.scope)) at("has no `scope` list");
  if (!stringList(goal.exclusions)) {
    at(
      "has no `exclusions` — a contract that excludes nothing has not been " +
        "thought about, and every scope argument it was supposed to settle is " +
        "still ahead of you",
    );
  }
  if (!Array.isArray(goal.verification) || goal.verification.length === 0) {
    at("has no `verification` checks");
    return out;
  }

  const seen = new Set();
  for (const [index, check] of goal.verification.entries()) {
    const label = `verification[${index}]`;
    if (!check || typeof check !== "object" || Array.isArray(check)) {
      at(`${label} is not an object`);
      continue;
    }
    if (!nonEmptyString(check.id)) at(`${label} has no \`id\``);
    else if (seen.has(check.id)) at(`${label} reuses the id \`${check.id}\``);
    else seen.add(check.id);

    if (!nonEmptyString(check.check)) {
      at(`${label} has no \`check\` — what this proves, in a sentence`);
    }
    const hasCommand = nonEmptyString(check.command);
    const hasObservation = nonEmptyString(check.observation);
    if (hasCommand && hasObservation) {
      at(`${label} has both a \`command\` and an \`observation\` — pick the instrument`);
    } else if (!hasCommand && !hasObservation) {
      at(`${label} has neither a \`command\` nor an \`observation\``);
    }
  }
  return out;
}

/**
 * L4. The cycle numbering is not bookkeeping: an out-of-order or duplicated `n`
 * is what a loop state looks like when it was written at the end from memory
 * rather than after each cycle.
 */
export function loopStateShapeViolations(state, file) {
  const out = [];
  const at = (message) => out.push({ rule: "L4", message: `${file}: ${message}` });

  if (!state || typeof state !== "object" || Array.isArray(state)) {
    at("is not a JSON object");
    return out;
  }
  if (!nonEmptyString(state.feature)) at("has no `feature` id");
  if (typeof state.satisfied !== "boolean") at("has no boolean `satisfied`");
  if (!Array.isArray(state.cycles) || state.cycles.length === 0) {
    at("has no `cycles` — a loop that ran zero times is not a loop");
    return out;
  }

  for (const [index, cycle] of state.cycles.entries()) {
    const label = `cycles[${index}]`;
    if (!cycle || typeof cycle !== "object" || Array.isArray(cycle)) {
      at(`${label} is not an object`);
      continue;
    }
    if (cycle.n !== index + 1) at(`${label} is numbered ${JSON.stringify(cycle.n)}, expected ${index + 1}`);
    if (!nonEmptyString(cycle.maker)) at(`${label} has no \`maker\` note`);
    const checker = cycle.checker;
    if (!checker || typeof checker !== "object" || Array.isArray(checker)) {
      at(`${label} has no \`checker\``);
      continue;
    }
    if (!VERDICTS.has(checker.verdict)) {
      at(`${label}.checker.verdict is ${JSON.stringify(checker.verdict)}, expected "pass" or "fail"`);
    }
    if (!Array.isArray(checker.results)) at(`${label}.checker has no \`results\` array`);
  }
  return out;
}

/**
 * L5. The rule the rest of the file exists to make possible. A verdict is a
 * claim; a result per check, with the exit code the command returned, is the
 * evidence for it. Without this a loop state is a field that says "pass".
 */
export function verdictViolations(goal, state, file) {
  const out = [];
  const at = (message) => out.push({ rule: "L5", message: `${file}: ${message}` });

  const checks = new Map(
    (Array.isArray(goal?.verification) ? goal.verification : [])
      .filter((c) => nonEmptyString(c?.id))
      .map((c) => [c.id, c]),
  );

  for (const cycle of Array.isArray(state?.cycles) ? state.cycles : []) {
    const results = Array.isArray(cycle?.checker?.results) ? cycle.checker.results : [];
    for (const result of results) {
      if (!checks.has(result?.id)) {
        at(`cycle ${cycle.n} records a result for \`${result?.id}\`, which the goal does not check`);
      }
    }
    if (cycle?.checker?.verdict !== "pass") continue;

    const byId = new Map(results.filter((r) => nonEmptyString(r?.id)).map((r) => [r.id, r]));
    for (const [id, check] of checks) {
      const result = byId.get(id);
      if (!result) {
        at(`cycle ${cycle.n} passed without running \`${id}\``);
        continue;
      }
      if (nonEmptyString(check.command)) {
        if (result.exit !== 0) {
          at(
            `cycle ${cycle.n} passed while \`${id}\` exited ${JSON.stringify(result.exit)} — ` +
              "a passing verdict needs every command at 0",
          );
        }
      } else if (!nonEmptyString(result.note)) {
        at(`cycle ${cycle.n} passed \`${id}\` with no note, and it is an observation a person makes`);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ files ---

function readJson(file) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (error) {
    return { error: error.message };
  }
}

function registeredFeatureIds(project) {
  const ids = new Set();
  const register = path.join(project, "feature_list.json");
  if (fs.existsSync(register)) {
    const { value } = readJson(register);
    const features = Array.isArray(value) ? value : Array.isArray(value?.features) ? value.features : [];
    for (const feature of features) if (nonEmptyString(feature?.id)) ids.add(feature.id);
  }
  return ids;
}

function passingFeatureIds(project) {
  const ids = new Set();
  const register = path.join(project, "feature_list.json");
  if (fs.existsSync(register)) {
    const { value } = readJson(register);
    const features = Array.isArray(value) ? value : Array.isArray(value?.features) ? value.features : [];
    for (const feature of features) {
      if (nonEmptyString(feature?.id) && feature.status === "passing") ids.add(feature.id);
    }
  }
  return ids;
}

/**
 * An archived feature is gone from the register on purpose — the prelude does
 * not pay for finished work. Its goal contract is still a legitimate historical
 * record, so L3 accepts either home.
 */
function readRegister(project) {
  const out = { requireGoals: false, inProgress: [] };
  const file = path.join(project, "feature_list.json");
  if (!fs.existsSync(file)) return out;
  const { value } = readJson(file);
  if (!value) return out;
  const list = Array.isArray(value) ? value : (value.features ?? []);
  out.requireGoals = value?.rules?.require_goal_contracts === true;
  out.inProgress = list.filter((f) => f?.status === "in_progress" && f.id).map((f) => f.id);
  return out;
}

function archivedFeatureIds(project) {
  const ids = new Set();
  const history = path.join(project, "docs/history/completed-features.md");
  if (!fs.existsSync(history)) return ids;
  const text = fs.readFileSync(history, "utf8");
  for (const match of text.matchAll(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d{3,})\b/g)) ids.add(match[1]);
  return ids;
}

// ------------------------------------------------------------------- lint ---

export function lint(project) {
  const violations = [];
  const dir = path.join(project, LOOPS_DIR);
  const stats = { goals: 0, states: 0, checks: 0, cycles: 0 };

  if (!fs.existsSync(dir)) return { violations, stats: null };

  const entries = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !TEMPLATE_FILES.has(name));

  const goals = new Map();
  const states = new Map();

  for (const name of entries) {
    const rel = `${LOOPS_DIR}/${name}`;
    const { value, error } = readJson(path.join(dir, name));
    if (error) {
      violations.push({ rule: "L1", message: `${rel} does not parse: ${error}` });
      continue;
    }
    if (name.endsWith(".loop-state.json")) states.set(name.replace(/\.loop-state\.json$/, ""), { rel, value });
    else if (name.endsWith(".goal.json")) goals.set(name.replace(/\.goal\.json$/, ""), { rel, value });
    else {
      violations.push({
        rule: "L1",
        message:
          `${rel} is neither \`<feature-id>.goal.json\` nor ` +
          "`<feature-id>.loop-state.json`, so nothing pairs it with a feature",
      });
    }
  }

  const schemaFile = path.join(dir, "loop-state.schema.json");
  if (!fs.existsSync(schemaFile)) {
    violations.push({
      rule: "L7",
      message: `${LOOPS_DIR}/loop-state.schema.json is missing — the shape these files are written against`,
    });
  } else {
    const { value, error } = readJson(schemaFile);
    if (error) {
      violations.push({ rule: "L7", message: `${LOOPS_DIR}/loop-state.schema.json does not parse: ${error}` });
    } else {
      violations.push(...schemaViolations(value, `${LOOPS_DIR}/loop-state.schema.json`));
    }
  }

  const registered = registeredFeatureIds(project);

  // L8 — the feature in flight has a contract, once the project has opted in.
  {
    const register = readRegister(project);
    if (register.requireGoals) {
      for (const id of register.inProgress) {
        if (!goals.has(id)) {
          violations.push({
            rule: "L8",
            message:
              `${id} is \`in_progress\` with no ${LOOPS_DIR}/${id}.goal.json — this project writes ` +
              "the definition of done before the work (copy goal-template.json)",
          });
        }
      }
    }
  }
  const archived = archivedFeatureIds(project);
  const passing = passingFeatureIds(project);

  for (const [key, { rel, value: goal }] of goals) {
    stats.goals += 1;
    const shape = goalShapeViolations(goal, rel);
    violations.push(...shape);

    if (nonEmptyString(goal?.feature) && goal.feature !== key) {
      violations.push({
        rule: "L1",
        message: `${rel} is named for \`${key}\` but its \`feature\` is \`${goal.feature}\``,
      });
    }

    // L2 — only worth asking once the shape is sound; a malformed check has
    // already been reported and would report twice.
    if (!shape.length) {
      for (const check of goal.verification) {
        stats.checks += 1;
        if (!nonEmptyString(check.command)) continue;
        const resolved = resolveCommand(check.command, project);
        if (!resolved.ok) {
          violations.push({
            rule: "L2",
            message: `${rel}: check \`${check.id}\` runs \`${check.command}\`, but ${resolved.reason}`,
          });
        }
      }
    }

    // L3
    const id = nonEmptyString(goal?.feature) ? goal.feature : key;
    if (registered.size && !registered.has(id) && !archived.has(id)) {
      violations.push({
        rule: "L3",
        message:
          `${rel} is a contract for \`${id}\`, which is in neither feature_list.json ` +
          "nor docs/history/completed-features.md — nothing will ever verify it",
      });
    }

    // L6
    const state = states.get(key);
    if (passing.has(id)) {
      if (!state) {
        violations.push({
          rule: "L6",
          message: `${id} is \`passing\` in the register and has a goal contract but no loop state`,
        });
      } else if (state.value?.satisfied !== true) {
        violations.push({
          rule: "L6",
          message: `${id} is \`passing\` in the register while ${state.rel} says \`satisfied: false\``,
        });
      }
    }
  }

  for (const [key, { rel, value: state }] of states) {
    stats.states += 1;
    stats.cycles += Array.isArray(state?.cycles) ? state.cycles.length : 0;
    const goal = goals.get(key);
    if (!goal) {
      violations.push({
        rule: "L5",
        message: `${rel} has no ${LOOPS_DIR}/${key}.goal.json — a loop with no contract checked nothing`,
      });
      continue;
    }
    const shape = loopStateShapeViolations(state, rel);
    violations.push(...shape);
    if (nonEmptyString(state?.feature) && nonEmptyString(goal.value?.feature) && state.feature !== goal.value.feature) {
      violations.push({
        rule: "L4",
        message: `${rel} names \`${state.feature}\` while its goal names \`${goal.value.feature}\``,
      });
    }
    if (!shape.length) violations.push(...verdictViolations(goal.value, state, rel));

    if (state?.satisfied === true && Array.isArray(state.cycles) && state.cycles.length) {
      const last = state.cycles[state.cycles.length - 1];
      if (last?.checker?.verdict !== "pass") {
        violations.push({
          rule: "L5",
          message: `${rel} is satisfied while its last cycle's verdict is ${JSON.stringify(last?.checker?.verdict)}`,
        });
      }
    }
  }

  return { violations, stats };
}

// ------------------------------------------------------------------- main ---
// Only when run as a command. `lint()` is imported by the test suite, and a
// module that calls process.exit on import takes the test runner down with it.
const RUN_AS_CLI =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (RUN_AS_CLI) main();

function main() {
  const args = process.argv.slice(2);
  const STRICT = args.includes("--strict");
  const JSON_OUT = args.includes("--json");
  const targetArg = args.find((a) => !a.startsWith("--"));
  const target = path.resolve(targetArg ?? process.cwd());

  const { violations, stats } = lint(target);

  if (JSON_OUT) {
    console.log(JSON.stringify({ target, violations, stats }, null, 2));
    process.exit(STRICT && violations.length ? 1 : 0);
  }

  if (!stats) {
    console.log(`loop-lint: WARN 0 checked — no ${LOOPS_DIR}/ here, nothing to check.`);
    process.exit(0);
  }

  if (!stats.goals && !stats.states && !violations.length) {
    console.log(
      "loop-lint: WARN 0 checked — no goal contracts yet. The gate is inert until the first one — " +
        `see ${LOOPS_DIR}/goal-template.json.`,
    );
    process.exit(0);
  }

  console.log(
    `\nloop-lint — ${stats.goals} goal contract(s), ${stats.checks} check(s), ` +
      `${stats.states} loop state(s), ${stats.cycles} cycle(s)\n`,
  );
  for (const v of violations) console.log(`  [${v.rule}] ${v.message}`);
  console.log(
    `\n${violations.length} violation(s).` +
      (STRICT ? "" : " Reporting only — pass --strict to make this a gate."),
  );
  process.exit(STRICT && violations.length ? 1 : 0);
}
