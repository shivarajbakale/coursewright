/* Loads the Flowmovie engine bundled with this skill (vendor/flowmovie.js,
 * the single-file browser build) into Node, so the scripts need nothing
 * installed. The build runs in its own context; nothing here touches the
 * page APIs it only uses in browsers. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const vendorDir = join(dirname(fileURLToPath(import.meta.url)), "vendor");
export const engineSource = readFileSync(join(vendorDir, "flowmovie.js"), "utf8");

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(engineSource, sandbox, { filename: "flowmovie.js" });

/** The Flowmovie API: checkText, storyboard, lintMovie, parseScript, … */
export const Flowmovie = /** @type {any} */ (sandbox).Flowmovie;

/** Read a movie file, or exit with a message when it can't be read. */
export function readMovie(file) {
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    console.error(`${file}: can't read this file (${e.code || e.message}).`);
    process.exit(2);
  }
}

/** Errors and warnings as `file:line: kind: message`, with the line's text under each. */
export function formatProblems(file, text, result) {
  const lines = text.split("\n");
  const out = [];
  const show = (kind, p) => {
    out.push(`${file}:${p.line}: ${kind}: ${p.message}`);
    const src = lines[p.line - 1];
    if (src != null && src.trim()) out.push(`    ${p.line} | ${src}`);
  };
  for (const e of result.errors) show("error", e);
  for (const w of result.warnings) show(`warning [${w.code}]`, w);
  return out.join("\n");
}

/** Command-line arguments: flags (with an optional value) and the rest. */
export function parseArgs(argv, valued = []) {
  const flags = {};
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { files.push(a); continue; }
    const [k, v] = a.slice(2).split("=", 2);
    if (v != null) flags[k] = v;
    else if (valued.includes(k) && argv[i + 1] != null && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
    else flags[k] = true;
  }
  return { flags, files };
}
