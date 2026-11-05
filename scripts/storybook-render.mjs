#!/usr/bin/env node
/**
 * Storybook render gate — the pixel half of the Storybook gate.
 *
 * Levels 1 and 2 of the validation hierarchy read text. This one renders every
 * story in a real Chromium at two themes and fails on things static analysis
 * cannot see: a component that mounts but paints nothing, a play function that
 * throws, a canvas that overflows sideways.
 *
 * It exists because `UI/Feedback/Progress` shipped as a fully black canvas for
 * three stories — the source was correct, the render was not.
 *
 * Checks (per story, per theme)
 *   C1  no uncaught page error and no console.error (outside the allowlist)
 *   C2  no play-function exception and no Storybook error display
 *   C3  content box >= MIN_PX in both axes, unless the story renders into a
 *       portal (dialogs legitimately leave #storybook-root empty)
 *   C4  no horizontal overflow at the test viewport
 *   C5  docs pages render, and their GFM tables are actually parsed
 *
 * Usage
 *   node scripts/storybook-render.mjs            # expects storybook-static/
 *   node scripts/storybook-render.mjs --build    # build first
 *   node scripts/storybook-render.mjs --theme dark
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = path.join(ROOT, 'storybook-static');
const PORT = 6017;
const VIEWPORT = { width: 1280, height: 800 };
const MIN_PX = 24;
const CONCURRENCY = 4;

const argv = process.argv.slice(2);
const THEMES = argv.includes('--theme')
  ? [argv[argv.indexOf('--theme') + 1]]
  : ['dark', 'light'];

/**
 * Stories that are *supposed* to produce console noise. Each entry must say
 * why — an unexplained silence here is how a real regression hides.
 */
const EXPECTED_NOISE = [
  {
    // ErrorBoundary's whole job is catching a throw; the stories throw on purpose.
    match: (id) => id.startsWith('shell-overlays-error-boundary--'),
    pattern: /Simulated render crash|ErrorBoundary caught|The above error occurred/i,
  },
  {
    // The point of this story is that a 404 image falls back to initials.
    // The Avatar docs page embeds it, so it inherits the same deliberate 404.
    match: (id) => id === 'ui-data-display-avatar--broken-image' || id === 'ui-data-display-avatar--docs',
    pattern: /Failed to load resource|ERR_(FAILED|NAME_NOT_RESOLVED|CONNECTION)/i,
  },
  {
    // `Load error` stories mock a 500 on purpose to prove the page stays framed.
    match: (id) => id.endsWith('--load-error'),
    pattern: /Failed to load resource.*500|Internal Server Error|Request failed with status code 500|Server Error/i,
  },
];

/** Assertion messages embed a full DOM dump; keep reports readable. */
const MAX_DETAIL = 240;
const trim = (text) => {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > MAX_DETAIL ? `${flat.slice(0, MAX_DETAIL)}…` : flat;
};

function isExpected(storyId, message) {
  return EXPECTED_NOISE.some((e) => e.match(storyId) && e.pattern.test(message));
}

/* -------------------------------------------------------------------------- */
/*                                 static server                              */
/* -------------------------------------------------------------------------- */

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
};

function serve(dir, port) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

/* -------------------------------------------------------------------------- */
/*                              probe (runs in page)                          */
/* -------------------------------------------------------------------------- */

/**
 * Installed before every navigation. Storybook's addon channel is the only
 * reliable signal for a play-function failure — a thrown assertion is caught
 * by the preview and never reaches `pageerror`.
 */
const PROBE = `
window.__probe = { phases: [], errors: [] };
(function attach() {
  const ch = window.__STORYBOOK_ADDONS_CHANNEL__;
  if (!ch) return setTimeout(attach, 10);
  const push = (prefix) => (e) =>
    window.__probe.errors.push(prefix + ': ' + (e && (e.message || e.title || e.name) || String(e)));
  ch.on('storyRenderPhaseChanged', (e) => e && window.__probe.phases.push(e.newPhase));
  ch.on('playFunctionThrewException', push('play'));
  ch.on('storyThrewException', push('story'));
  ch.on('unhandledErrors', push('unhandled'));
})();
`;

async function measure(page) {
  return page.evaluate((minPx) => {
    const root = document.getElementById('storybook-root');
    const de = document.documentElement;
    const errorDisplay = document.querySelector('.sb-show-errordisplay, #error-message');
    // Dialogs/menus render into a portal on <body>, leaving root legitimately
    // empty. Count body children that are not the root/docs containers.
    const portals = [...document.body.children].filter(
      (el) => el.id !== 'storybook-root' && el.id !== 'storybook-docs' && el.tagName !== 'SCRIPT',
    ).length;
    const r = root ? root.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      portals,
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      hasErrorDisplay: Boolean(errorDisplay && errorDisplay.textContent.trim()),
      probe: window.__probe ?? { phases: [], errors: [] },
      tooSmall: Boolean(root) && (r.width < minPx || r.height < minPx),
      docs: (() => {
        const docs = document.getElementById('storybook-docs');
        if (!docs) return null;
        const dr = docs.getBoundingClientRect();
        // A GFM table that the compiler did not parse renders as one <p> full
        // of pipes. Real prose in this design system never does that.
        const rawTable = [...docs.querySelectorAll('p')].some(
          (el) => (el.textContent.match(/\|/g) ?? []).length >= 4,
        );
        return { w: Math.round(dr.width), h: Math.round(dr.height), rawTable };
      })(),
    };
  }, MIN_PX);
}

