#!/usr/bin/env node
/* Check Flowmovie files: compile each one and list its errors and
 * storytelling warnings against lines.
 *
 *   node check.mjs movie.flow [more.flow …]
 *
 * Exit code: 0 when every file compiles (warnings allowed), 1 when any
 * has errors, 2 when a file can't be read. */
import { Flowmovie, readMovie, formatProblems, parseArgs } from "./engine.mjs";

const { files } = parseArgs(process.argv.slice(2));
if (!files.length) {
  console.error("Usage: node check.mjs movie.flow [more.flow …]");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const text = readMovie(file);
  const r = Flowmovie.checkText(text);
  const problems = formatProblems(file, text, r);
  if (problems) console.log(problems);
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (!r.ok) {
    failed = true;
    console.log(`${file}: ${count(r.errors.length, "error")}. Fix them and check again.`);
  } else {
    const m = r.movie;
    const size = `${(m.duration / 1000).toFixed(1)}s, ${count(m.scenes.length, "scene")}`;
    console.log(r.warnings.length
      ? `${file}: compiles (${size}), ${count(r.warnings.length, "warning")}. Fix each warning, or tell the user why it stays.`
      : `${file}: ok (${size}). No errors, no warnings.`);
  }
}
process.exit(failed ? 1 : 0);
