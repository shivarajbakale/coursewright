#!/usr/bin/env node
/**
 * plan-lint — the planning artifact is a checked artifact, not a note.
 *
 * `plan-feature` says the plan JSON is the source of truth, that FEATURE-PLAN.md
 * is generated and must never be hand-edited, and that the feature gets
 * registered in feature_list.json. Until this gate existed, all three were
 * honour-system prose: the validator could only be reached by running the
 * renderer by hand, which nothing required.
 *
 * The rules:
 *
 *   P1  Every `*.feature-plan.json` at the project root passes the same
 *       validator the renderer uses — a plan that cannot be drawn is not a plan.
 *   P2  A committed FEATURE-PLAN.md matches a fresh render of its source plan.
 *       This is the hand-edit check: the document you approved and the document
 *       the JSON produces have to be the same bytes.
 *   P3  No orphan FEATURE-PLAN.md — a rendered plan with no source JSON cannot
 *       be re-rendered, reviewed, or diffed, so it is prose wearing a filename.
 *   P4  Every root plan's `feature.id` is registered in feature_list.json.
 *       A plan nobody tracked is a plan nobody will verify.
 *   P5  The archetype vocabulary agrees in all four places that hold it:
 *       docs/principles/screen-archetypes.md, the `ARCHETYPES` list here,
 *       `PageShell`'s `Archetype` union, and Module B of the UI probe. A shape
 *       the probe checks but no document describes is a rule with no reason
 *       attached; a shape the document describes but nothing checks is prose.
 *
 *   P6  The `in_progress` feature has a plan, or records `"plan": "none: <reason>"`.
 *
 * Inert on a fresh scaffold — no plans, nothing to check, and a WARN says so. It bites the moment
 * someone plans, which is exactly when the drift starts.
 *
 * Dependency-free: Node stdlib plus the renderer that already ships here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateFeaturePlan, renderFeaturePlanMarkdown, ARCHETYPES } from "./feature-plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const violations = [];
const fail = (rule, message) => violations.push({ rule, message });

const rel = (p) => path.relative(projectRoot, p) || path.basename(p);

const planFiles = fs
  .readdirSync(projectRoot)
  .filter((f) => f.endsWith(".feature-plan.json"))
  .map((f) => path.join(projectRoot, f))
  .sort();

const renderedPath = path.join(projectRoot, "FEATURE-PLAN.md");
const hasRendered = fs.existsSync(renderedPath);

// --- P1: every plan validates -------------------------------------------------

const plans = [];
for (const file of planFiles) {
  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    fail("P1", `${rel(file)} is not valid JSON: ${err.message}`);
    continue;
  }
  const errors = validateFeaturePlan(plan);
  if (errors.length) {
    for (const e of errors) fail("P1", `${rel(file)}: ${e}`);
    continue;
  }
  plans.push({ file, plan });
}

// --- P2/P3: the rendered document tracks its source ---------------------------

if (hasRendered) {
  const committed = fs.readFileSync(renderedPath, "utf8");
  if (!plans.length && !planFiles.length) {
    fail(
      "P3",
      `FEATURE-PLAN.md exists but no valid *.feature-plan.json sits beside it — ` +
        `the rendered plan cannot be regenerated or diffed. Write the source JSON ` +
        `(see the plan-feature skill) or delete the document.`,
    );
  } else if (plans.length) {
    const match = plans.find(({ plan }) => {
      try {
        return renderFeaturePlanMarkdown(plan) === committed;
      } catch {
        return false;
      }
    });
    if (!match) {
      const names = plans.map(({ file }) => rel(file)).join(", ");
      fail(
        "P2",
        `FEATURE-PLAN.md does not match a fresh render of any of: ${names}. ` +
          `The document is generated — never hand-edit it. Edit the JSON and ` +
          `re-render: node scripts/feature-plan.mjs <plan>.feature-plan.json -o FEATURE-PLAN.md`,
      );
    }
  }
}

// --- P4: the plan is a tracked feature ---------------------------------------

if (plans.length) {
  const listPath = path.join(projectRoot, "feature_list.json");
  if (!fs.existsSync(listPath)) {
    fail("P4", "feature_list.json is missing — a plan needs a feature to hang off.");
  } else {
    // Readable-but-empty is the interesting case: a fresh project with a plan
    // and nothing registered is exactly the drift P4 exists to catch, so the
    // guard is "did it parse", never "does it have rows".
    let known = null;
    try {
      const list = JSON.parse(fs.readFileSync(listPath, "utf8"));
      const features = Array.isArray(list) ? list : (list.features ?? []);
      known = new Set(features.map((f) => f?.id).filter(Boolean));
    } catch (err) {
      fail("P4", `feature_list.json is not valid JSON: ${err.message}`);
    }
    for (const { file, plan } of plans) {
      const id = plan.feature?.id;
      if (id && known && !known.has(id)) {
        fail(
          "P4",
          `${rel(file)} plans "${id}", which is not registered in feature_list.json — ` +
            `add the feature so the plan has something to be verified against.`,
        );
      }
    }
  }
}

// --- P5: one vocabulary, four places ------------------------------------------
//
// Unlike P1-P4 this rule is not about a plan file — it is about the words a
// plan is allowed to use. It runs on every scaffold, plans or not, because the
// drift it catches (a shape added to the code and never described, or described
// and never checked) starts long before anyone writes a plan.

{
  const docPath = path.join(projectRoot, "docs/principles/screen-archetypes.md");
  const shellPath = path.join(projectRoot, "src/components/page-shell.tsx");
  const rulesPath = path.join(projectRoot, "scripts/ui-probe/rules/archetype.ts");

  const declared = new Set(ARCHETYPES);

  // The three files are checked only where they exist. `page-shell.tsx` is the
  // marker for "this is the app tree": once a project publishes archetypes to
  // the DOM, the document that explains them is no longer optional.
  const isAppTree = fs.existsSync(shellPath);

  if (!fs.existsSync(docPath)) {
    if (isAppTree) {
      fail("P5", `docs/principles/screen-archetypes.md is missing — the ${declared.size} shapes the planner accepts are undocumented.`);
    }
  } else {
    // The document's headings are the vocabulary: "## `list-detail` — …".
    const doc = fs.readFileSync(docPath, "utf8");
    const documented = new Set(
      [...doc.matchAll(/^##\s+`([a-z][a-z0-9-]*)`/gm)].map((m) => m[1]),
    );
    for (const a of declared) {
      if (!documented.has(a)) {
        fail("P5", `\`${a}\` is in ARCHETYPES but has no "## \`${a}\`" section in docs/principles/screen-archetypes.md.`);
      }
    }
    for (const a of documented) {
      if (!declared.has(a)) {
        fail("P5", `docs/principles/screen-archetypes.md documents \`${a}\`, which scripts/feature-plan.mjs does not accept.`);
      }
    }
  }

  if (fs.existsSync(shellPath)) {
    const src = fs.readFileSync(shellPath, "utf8");
    const union = src.match(/export type Archetype =([\s\S]*?);/);
    if (!union) {
      fail("P5", "src/components/page-shell.tsx declares no `Archetype` union — pages cannot publish a shape the probe can read.");
    } else {
      const members = new Set([...union[1].matchAll(/'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]));
      for (const a of declared) {
        if (!members.has(a)) fail("P5", `PageShell's Archetype union is missing '${a}'.`);
      }
      for (const a of members) {
        if (!declared.has(a)) fail("P5", `PageShell's Archetype union has '${a}', which is not in ARCHETYPES.`);
      }
    }
  }

  if (fs.existsSync(rulesPath)) {
    const src = fs.readFileSync(rulesPath, "utf8");
    const checked = new Set([...src.matchAll(/rootFor\(s,\s*'([a-z][a-z0-9-]*)'\)/g)].map((m) => m[1]));
    for (const a of declared) {
      if (!checked.has(a)) {
        fail("P5", `no Module B rule checks '${a}' — add one in scripts/ui-probe/rules/archetype.ts, or the shape is a promise nothing measures.`);
      }
    }
  }
}

// --- P6: the feature in flight has a plan -------------------------------------
//
// A plan that is only checked when it exists is a gate an agent passes by not
// writing one. So the feature marked `in_progress` must have a plan: a root
// `<name>.feature-plan.json` whose `feature.id` names it, or
// `docs/plans/<id>.feature-plan.json`. A feature that genuinely needs no plan
// says so in the register — `"plan": "none: <reason>"` — where a reviewer can
// see the reason. `passing` features are history and are not asked for one.
// A fresh scaffold has nothing in progress, so it stays green.

const warnings = [];
{
  const listPath = path.join(projectRoot, "feature_list.json");
  let features = [];
  try {
    const list = JSON.parse(fs.readFileSync(listPath, "utf8"));
    features = Array.isArray(list) ? list : (list.features ?? []);
  } catch {
    features = []; // P4 already reports an unreadable register when plans exist
  }
  const planned = new Set(plans.map(({ plan }) => plan.feature?.id).filter(Boolean));
  for (const f of features) {
    if (f?.status !== "in_progress" || !f.id) continue;
    if (planned.has(f.id)) continue;
    if (fs.existsSync(path.join(projectRoot, "docs/plans", `${f.id}.feature-plan.json`))) continue;
    if (typeof f.plan === "string" && /^none:\s*\S/.test(f.plan)) {
      warnings.push(`${f.id} is in progress without a plan (${f.plan})`);
      continue;
    }
    fail(
      "P6",
      `${f.id} is \`in_progress\` with no feature plan — write ${f.id}.feature-plan.json ` +
        `(see the plan-feature skill), or record "plan": "none: <reason>" on the feature.`,
    );
  }
}

// --- report -------------------------------------------------------------------

if (violations.length) {
  console.error(`plan-lint: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`  [${v.rule}] ${v.message}`);
  console.error("");
  process.exit(1);
}

for (const w of warnings) console.log(`plan-lint: WARN ${w}`);
const checked = plans.length;
console.log(
  checked === 0
    ? "plan-lint: WARN 0 checked — no feature plans to check (0 violations). Nothing is in progress, so nothing needs one yet."
    : `plan-lint: ${checked} plan(s) valid${hasRendered ? ", FEATURE-PLAN.md in sync" : ""} (0 violations)`,
);
