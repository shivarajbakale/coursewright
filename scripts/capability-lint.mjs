/**
 * capability-lint — grade the design-system knowledge the same way we grade the UI.
 *
 * `.claude/skills/use-mantine/mantine-capabilities.md` is the routing table an
 * agent reads before it composes a screen: capability -> component -> package ->
 * the neighbour it is confused with -> a reference slice in this repo -> the
 * gotcha. It replaced a generated kit reference, and that trade has a cost — a
 * generated file could not lie about what existed, and a hand-written one can.
 * This script is what buys the trade back.
 *
 * Prose rots quietly. A component is renamed across a Mantine major and the map
 * keeps recommending the old name; a file moves and the reference slice sends
 * the next reader nowhere; someone adds `Stepper` to a page and the map never
 * hears about it; someone writes an entry for a component that does not exist
 * and it reads perfectly well.
 *
 * Run it with `npm run capability-lint` (part of `make check`).
 *
 * The rules:
 *
 *   M1  Every entry carries all four fields — `Use when:`, `Instead:`, `Ours:`,
 *       `Gotcha:` — and none of them is empty.
 *   M2  Every component an entry names is really exported by the package that
 *       entry names, read from the installed packages rather than a list.
 *   M3  Every package the map names is a dependency in package.json.
 *   M4  Every repo path the map names exists. An `Ours:` line that reads
 *       *(not wired…)* is exempt — that is the honest way to document a pattern
 *       before writing the code.
 *   M5  Every Mantine export the source actually imports has an entry. This is
 *       the rule that keeps the map a map: a component can enter the app only
 *       through a documented choice.
 *   M6  The families a product UI cannot do without stay covered — no quietly
 *       deleting the entry for `Modal` or `Table`.
 *   M7  The sections that make the file usable are present.
 *   M8  The map argues in Mantine's vocabulary. A `shadcn`, `Radix` or
 *       `components/ui` reference means an entry was copied from the kit this
 *       repo deleted rather than re-argued.
 *   M9  The version stamp names the installed @mantine/core version, so a major
 *       upgrade cannot land without a re-read.
 *   M10 Every component @mantine/core ships is either routed by an entry or
 *       refused, with a reason, under "Deliberately not routed". M5 keeps the
 *       map honest about the components already imported; this one keeps it
 *       honest about the ones nobody has reached for yet, which is where a
 *       routing table earns its keep — an agent picking a component reads this
 *       file, and a component missing from it reads as a component that does
 *       not exist. The roster is the installed package's own component
 *       directory, so a Mantine upgrade that adds a component fails the build
 *       until someone decides where it belongs. If that directory cannot be
 *       read, that is a violation too: a coverage rule that quietly measures
 *       nothing is worse than no coverage rule.
 *
 * Exit 0 = clean, 1 = at least one violation. Run it through npm rather than as
 * `./scripts/capability-lint.mjs`: this module reads the installed packages with
 * a dynamic `import()`, and Vite rewrites those when the rule tests import this
 * file — a rewrite that collides with a shebang, so there deliberately is none.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

export const MAP_FILE = ".claude/skills/use-mantine/mantine-capabilities.md";

/** Directories whose Mantine imports the map has to explain (M5). */
const SOURCE_DIRS = ["src", ".storybook"];

/**
 * The families a product UI cannot ship without.
 *
 * Not "every component we use" — M5 already covers that, and it moves with the
 * code. This is the floor: deleting one of these entries means the map stopped
 * describing an application.
 */
const REQUIRED = [
  "Button",
  "TextInput",
  "Select",
  "Checkbox",
  "Modal",
  "Menu",
  "Tooltip",
  "Table",
  "Card",
  "AppShell",
  "NavLink",
  "Tabs",
  "Alert",
  "Skeleton",
  "MantineProvider",
];

/** Sections that make the file a routing table rather than a list. */
const REQUIRED_SECTIONS = [
  "## How to read this file",
  "## The cascade contract",
  "## The map",
  "## Deliberately not routed",
  "## What Mantine does not give you",
  "## How to add a component that isn't here",
  "## Sources",
];

/** The vocabulary of the kit this repo deleted (M8). */
const DEAD_VOCABULARY = [/\bshadcn\b/i, /\bradix\b/i, /components\/ui\b/, /design-system-reference/];

const FIELDS = ["Use when", "Instead", "Ours", "Gotcha"];

/**
 * What each installed @mantine package exports.
 *
 * Read from the packages themselves rather than checked in: a snapshot would go
 * stale exactly when it matters, at the upgrade. Every one of them imports
 * cleanly in Node — Mantine ships its CSS separately — so this is the export
 * surface the app will see at run time.
 */
