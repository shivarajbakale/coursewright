#!/usr/bin/env node
/* Print a Flowmovie file as a storyboard: each scene's caption, its
 * events in time order with their notes, and where every token is when
 * the scene ends. Read it to confirm the movie tells the story you meant.
 *
 *   node story.mjs movie.flow
 *
 * Exit code: 0 on success, 1 when the file has errors (they are printed
 * instead), 2 when it can't be read. */
import { Flowmovie, readMovie, formatProblems, parseArgs } from "./engine.mjs";

const { files } = parseArgs(process.argv.slice(2));
if (files.length !== 1) {
  console.error("Usage: node story.mjs movie.flow");
  process.exit(2);
}
const [file] = files;
const text = readMovie(file);
const r = Flowmovie.checkText(text);
if (!r.ok) {
  console.log(formatProblems(file, text, r));
  console.log(`${file}: doesn't compile, so there is no story yet. Run check.mjs and fix the errors.`);
  process.exit(1);
}
console.log(Flowmovie.storyboard(r.movie));
