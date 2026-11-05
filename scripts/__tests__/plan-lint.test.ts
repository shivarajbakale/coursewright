import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * plan-lint runs against a project root, so these tests build throwaway project
 * roots rather than mutating this one. Each sandbox gets a real copy of the two
 * scripts, so what runs here is the script that ships.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.join(here, "..");
const fixturesDir = path.join(scriptsDir, "__fixtures__");

const fixturePlanFile = fs
  .readdirSync(fixturesDir)
  .find((f) => f.endsWith(".feature-plan.json"));

let sandboxRoot: string;

function makeSandbox(name: string): string {
  const dir = path.join(sandboxRoot, name);
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  for (const f of ["plan-lint.mjs", "feature-plan.mjs"]) {
    fs.copyFileSync(path.join(scriptsDir, f), path.join(dir, "scripts", f));
  }
  fs.writeFileSync(
    path.join(dir, "feature_list.json"),
    JSON.stringify({ features: [] }, null, 2),
  );
  return dir;
}

function run(dir: string) {
  const r = spawnSync(process.execPath, ["scripts/plan-lint.mjs"], {
    cwd: dir,
    encoding: "utf8",
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function plan(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, fixturePlanFile!), "utf8"));
}

function writePlan(dir: string, data: unknown, name = "sandbox.feature-plan.json") {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
  return name;
}

function render(dir: string, file: string) {
  const r = spawnSync(
    process.execPath,
    ["scripts/feature-plan.mjs", file, "-o", "FEATURE-PLAN.md"],
    { cwd: dir, encoding: "utf8" },
  );
  expect(r.status, `render failed: ${r.stderr}`).toBe(0);
}

function register(dir: string, id: string) {
  fs.writeFileSync(
    path.join(dir, "feature_list.json"),
    JSON.stringify({ features: [{ id, status: "in_progress", title: id }] }, null, 2),
  );
}

beforeAll(() => {
  sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plan-lint-"));
});

afterAll(() => {
  fs.rmSync(sandboxRoot, { recursive: true, force: true });
});