async function exportsOf(pkg) {
  try {
    return new Set(Object.keys(await import(pkg)));
  } catch {
    return null;
  }
}

/**
 * The components @mantine/core ships, read from the installed package.
 *
 * Mantine builds one directory per public component, and every one of those
 * directory names is also a top-level export — checked here rather than
 * assumed, so an internal directory could never be mistaken for a component
 * this map owes an answer for. A hard-coded list would go stale at exactly the
 * moment it matters, which is the upgrade.
 */
export function coreRoster(root = projectRoot, exported = null) {
  const bases = ["esm/components", "lib/components", "components"];
  for (const base of bases) {
    const dir = join(root, "node_modules/@mantine/core", base);
    if (!existsSync(dir)) continue;
    const names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^[A-Z][A-Za-z0-9]*$/.test(e.name))
      .map((e) => e.name)
      .filter((name) => !exported || exported.has(name));
    if (names.length) return names.sort();
  }
  return [];
}

/**
 * The components this map answers with "no", as `- `Name` — reason` lines under
 * "## Deliberately not routed". The reason is the point: a bare name there is a
 * gap wearing a decision's clothes.
 */
export function parseNotRouted(text) {
  const section = /\n## Deliberately not routed\n([\s\S]*?)(?=\n## |$)/.exec(text);
  if (!section) return [];
  const out = [];
  for (const m of section[1].matchAll(/^- `([A-Za-z0-9]+)`[ \t]+—[ \t]*(.*)$/gm)) {
    out.push({ name: m[1], reason: m[2].trim() });
  }
  return out;
}

/** Parse the map into entries. A heading is `#### `A` · `B` — @mantine/pkg`. */
export function parseMap(text) {
  const lines = text.split("\n");
  const entries = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = /^####\s+(.*?)\s+—\s+(@mantine\/[a-z]+)\s*$/.exec(line);
    if (heading) {
      const names = [...heading[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      current = { line: i + 1, names, pkg: heading[2], fields: {} };
      entries.push(current);
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      if (!/^####/.test(line)) current = null;
      continue;
    }
    if (!current) continue;
    const field = /^-\s+\*\*(Use when|Instead|Ours|Gotcha):\*\*\s*(.*)$/.exec(line);
    if (field) current.fields[field[1]] = field[2].trim();
    else if (line.startsWith("  ") && line.trim()) {
      // continuation of the previous bullet
      const last = Object.keys(current.fields).at(-1);
      if (last) current.fields[last] += ` ${line.trim()}`;
    }
  }
  return entries;
}

/** Every Mantine value import in the source, mapped to the file that made it. */
export function importedSymbols(root = projectRoot, dirs = SOURCE_DIRS) {
  const found = new Map();
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (/\.(tsx?|mdx)$/.test(entry.name)) {
        const source = readFileSync(full, "utf8");
        const re = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"](@mantine\/[a-z]+)['"]/g;
        let m;
        while ((m = re.exec(source))) {
          if (m[1]) continue; // `import type { … }` — not a component
          for (const raw of m[2].split(",")) {
            const specifier = raw.trim();
            if (!specifier || specifier.startsWith("type ")) continue;
            const name = specifier.split(/\s+as\s+/)[0].trim();
            if (!name) continue;
            if (!found.has(name)) found.set(name, relative(root, full));
          }
        }
      }
    }
  };
  for (const dir of dirs) walk(join(root, dir));
  return found;
}

