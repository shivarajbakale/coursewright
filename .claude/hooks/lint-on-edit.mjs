#!/usr/bin/env node
/**
 * PostToolUse hook (rocketship) — lint the file Claude just edited, and hand
 * the findings back in the same turn instead of at the end of the feature.
 *
 * The rules are not here. A project opts in by declaring a `lint-file` make
 * target that lints one project-relative FILE; a project without one is
 * skipped, so stamping this into every scaffolder changes nothing until each
 * one declares what "lint one file" means for its stack.
 *
 * Never blocks: findings arrive as additionalContext, and any internal error
 * exits 0. The commit-time gate is the one that refuses.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

const LINTABLE = new Set([".dart", ".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const TIMEOUT_MS = 20_000;

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const cwd = input.cwd || process.cwd();
  const file = input.tool_input?.file_path;
  if (!file || !LINTABLE.has(extname(file))) return;

  // The owning project is the nearest directory above the file whose Makefile
  // declares `lint-file` — not the session's cwd, which is the monorepo root
  // more often than not, and follows the shell wherever `cd` took it.
  const abs = isAbsolute(file) ? file : resolve(cwd, file);
  const project = owningProject(dirname(abs));
  if (!project) return;
  const rel = relative(project, abs);

  const run = spawnSync("make", ["-s", "lint-file", `FILE=${rel}`], {
    cwd: project,
    encoding: "utf8",
    timeout: TIMEOUT_MS,
  });
  if (run.error) {
    console.log(
      context(
        `lint-on-edit: skipped ${rel} (${run.error.message}). Run \`make lint-file FILE=${rel}\` yourself.`,
      ),
    );
    return;
  }
  if (run.status === 0) return;
  const findings = `${run.stdout}${run.stderr}`.trim();
  console.log(
    context(
      `lint-on-edit found problems in ${rel} — fix them before moving on; the commit gate will refuse them:\n${findings}`,
    ),
  );
}

function owningProject(start) {
  for (let dir = start; ; dir = dirname(dir)) {
    const makefile = join(dir, "Makefile");
    if (existsSync(makefile) && /^lint-file:/m.test(readFileSync(makefile, "utf8"))) return dir;
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return null;
  }
}

function context(text) {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text },
  });
}

try {
  main();
} catch (err) {
  console.error(`lint-on-edit: ${err?.message ?? err}`);
}
process.exit(0);
