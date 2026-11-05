#!/usr/bin/env node
/**
 * doc-links — the capability map's sources are load-bearing, so they are checked.
 *
 * The map tells an agent which Mantine component to reach for and which prop
 * actually exists. Its authority comes entirely from the documentation it was
 * read from, and that authority decays two ways: a page moves, or the map is
 * simply old — and Mantine renames props across majors, which is exactly the
 * kind of drift that reads fine and compiles into a runtime surprise.
 *
 * Two modes, deliberately split:
 *
 *   default   Offline. Every source URL is well-formed, https, on Mantine's own
 *             documentation domain, and unique; and the map's
 *             "verified against … on **YYYY-MM-DD**" stamp is not older than
 *             MAX_AGE_DAYS. This is what runs inside `make check` — a build
 *             gate must never need the network.
 *
 *   --online  Additionally fetches every URL and fails on a non-2xx. Run it on a
 *             schedule or by hand; a link that 404s means the entry it backs is
 *             suspect, not that your build is broken.
 *
 * `capability-lint` is the other half: it checks what the map says against the
 * installed packages and the source tree. This one checks where the map got it.
 *
 * Dependency-free: Node stdlib only.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

/**
 * How stale a map may get before the build says so.
 *
 * Six months is a compromise: long enough that this is not noise, short enough
 * that a map cannot quietly rot for a year while agents act on it. Re-reading
 * the sources and moving the date is the fix — never widening this number.
 */
const MAX_AGE_DAYS = 180;

/**
 * Maps to check, and the domain each one's sources must come from.
 *
 * The domain allowlist is the point: a reference that starts citing blog posts
 * and Stack Overflow answers has stopped being a reference. TanStack is here
 * because the table and the router are the two libraries Mantine components are
 * routinely handed to.
 */
const MAPS = [
  {
    file: ".claude/skills/use-mantine/mantine-capabilities.md",
    domains: ["mantine.dev", "tanstack.com", "developer.mozilla.org"],
  },
];

const online = process.argv.includes("--online");
const violations = [];
const fail = (rule, message) => violations.push({ rule, message });

const present = MAPS.filter((m) => existsSync(join(projectRoot, m.file)));
if (present.length === 0) {
  console.error("doc-links: no capability map found — nothing to check");
  process.exit(1);
}

const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
let urlCount = 0;
const toFetch = [];

for (const map of present) {
  const rel = map.file;
  const md = readFileSync(join(projectRoot, rel), "utf8");

  // --- D1: the map records when it was read ----------------------------------
  const stamp = md.match(/\*\*(\d{4}-\d{2}-\d{2})\*\*/)?.[1];
  if (!stamp) {
    fail("D1", `${rel} records no "verified against … on **YYYY-MM-DD**" date`);
  } else {
    const read = new Date(stamp + "T00:00:00Z");
    if (Number.isNaN(read.getTime())) {
      fail("D1", `${rel} has an unparseable verification date: ${stamp}`);
    } else {
      const days = Math.floor((today - read) / 86_400_000);
      if (days < 0) {
        fail("D1", `${rel} claims it was verified in the future (${stamp})`);
      } else if (days > MAX_AGE_DAYS) {
        fail(
          "D1",
          `${rel} was last verified ${days} days ago (${stamp}), over the ${MAX_AGE_DAYS}-day limit — ` +
            `re-read the sources and move the date, rather than raising the limit`,
        );
      }
    }
  }

  // --- D2: the sources are the vendor's own documentation --------------------
  const sources = md.split(/^## Sources$/m)[1];
  if (!sources) {
    fail("D2", `${rel} has no "## Sources" section`);
    continue;
  }
  const urls = [...sources.matchAll(/<(https?:\/\/[^>\s]+)>|\((https?:\/\/[^)\s]+)\)/g)].map(
    (m) => m[1] ?? m[2],
  );
  if (urls.length === 0) {
    fail("D2", `${rel}'s Sources section lists no links`);
    continue;
  }
  const seen = new Set();
  for (const raw of urls) {
    urlCount++;
    let url;
    try {
      url = new URL(raw);
    } catch {
      fail("D2", `${rel} lists an unparseable URL: ${raw}`);
      continue;
    }
    if (url.protocol !== "https:") {
      fail("D2", `${rel} cites ${raw} over ${url.protocol} — documentation links are https`);
    }
    if (!map.domains.some((d) => url.hostname === d || url.hostname.endsWith("." + d))) {
      fail(
        "D2",
        `${rel} cites ${url.hostname}, which is not one of ${map.domains.join(", ")} — ` +
          `a reference cites the vendor, not a third party`,
      );
    }
    if (seen.has(raw)) fail("D2", `${rel} lists ${raw} twice`);
    seen.add(raw);
    if (online) toFetch.push({ rel, raw });
  }
}

// --- D3: the pages still exist (online only) ---------------------------------

if (online && toFetch.length) {
  const check = async ({ rel, raw }) => {
    const attempt = async (method) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        return await fetch(raw, { method, redirect: "follow", signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      // Some documentation hosts refuse HEAD outright; a GET that follows is
      // the honest check, and the body is discarded.
      let res = await attempt("HEAD");
      if (res.status === 405 || res.status === 403) res = await attempt("GET");
      if (!res.ok) fail("D3", `${rel}: ${raw} returned ${res.status}`);
    } catch (err) {
      fail("D3", `${rel}: ${raw} could not be reached (${err.name === "AbortError" ? "timeout" : err.message})`);
    }
  };
  // Serial on purpose: a documentation host that sees twenty parallel requests
  // from one address rate-limits, and a 429 would read as a dead link.
  for (const item of toFetch) await check(item);
}

// --- report -------------------------------------------------------------------

if (violations.length) {
  console.error(`\ndoc-links: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`  [${v.rule}] ${v.message}`);
  console.error("");
  process.exit(1);
}

console.log(
  `doc-links: ${present.length} map(s), ${urlCount} source link(s)` +
    (online ? ", all reachable" : " (offline checks; add --online to fetch them)") +
    ", 0 violations",
);