export async function run({ root = projectRoot } = {}) {
  const violations = [];
  const fail = (rule, message) => violations.push({ rule, message });

  const mapPath = join(root, MAP_FILE);
  if (!existsSync(mapPath)) {
    fail("M1", `${MAP_FILE} is missing — the design-system routing table is the map, not optional`);
    return { violations, entries: [], documented: new Set(), roster: [], refused: new Set() };
  }
  const text = readFileSync(mapPath, "utf8");
  const entries = parseMap(text);
  const documented = new Set(entries.flatMap((e) => e.names));

  // ------------------------------------------------------------------ M1 ---
  for (const entry of entries) {
    for (const field of FIELDS) {
      if (!entry.fields[field]) {
        fail("M1", `${MAP_FILE}:${entry.line} — \`${entry.names.join(" · ")}\` has no **${field}:**`);
      }
    }
  }

  // ------------------------------------------------------------- M2 / M3 ---
  const pkgJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  const surfaces = new Map();
  for (const pkg of new Set(entries.map((e) => e.pkg))) {
    if (!deps[pkg]) {
      fail("M3", `${MAP_FILE} names ${pkg}, which is not a dependency in package.json`);
      continue;
    }
    const names = await exportsOf(pkg);
    if (names === null) {
      fail("M3", `${pkg} is a dependency but could not be imported — run npm install`);
      continue;
    }
    surfaces.set(pkg, names);
  }
  for (const entry of entries) {
    const surface = surfaces.get(entry.pkg);
    if (!surface) continue;
    for (const name of entry.names) {
      if (!surface.has(name)) {
        fail("M2", `${MAP_FILE}:${entry.line} — ${entry.pkg} does not export \`${name}\``);
      }
    }
  }

  // ------------------------------------------------------------------ M4 ---
  const pathPattern = /`((?:src|scripts|docs|\.storybook|\.claude)\/[A-Za-z0-9_./@-]+)`/g;
  for (const match of text.matchAll(pathPattern)) {
    const named = match[1];
    if (!existsSync(join(root, named))) {
      fail("M4", `${MAP_FILE} points at \`${named}\`, which does not exist`);
    }
  }

  // ------------------------------------------------------------------ M5 ---
  for (const [name, file] of importedSymbols(root)) {
    if (!documented.has(name)) {
      fail(
        "M5",
        `\`${name}\` is imported by ${file} and has no entry — add one to ${MAP_FILE} before shipping it`
      );
    }
  }

  // ----------------------------------------------------------------- M10 ---
  const notRouted = parseNotRouted(text);
  for (const { name, reason } of notRouted) {
    if (!reason) {
      fail("M10", `${MAP_FILE} refuses \`${name}\` without saying why — a bare name is a gap, not a decision`);
    }
    if (documented.has(name)) {
      fail("M10", `${MAP_FILE} both routes and refuses \`${name}\` — pick one`);
    }
  }
  const refused = new Set(notRouted.map((n) => n.name));
  const roster = coreRoster(root, surfaces.get("@mantine/core"));
  if (roster.length < 50) {
    fail(
      "M10",
      `could not read the component roster from node_modules/@mantine/core (${roster.length} found) — ` +
        `the coverage rule cannot run, so it fails rather than passing on nothing`
    );
  } else {
    for (const name of roster) {
      if (!documented.has(name) && !refused.has(name)) {
        fail(
          "M10",
          `@mantine/core ships \`${name}\` and ${MAP_FILE} neither routes nor refuses it — ` +
            `add an entry, or a line under "Deliberately not routed" with the reason`
        );
      }
    }
    for (const name of refused) {
      if (!roster.includes(name)) {
        fail("M10", `${MAP_FILE} refuses \`${name}\`, which @mantine/core no longer ships — drop the line`);
      }
    }
  }

  // ------------------------------------------------------------------ M6 ---
  for (const name of REQUIRED) {
    if (!documented.has(name)) {
      fail("M6", `${MAP_FILE} has no entry for \`${name}\` — a product UI cannot be built without it`);
    }
  }

  // ------------------------------------------------------------------ M7 ---
  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(`\n${section}\n`)) {
      fail("M7", `${MAP_FILE} is missing the "${section}" section`);
    }
  }

  // ------------------------------------------------------------------ M8 ---
  text.split("\n").forEach((line, i) => {
    for (const pattern of DEAD_VOCABULARY) {
      if (pattern.test(line)) {
        fail(
          "M8",
          `${MAP_FILE}:${i + 1} argues in the deleted kit's vocabulary (${pattern.source}) — re-argue it against Mantine`
        );
      }
    }
  });

  // ------------------------------------------------------------------ M9 ---
  const installed = existsSync(join(root, "node_modules/@mantine/core/package.json"))
    ? JSON.parse(readFileSync(join(root, "node_modules/@mantine/core/package.json"), "utf8")).version
    : null;
  const stamped = /@mantine\/core\s+(\d+\.\d+\.\d+)\*\*/.exec(text)?.[1];
  if (!stamped) {
    fail("M9", `${MAP_FILE} carries no "@mantine/core <version>" stamp`);
  } else if (installed && stamped.split(".")[0] !== installed.split(".")[0]) {
    fail(
      "M9",
      `${MAP_FILE} was verified against @mantine/core ${stamped}, but ${installed} is installed — re-read the docs before moving the stamp`
    );
  }

  return { violations, entries, documented, roster, refused };
}

// Importing this module (the rule tests do) must not run the scan or exit.
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const { violations, entries, documented, roster, refused } = await run();
  for (const v of violations) console.log(`FAIL  ${v.rule}  ${v.message}`);
  const covered = roster.filter((n) => documented.has(n) || refused.has(n)).length;
  console.log(
    `\ncapability-lint: ${entries.length} entries covering ${documented.size} exports, ` +
      `${covered}/${roster.length} of @mantine/core answered, ${violations.length} violation(s)`
  );
  process.exit(violations.length > 0 ? 1 : 0);
}