/* -------------------------------------------------------------------------- */
/*                                    main                                    */
/* -------------------------------------------------------------------------- */

if (argv.includes('--build')) {
  console.log('storybook-render: building storybook-static…');
  execFileSync('npx', ['storybook', 'build', '-o', 'storybook-static', '--quiet'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

const indexPath = path.join(STATIC_DIR, 'index.json');
if (!fs.existsSync(indexPath)) {
  console.error(
    `storybook-render: ${path.relative(ROOT, indexPath)} not found — run with --build first.`,
  );
  process.exit(1);
}

const entries = Object.values(JSON.parse(fs.readFileSync(indexPath, 'utf8')).entries);
// Docs pages are rendered too. Skipping them is how every MDX table in this
// Storybook shipped as a run-on paragraph of pipe characters: remark-gfm was
// never enabled, and no gate ever looked at a docs page.
const stories = entries.filter((e) => e.type === 'story' || e.type === 'docs');

const server = await serve(STATIC_DIR, PORT);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT });
await context.addInitScript(PROBE);

const jobs = THEMES.flatMap((theme) => stories.map((story) => ({ story, theme })));
const failures = [];
let done = 0;

async function runJob(page, { story, theme }) {
  const consoleErrors = [];
  const onPageError = (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 300)}`);
  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text().slice(0, 300)}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  const url = `http://localhost:${PORT}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`;
  const where = `${story.title} / ${story.name} [${theme}]`;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // Let the play function and any entry animation settle.
    await page.waitForFunction(
      () => window.__probe && window.__probe.phases.some((p) => p === 'completed' || p === 'errored'),
      { timeout: 15000 },
    ).catch(() => {});
    await page.waitForTimeout(400);

    const m = await measure(page);

    /* C1 — console / page errors */
    const unexpected = consoleErrors.filter((e) => !isExpected(story.id, e));
    if (unexpected.length) {
      failures.push({ id: story.id, where, check: 'C1', detail: trim(unexpected[0]) });
    }

    /* C2 — play / render exceptions */
    const probeErrors = (m.probe.errors ?? []).filter((e) => !isExpected(story.id, e));
    if (probeErrors.length) {
      failures.push({ id: story.id, where, check: 'C2', detail: trim(probeErrors[0]) });
    } else if (m.hasErrorDisplay && !isExpected(story.id, 'error display')) {
      failures.push({ id: story.id, where, check: 'C2', detail: 'Storybook error display is visible' });
    }

    /* C3 — painted something */
    if (story.type === 'story' && m.tooSmall && m.portals === 0) {
      failures.push({
        id: story.id,
        where,
        check: 'C3',
        detail: `content box ${m.w}x${m.h}px is under ${MIN_PX}px and nothing rendered into a portal — the story paints an empty canvas`,
      });
    }

    /* C5 — docs pages render, and their markdown is actually parsed */
    if (story.type === 'docs') {
      if (!m.docs || m.docs.h < MIN_PX) {
        failures.push({
          id: story.id,
          where,
          check: 'C5',
          detail: `docs page rendered ${m.docs ? `${m.docs.w}x${m.docs.h}px` : 'nothing'}`,
        });
      } else if (m.docs.rawTable) {
        failures.push({
          id: story.id,
          where,
          check: 'C5',
          detail: 'a paragraph contains 4+ pipe characters — a GFM table was not parsed (is remark-gfm enabled in main.ts?)',
        });
      }
    }

    /* C4 — no sideways scroll */
    if (m.scrollW > m.clientW + 1) {
      failures.push({
        id: story.id,
        where,
        check: 'C4',
        detail: `horizontal overflow: scrollWidth ${m.scrollW} > viewport ${m.clientW}`,
      });
    }
  } catch (err) {
    failures.push({ id: story.id, where, check: 'C1', detail: `navigation failed: ${String(err).slice(0, 200)}` });
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    done += 1;
    if (done % 50 === 0) process.stdout.write(`  …${done}/${jobs.length}\n`);
  }
}

console.log(
  `storybook-render: ${stories.length} stories x ${THEMES.length} theme(s) = ${jobs.length} renders`,
);

const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    const page = await context.newPage();
    while (queue.length) await runJob(page, queue.shift());
    await page.close();
  }),
);

await browser.close();
server.close();

const report = { viewport: VIEWPORT, themes: THEMES, renders: jobs.length, failures };
fs.writeFileSync(path.join(ROOT, 'storybook-render-report.json'), JSON.stringify(report, null, 2));

if (failures.length === 0) {
  console.log(`storybook-render: ${jobs.length} renders OK`);
  process.exit(0);
}

console.error(`\nstorybook-render: ${failures.length} failure(s)\n`);
const byCheck = failures.reduce((acc, f) => ((acc[f.check] ||= []).push(f), acc), {});
for (const check of Object.keys(byCheck).sort()) {
  console.error(`${check} (${byCheck[check].length})`);
  for (const f of byCheck[check]) console.error(`  ${f.where}\n    ${f.detail}`);
  console.error('');
}
process.exit(1);
