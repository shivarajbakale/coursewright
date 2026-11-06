#!/usr/bin/env node
// Inkling on the command line. Runs with plain Node (18+) from a clone or a
// vendored copy; everything it needs is in dist-lib/inkling-node.js.
//
//   node bin/inkling.mjs render diagram.inkling -o diagram.svg [--paper napkin] [--embed-fonts]
//   node bin/inkling.mjs render 'docs/**/*.inkling'      writes .svg next to each
//   node bin/inkling.mjs check diagram.inkling           file:line: message; exit 1 on errors
//   node bin/inkling.mjs format diagram.inkling --write
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// From a clone: ../dist-lib. From a vendored copy (bin/ copied next to the files): ../ or ./
const candidates = [join(here, '..', 'dist-lib', 'inkling-node.js'), join(here, '..', 'inkling-node.js'), join(here, 'inkling-node.js')];
const libPath = candidates.find((p) => existsSync(p));
if (!libPath) {
  console.error('inkling: cannot find inkling-node.js. In a clone of Inkling, run `npm run build:lib` first.');
  process.exit(2);
}
const ink = await import(pathToFileURL(libPath).href);

const SETTINGS = ['paper', 'pen', 'hand', 'mess', 'seed', 'layout', 'direction'];

const HELP = `Usage: inkling <command> [files…] [options]

Commands:
  render <files…>   Draw each file as SVG. Writes name.svg next to name.inkling,
                    or to -o <file> for a single input (-o - for stdout).
  check <files…>    Print problems as file:line: message. Exits 1 if any are errors.
  format <files…>   Print tidied source, or rewrite the files with --write.
                    --check exits 1 if any file is not formatted.

Files can be paths, folders (every .inkling inside) or globs such as 'docs/**/*.inkling'
(quote them so the shell does not expand them). Use - to read from stdin.

Render options:
  -o, --out <file>          Output file (single input only).
  --paper, --pen, --hand, --mess, --seed, --layout, --direction <value>
                            Override the setting in the source.
  --embed-fonts             Put the fonts inside the SVG (fetches them from Google Fonts).
  --font-css <url|none>     Stylesheet the SVG imports fonts from; none for no @import.
  --id-prefix <prefix>      Prefix for ids inside the SVG.

Other:
  -q, --quiet               Only print problems.
  -h, --help                This help.
  -v, --version             Print the version.
`;

function parseArgs(argv) {
  const out = { command: argv[0], files: [], settings: {}, flags: {} };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const take = () => {
      const eq = a.indexOf('=');
      if (eq > 0) return a.slice(eq + 1);
      const v = argv[++i];
      if (v === undefined) fail(`${a} needs a value.`);
      return v;
    };
    const name = a.replace(/^--?/, '').replace(/=.*$/, '');
    if (a === '-' || !a.startsWith('-')) out.files.push(a);
    else if (SETTINGS.includes(name)) out.settings[name] = take();
    else if (name === 'o' || name === 'out') out.flags.out = take();
    else if (name === 'font-css') out.flags.fontCss = take();
    else if (name === 'id-prefix') out.flags.idPrefix = take();
    else if (name === 'embed-fonts') out.flags.embedFonts = true;
    else if (name === 'write' || name === 'w') out.flags.write = true;
    else if (name === 'check') out.flags.check = true;
    else if (name === 'q' || name === 'quiet') out.flags.quiet = true;
    else if (name === 'h' || name === 'help') out.flags.help = true;
    else fail(`Unknown option ${a}. See --help.`);
  }
  return out;
}

function fail(message, code = 2) {
  console.error(`inkling: ${message}`);
  process.exit(code);
}