describe("plan-lint", () => {
  it("passes a project with no plans — the gate is inert until someone plans", () => {
    const dir = makeSandbox("empty");
    const { code, out } = run(dir);
    expect(code, out).toBe(0);
    expect(out).toContain("no feature plans to check");
  });

  it("passes a valid, registered, in-sync plan", () => {
    const dir = makeSandbox("green");
    const p = plan();
    const file = writePlan(dir, p);
    render(dir, file);
    register(dir, (p.feature as { id: string }).id);
    const { code, out } = run(dir);
    expect(code, out).toBe(0);
    expect(out).toContain("FEATURE-PLAN.md in sync");
  });

  it("P1 — rejects a plan the renderer would refuse to draw", () => {
    const dir = makeSandbox("p1");
    const p = plan();
    (p.components as { why: string }[])[0].why = "";
    writePlan(dir, p);
    register(dir, (p.feature as { id: string }).id);
    const { code, out } = run(dir);
    expect(code, out).toBe(1);
    expect(out).toContain("[P1]");
    expect(out).toContain("why");
  });

  it("P2 — catches a hand-edited FEATURE-PLAN.md, which the skill forbids", () => {
    const dir = makeSandbox("p2");
    const p = plan();
    const file = writePlan(dir, p);
    render(dir, file);
    register(dir, (p.feature as { id: string }).id);
    fs.appendFileSync(path.join(dir, "FEATURE-PLAN.md"), "\nquietly edited by hand\n");
    const { code, out } = run(dir);
    expect(code, out).toBe(1);
    expect(out).toContain("[P2]");
  });

  it("P3 — rejects a rendered plan with no source JSON", () => {
    const dir = makeSandbox("p3");
    fs.writeFileSync(path.join(dir, "FEATURE-PLAN.md"), "# written by hand\n");
    const { code, out } = run(dir);
    expect(code, out).toBe(1);
    expect(out).toContain("[P3]");
  });

  it("does not also report P3 when the source JSON exists but is invalid", () => {
    const dir = makeSandbox("p1-only");
    const p = plan();
    const file = writePlan(dir, p);
    render(dir, file);
    (p.components as { why: string }[])[0].why = "";
    writePlan(dir, p, file);
    const { code, out } = run(dir);
    expect(code, out).toBe(1);
    expect(out).toContain("[P1]");
    expect(out).not.toContain("[P3]");
  });

  /**
   * P5 is not about a plan file — it is about the words a plan may use. The
   * vocabulary lives in four places and this is what stops them drifting apart.
   */
  describe("P5 — one archetype vocabulary, four places", () => {
    const projectRoot = path.join(scriptsDir, "..");
    const VOCAB_FILES = [
      "docs/principles/screen-archetypes.md",
      "src/components/page-shell.tsx",
      "scripts/ui-probe/rules/archetype.ts",
    ];

    /** A sandbox carrying real copies of the three files P5 compares. */
    function withVocabulary(name: string): string {
      const dir = makeSandbox(name);
      for (const rel of VOCAB_FILES) {
        const dest = path.join(dir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(projectRoot, rel), dest);
      }
      return dir;
    }

    it("passes when the document, the union and the probe agree", () => {
      const { code, out } = run(withVocabulary("p5-green"));
      expect(code, out).toBe(0);
      expect(out).not.toContain("[P5]");
    });

    it("rejects a shape the document never describes", () => {
      const dir = withVocabulary("p5-undocumented");
      const doc = path.join(dir, "docs/principles/screen-archetypes.md");
      fs.writeFileSync(
        doc,
        fs.readFileSync(doc, "utf8").replace("## `settings` —", "## Settings —"),
      );
      const { code, out } = run(dir);
      expect(code, out).toBe(1);
      expect(out).toContain("[P5]");
      expect(out).toContain("`settings` is in ARCHETYPES");
    });

    it("rejects a shape PageShell cannot publish", () => {
      const dir = withVocabulary("p5-union");
      const shell = path.join(dir, "src/components/page-shell.tsx");
      fs.writeFileSync(
        shell,
        fs.readFileSync(shell, "utf8").replace("  | 'sequence'\n", ""),
      );
      const { code, out } = run(dir);
      expect(code, out).toBe(1);
      expect(out).toContain("Archetype union is missing 'sequence'");
    });

    it("rejects a shape no Module B rule checks", () => {
      const dir = withVocabulary("p5-unchecked");
      const rules = path.join(dir, "scripts/ui-probe/rules/archetype.ts");
      fs.writeFileSync(
        rules,
        fs.readFileSync(rules, "utf8").replace("rootFor(s, 'detail')", "rootFor(s, 'record')"),
      );
      const { code, out } = run(dir);
      expect(code, out).toBe(1);
      expect(out).toContain("no Module B rule checks 'detail'");
    });

    it("rejects an app tree that publishes archetypes with no document", () => {
      const dir = withVocabulary("p5-nodoc");
      fs.rmSync(path.join(dir, "docs/principles/screen-archetypes.md"));
      const { code, out } = run(dir);
      expect(code, out).toBe(1);
      expect(out).toContain("screen-archetypes.md is missing");
    });

    it("stays inert in a tree that is not an app — no PageShell, no document", () => {
      const { code, out } = run(makeSandbox("p5-inert"));
      expect(code, out).toBe(0);
    });
  });

  it("P4 — rejects a plan for a feature nobody registered", () => {
    const dir = makeSandbox("p4");
    const p = plan();
    const file = writePlan(dir, p);
    render(dir, file);
    const { code, out } = run(dir);
    expect(code, out).toBe(1);
    expect(out).toContain("[P4]");
    expect(out).toContain("feature_list.json");
  });
});
