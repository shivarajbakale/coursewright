#!/usr/bin/env node
/**
 * ui-lint — the design-system contract, enforced statically.
 *
 * Two contracts live here, and they fail for different reasons.
 *
 * 1. **Do not hand-roll a primitive.** A `<span className="rounded-full px-2
 *    text-xs font-medium">` instead of `Badge`, a raw `<button>` instead of
 *    `Button`. Those copies look right on the day they are written and drift
 *    the first time the system changes — a new radius, a new focus ring reaches
 *    the component and not the copy.
 *
 * 2. **Mantine owns everything a screen looks like** — colour, border, radius,
 *    elevation and layout. This app ships one styling system, so a utility
 *    class in `src/` is a class nothing emits: it reads as styling and does
 *    nothing. That is the `boundary` rule. It routed through a migration debt
 *    list until `mantine-005` emptied and deleted it; `readDebt` is what would
 *    notice its return.
 *
 * Run it with `npm run ui-lint` (part of `make check`).
 *
 * Every rule is a single regex tested against one line at a time, with comments
 * stripped first. Nothing under `src/` is exempt any more: the kit that used to
 * be — the one directory allowed to contain a raw element — was deleted by
 * `mantine-005`, and Mantine's own components are not this repo's source.
 *
 * Adding a component? Add the rule that stops the next person hand-rolling it.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const SRC = join(projectRoot, "src");
/*
 * `.storybook/` is scanned too, and it is not an afterthought.
 *
 * The decorators there wrap every story — a memory router in a fixed-height
 * frame, the shell in a full-viewport box. They were the last two files in the
 * app still writing `h-svh` and `h-[420px]`, and when Tailwind went away those
 * classes silently resolved to nothing: five command-palette stories reported
 * "rendered nothing with area" and seven page stories reported the document
 * scrolling, none of which named a decorator. Anything that lays out a story is
 * on the same boundary as the components it frames.
 */
const STORYBOOK = join(projectRoot, ".storybook");

/**
 * App.css / index.css are where the tokens themselves are defined, and the
 * `_overview` stories are where they are painted for a reader — the swatch
 * grid, the type scale, and the page that demonstrates the primitives. In all
 * three a raw token value is the subject rather than the drift.
 *
 * `src/components/ui/` used to be exempt too: the kit wrapped the raw
 * primitives, which was its job. `mantine-005` deleted the kit, so nothing in
 * this repo has that excuse any more and every rule applies to every component.
 */
const EXEMPT = ["/App.css", "/index.css", "/components/_overview/"];

/** Raw palette colour names. Every colour in this app is a theme colour. */
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

/**
 * Raw-element matcher.
 *
 * `(?=[\s>/]|$)` rather than `[\s>]`: prettier wraps any tag with more than a
 * couple of attributes, which leaves `<button` alone on its line with nothing
 * after it. The old character class required a following character, so every
 * multi-line JSX tag — which is to say every real one — walked straight past
 * the rule.
 */
const rawElement = (tag) => new RegExp(`<${tag}(?=[\\s>/]|$)`);