/** Glob with *, ** and ?; enough for 'docs/**\/*.inkling'. */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '(?:.*/)?';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function expand(patterns) {
  const files = [];
  for (const p of patterns) {
    if (p === '-') files.push('-');
    else if (/[*?]/.test(p)) {
      const base = p.split('/').findIndex((seg) => /[*?]/.test(seg));
      const root = p.split('/').slice(0, base).join('/') || '.';
      const re = globToRegExp(p.replace(/^\.\//, ''));
      const found = existsSync(root) ? walk(root).map((f) => relative('.', f).split(sep).join('/')).filter((f) => re.test(f)) : [];
      if (!found.length) console.error(`inkling: nothing matches ${p}`);
      files.push(...found.sort());
    } else if (existsSync(p) && statSync(p).isDirectory()) files.push(...walk(p).filter((f) => f.endsWith('.inkling')).sort());
    else if (existsSync(p)) files.push(p);
    else fail(`no such file: ${p}`);
  }
  return files;
}

const read = (f) => (f === '-' ? readFileSync(0, 'utf8') : readFileSync(f, 'utf8'));
const label = (f) => (f === '-' ? '<stdin>' : f);
const line = (f, d) => `${label(f)}:${d.span.line}: ${d.severity}: ${d.message}${d.hint ? ` ${d.hint}` : ''} [${d.code}]`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === '-v' || args.command === '--version') {
    const pkg = join(here, '..', 'package.json');
    const version = join(here, '..', 'VERSION');
    console.log(existsSync(pkg) ? JSON.parse(readFileSync(pkg, 'utf8')).version : existsSync(version) ? readFileSync(version, 'utf8').trim() : 'unknown');
    return 0;
  }
  if (!args.command || args.flags.help || args.command === '-h' || args.command === '--help' || args.command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (!['render', 'check', 'format'].includes(args.command)) fail(`unknown command "${args.command}". Commands: render, check, format.`);
  if (!args.files.length) fail(`${args.command} needs at least one file.`);
  const files = expand(args.files);
  if (!files.length) fail('no files to work on.', 1);

  if (args.command === 'check') {
    let errors = 0;
    let warnings = 0;
    for (const f of files) {
      const source = read(f);
      // Parse and lay out, as the drawing would: layout warnings count too.
      const { diagnostics } = ink.renderDiagram(source, args.settings);
      for (const d of diagnostics) {
        if (d.severity === 'error') errors++;
        else warnings++;
        console.log(line(f, d));
      }
    }
    if (!args.flags.quiet) console.error(`${files.length} file${files.length === 1 ? '' : 's'} checked: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}.`);
    return errors ? 1 : 0;
  }

  if (args.command === 'format') {
    let unformatted = 0;
    for (const f of files) {
      const source = read(f);
      const tidy = ink.format(source);
      if (args.flags.check) {
        if (tidy !== source) {
          unformatted++;
          console.log(`${label(f)}: not formatted`);
        }
      } else if (args.flags.write && f !== '-') {
        if (tidy !== source) {
          writeFileSync(f, tidy);
          if (!args.flags.quiet) console.error(`formatted ${f}`);
        }
      } else process.stdout.write(tidy);
    }
    return unformatted ? 1 : 0;
  }

  // render
  if (args.flags.out && files.length > 1) fail('-o works with one input file; without it each .svg is written next to its source.');
  let errors = 0;
  const fontCss = args.flags.fontCss === undefined ? undefined : args.flags.fontCss === 'none' ? null : args.flags.fontCss;
  for (const f of files) {
    const source = read(f);
    const r = ink.renderDiagram(source, { ...args.settings, fontCss, idPrefix: args.flags.idPrefix });
    for (const d of r.diagnostics) {
      if (d.severity === 'error') errors++;
      console.error(line(f, d));
    }
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n${r.svg}\n`;
    if (args.flags.embedFonts) svg = await ink.embedFonts(svg);
    const out = args.flags.out ?? (f === '-' ? '-' : f.replace(/\.inkling$/, '') + '.svg');
    if (out === '-') process.stdout.write(svg);
    else {
      writeFileSync(resolve(out), svg);
      if (!args.flags.quiet) console.error(`wrote ${out}`);
    }
  }
  return errors ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => fail(e?.stack ?? String(e), 2),
);