export const RULES = [
  {
    id: "raw-table",
    pattern: rawElement("table"),
    message: "raw <table> — use Mantine `Table`, or the data-table composite for sorting and filtering",
  },
  {
    id: "raw-button",
    pattern: rawElement("button"),
    message: "raw <button> — use Mantine `Button` or `ActionIcon` (variant + size carry the styling)",
  },
  {
    id: "raw-input",
    pattern: rawElement("input"),
    message: "raw <input> — use Mantine `TextInput` (or `Checkbox`/`Radio`/`Switch` for the toggles)",
  },
  {
    id: "raw-textarea",
    pattern: rawElement("textarea"),
    message: "raw <textarea> — use Mantine `Textarea`, which carries the same label and error slots",
  },
  {
    id: "raw-select",
    pattern: rawElement("select"),
    message: "raw <select> — use Mantine `Select`, which is searchable and keyboard-navigable",
  },
  {
    id: "hand-rolled-badge",
    // A pill: round, padded, small, and emphasised. The status dot inside a
    // Badge (`size-1.5 rounded-full bg-current`) has no padding or type, and a
    // numbered step circle has no horizontal padding — neither trips this.
    pattern:
      /(?=.*\brounded-full\b)(?=.*(?<![\w-])px-\d)(?=.*\btext-(?:xs|\[1[0-2]px\])\b)(?=.*\bfont-medium\b)/,
    message:
      "hand-rolled badge — use Mantine `Badge` (color + variant carry the tone; `light` is the muted pill)",
  },
  {
    id: "hand-rolled-card",
    // The kit's card surface, retyped by hand. Card owns the radius, the
    // border, the surface token, and the `data-panel` the ui-probe measures.
    pattern: /(?=.*\brounded-(?:lg|xl)\b)(?=.*(?<![\w-])border\b)(?=.*\bbg-card\b)/,
    message:
      "hand-rolled card — use Mantine `Card` or `Paper withBorder`, which own the radius, the border and the `--app-surface` tone",
  },
  {
    id: "hand-rolled-progress",
    pattern: /style=\{\{\s*width:\s*`\$\{/,
    message:
      "hand-rolled progress bar — use Mantine `Progress`, which carries the accessible role and value",
  },
  {
    id: "hardcoded-color",
    pattern: new RegExp(
      `(?<![\\w-])(?:hover:|focus:|active:|dark:|group-hover:)*(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:${PALETTE})-\\d{2,3}\\b`
    ),
    message:
      "raw Tailwind palette colour — Mantine owns colour (`c=\"dimmed\"`, `color=\"red\"`, `variant=\"light\"`). A literal palette class is tuned for one scheme and wrong in the other",
  },
  {
    id: "native-dialog",
    pattern: /(?<![\w.])(?:confirm|alert)\s*\(/,
    message:
      "native confirm()/alert() — use Mantine `modals.openConfirmModal`; a native dialog is unstyled, unthemed and blocks the main thread",
  },
  {
    id: "page-scroll",
    pattern: /overflow(-[xy])?-(auto|scroll)/,
    message:
      "scroll container outside the design system — the shell is a fixed viewport; scroll inside a ScrollArea (see PageShell)",
  },
  {
    id: "viewport-height",
    pattern: /(?=.*\b(?<!min-)h-(screen|svh)\b)(?!.*\boverflow-hidden\b)/,
    message:
      "h-screen/h-svh without overflow-hidden — declare the fixed viewport and clip it in the same place, or use min-h-*",
  },
  {
    id: "raw-shadow",
    pattern: /shadow-\[/,
    message:
      "arbitrary shadow value — elevation is a theme step; pass `shadow=\"sm|md|lg\"`, or retune `theme.shadows` in src/theme.ts",
  },
  {
    id: "raw-font",
    pattern: /font-\['/,
    message: "arbitrary font family — typography is a theme value; set `fontFamily` in src/theme.ts",
  },
  {
    id: "raw-duration",
    pattern: /duration-\[/,
    message:
      "arbitrary transition duration — motion is a token; an ad-hoc duration will not respect the motion scale",
  },
  /*
   * The motion rules.
   *
   * Motion is a token layer like colour and spacing (`src/lib/motion.ts`), and
   * it drifts the same way: one component reaches for `0.35` because it looked
   * right that afternoon, and the app ends up with fourteen ideas of how fast
   * it moves. These rules are `.tsx`-only by construction — the walker only
   * visits components — so the token file itself, which has to write the
   * numbers down somewhere, is not a violation of its own scale.
   */
  {
    id: "raw-motion-duration",
    // `duration: 0.35`. Not `duration: durations.base`, not `duration={x}`.
    pattern: /(?<![\w.])duration:\s*\d/,
    message:
      "literal motion duration \u2014 import `durations` / `transitions` from `@/lib/motion`; a number here is off the scale the rest of the app moves on",
  },
  {
    id: "raw-motion-easing",
    // `ease: [0.4, 0, 0.2, 1]` or `ease: "easeOut"`.
    pattern: /(?<![\w.])ease:\s*['"[]/,
    message:
      "literal easing \u2014 use `easings.out` (entrances) or `easings.in` (exits) from `@/lib/motion`; an entrance on an ease-in curve is what makes an app feel like it is thinking",
  },
  {
    id: "transition-all",
    pattern: /(?<![\w-])transition-all(?![\w-])/,
    message:
      "transition-all \u2014 name the property (`transition-colors`, `transition-opacity`). `all` animates layout and paint properties nobody meant to animate, and it is the cheapest frame drop in the app",
  },
  {
    id: "framer-legacy-import",
    pattern: /from ['"]framer-motion['"]/,
    message:
      "`framer-motion` \u2014 the package is `motion` and the React entry point is `motion/react`. Two import specifiers for one library ship it twice",
  },
  {
    id: "raw-spacing",
    pattern:
      /(?<![\w-])(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\[/,
    message:
      "arbitrary spacing value — spacing is a 4px scale; an off-scale value is the thing that makes a layout look hand-placed",
  },
  {
    id: "raw-hex",
    pattern: /(?<![\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/,
    message:
      "raw hex colour — colours live in the theme; use a Mantine colour prop or a `--mantine-color-*` value, and retune the ramp in src/theme.ts",
  },
  /*
   * The boundary rule.
   *
   * There is one styling system: Mantine owns colour, border, radius,
   * elevation *and* layout. This rule used to be four, splitting utility
   * classes into "Mantine's" (colour, border, radius, shadow — banned) and
   * "Tailwind's" (flex, grid, gap, padding, sizing — allowed), because the app
   * ran both frameworks. `mantine-011` removed Tailwind, so the split is gone
   * and what is left is simpler to state and to check: a screen composes with
   * components and style props, and a utility class in this tree is a class
   * nothing emits.
   *
   * Two classes are this app's own, declared in `src/App.css`: `bg-grid` and
   * `bg-radial-fade` paint the auth panel's backdrop, which is decoration
   * rather than surface. CSS-module hooks come through `className={styles.x}`,
   * an expression rather than a string literal, and are not matched here.
   *
   * `boundary: true` routes a finding through the debt list in
   * `scripts/ui-lint.tailwind-debt.json` if one exists. It does not — the file
   * was deleted with the last entry it held — so the rule is enforced
   * everywhere, and `readDebt` is what would notice the list's return.
   */
  {
    id: "mantine-owns-layout",
    boundary: true,
    // A string-literal className carrying anything shaped like a utility class.
    // The alternation is the common Tailwind vocabulary; `bg-` excludes this
    // app's own two painted backdrops.
    pattern: new RegExp(
      `className="[^"]*(?<![\\w-])(?:hover:|focus:|focus-visible:|active:|disabled:|dark:|group-hover:|sm:|md:|lg:|xl:|2xl:|@[a-z0-9]+:|data-\\[[^\\]]+\\]:)*` +
        `(?:flex|grid|block|inline|contents|hidden|absolute|relative|fixed|sticky|static|truncate|underline|uppercase|lowercase|capitalize|antialiased|` +
        `border|rounded|shadow|drop-shadow|ring|isolate|` +
        `bg-(?!grid\\b|radial-fade\\b)|text-|font-|tracking-|leading-|` +
        `w-|h-|min-|max-|size-|p[trblxyse]?-|m[trblxyse]?-|gap-|space-[xy]-|` +
        `items-|justify-|self-|place-|content-|order-|basis-|col-|row-|` +
        `z-|overflow-|opacity-|object-|aspect-|whitespace-|break-|list-|divide-|` +
        `cursor-|select-|pointer-events-|transition|duration-|ease-|animate-|` +
        `scale-|rotate-|translate-|backdrop-|tabular-nums)` +
        `(?:[a-z0-9./\\[\\]%-]*)?(?=["\\s])`
    ),
    message:
      "utility class — Mantine owns layout as well as colour. Compose with Group/Stack/Flex/Grid/SimpleGrid or a style prop (`p`, `gap`, `w`, `pos`); no framework in this app emits utility classes, so this one styles nothing",
  },
  {
    id: "raw-rgb-hsl-oklch",
    // Match raw rgb/hsl/oklch/oklab calls that don't wrap a `var(--token)`.
    // `hsl(var(--border))` is the canonical shadcn pattern for SVG strokes
    // and gradients — it goes through the token, so it doesn't count as
    // hand-picked. We only catch literal channel values (e.g. `rgb(255,0,0)`,
    // `oklch(0.6 0.2 250)`).
    pattern: /\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(\s*(?!var\s*\()/,
    message:
      "raw colour function — colours are tokens; add or retune a token in App.css instead of inlining rgb()/hsl()/oklch()",
  },
];

/** Documentation is where these rules get explained — never lint the prose. */
function stripComments(source) {
  // Blank the comment out rather than deleting it. Collapsing a multi-line block
  // comment to "" removes its newlines, so every finding below it is reported at
  // the wrong line — the reader opens the file and the cited line is innocent.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx$/.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * The migration debt list for the boundary rules.
 *
 * Every file still carrying utility classes would be named here. The list may only shrink: `mantine-005` deletes it along with the
 * last entry, and from then on the boundary rules are enforced everywhere with
 * no escape hatch. A missing file means exactly that — the migration is done.
 */
const DEBT_FILE = join(__dirname, "ui-lint.tailwind-debt.json");

export function readDebt() {
  if (!existsSync(DEBT_FILE)) return null;
  const { files } = JSON.parse(readFileSync(DEBT_FILE, "utf8"));
  return new Set(files);
}

export function run({ debt = readDebt() } = {}) {
  const findings = [];
  const boundary = [];
  let scanned = 0;
  if (!existsSync(SRC)) return { scanned, findings, missingRoot: true };

  const roots = [SRC, ...(existsSync(STORYBOOK) ? [STORYBOOK] : [])];
  for (const file of roots.flatMap((root) => walk(root))) {
    const rel = relative(projectRoot, file);
    if (EXEMPT.some((fragment) => `/${rel}`.includes(fragment))) continue;

    scanned++;
    stripComments(readFileSync(file, "utf8"))
      .split("\n")
      .forEach((line, i) => {
        for (const rule of RULES) {
          if (!rule.pattern.test(line)) continue;
          const finding = { file: rel, line: i + 1, rule: rule.id, message: rule.message };
          (rule.boundary ? boundary : findings).push(finding);
        }
      });
  }

  // A file on the debt list is allowed to violate the boundary rules; anything
  // else is not. Both halves of the ratchet are reported, because a list that
  // is allowed to go stale stops being a deadline and becomes a permission.
  const listed = debt ?? new Set();
  const enforced = boundary.filter((f) => !listed.has(f.file));
  const violating = new Set(boundary.map((f) => f.file));
  const stale = [...listed].filter((f) => !violating.has(f));

  return {
    scanned,
    findings: [...findings, ...enforced],
    missingRoot: false,
    boundary: { total: boundary.length, allowed: boundary.length - enforced.length, stale },
  };
}

// Importing this module (the rule tests do) must not run the scan or exit.
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = run();
  if (result.missingRoot) {
    console.log("ui-lint: src/ not found — nothing scanned");
    process.exit(1);
  }
  for (const f of result.findings) {
    console.log(`FAIL  ${f.file}:${f.line}  ${f.rule} — ${f.message}`);
  }
  for (const file of result.boundary.stale) {
    console.log(
      `FAIL  ${file}  stale-debt — no boundary violations left here; remove it from scripts/ui-lint.tailwind-debt.json`
    );
  }
  const { total, allowed, stale } = result.boundary;
  if (total > 0) {
    console.log(
      `\nui-lint: boundary rules — ${allowed} finding(s) still on the migration debt list, ${total - allowed} enforced`
    );
  }
  const failures = result.findings.length + stale.length;
  console.log(`\nui-lint: ${result.scanned} components scanned, ${failures} violation(s)`);
  process.exit(failures > 0 ? 1 : 0);
}
