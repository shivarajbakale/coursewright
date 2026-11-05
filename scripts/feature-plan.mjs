#!/usr/bin/env node
/**
 * feature-plan.mjs — validate a feature-plan.json and render it to FEATURE-PLAN.md.
 *
 * Why this exists
 * ---------------
 * The composer plans whole products from nothing (`/rocketship-new` → PLAN.md).
 * Nothing planned a *feature inside an app that already exists*: `add-feature`
 * starts writing files at step 2, so the first reviewable artifact was a diff.
 * By then the layout argument is expensive.
 *
 * This renders the review artifact first, and renders it DETERMINISTICALLY —
 * every diagram is drawn from the plan's own nodes, never free-drawn, so the
 * picture cannot disagree with what gets built. Same guarantee as the
 * composer's plan.mjs, applied to a feature.
 *
 * The wireframes key off `archetype`, which is not a word invented for this
 * file: `PageShell` declares `data-archetype` and the UI probe's Module B
 * (scripts/ui-probe/rules/archetype.ts) asserts that exact shape against the
 * real DOM at three widths. So the frame you approve here is the frame the gate
 * later enforces — B1-B4 are the wireframe's teeth.
 *
 * Usage
 * -----
 *   node scripts/feature-plan.mjs <plan.json>                  # print
 *   node scripts/feature-plan.mjs <plan.json> -o FEATURE-PLAN.md
 *   node scripts/feature-plan.mjs <plan.json> --check          # validate only
 *
 * Dependency-free (Node built-ins only) and idempotent.
 */

import fs from "node:fs";
import path from "node:path";

// --- vocabulary --------------------------------------------------------------

/**
 * The eight shapes `docs/principles/screen-archetypes.md` declares.
 *
 * `PageShell` publishes the same words as `data-archetype` and Module B of the
 * UI probe checks them in a real browser. A ninth shape is a change to that
 * document first, to this list and `PageShell`'s union second, and to
 * `scripts/ui-probe/rules/archetype.ts` third — `plan-lint`'s P5 fails while
 * the four disagree.
 */
export const ARCHETYPES = [
  "dashboard-grid",
  "list",
  "list-detail",
  "detail",
  "form",
  "settings",
  "sequence",
  "centered-card",
];

/** Which probe rules bite for each archetype — printed into the plan so the
 *  reviewer can see what the drawing will be held to. */
const ARCHETYPE_RULES = {
  list: [
    "B8 — exactly one <h1>, and it names the collection",
    "B8 — a collection region (<table>, <ul>, <ol> or role=list) is present",
    "B8 — a filter or scope control, pinned above the rows rather than inside them",
    "B8 — one primary action, outside the scroll region",
  ],
  "list-detail": [
    "B1 — two or more top-level panels sharing a top edge",
    "B2 — no panel scrolls; PageShell owns the single scroll region",
  ],
  "dashboard-grid": [
    "B4 — tiles align to a grid; no orphan row with one tile carrying no ink",
    "B2 — the grid does not scroll independently",
  ],
  form: [
    "B3 — a form archetype contains a real <form> element",
    `B3 — the form column stays under ${640}px wide`,
  ],
  "centered-card": [
    "B4 — the card is centred on both axes and stays under 480px wide",
    "B4 — a centred-card view does not scroll",
  ],
  detail: [
    "B5 — exactly one <h1>, and it names the subject",
    "B5 — content in at least two declared sections (data-section)",
    "B5 — the primary action is pinned outside the scroll region",
  ],
  settings: [
    "B6 — a section rail: a <nav>, role=navigation, or a tab strip",
    "B6 — one vertical scroll region, and it is the content column",
    "B6 — no switch inside a form with a submit; a switch applies on change",
  ],
  sequence: [
    "B7 — exactly one step on screen at a time",
    "B7 — progress is declared and sits in the top half",
    "B7 — a back affordance exists (data-back) and never destroys an answer",
  ],
};

/** Every async surface owes all four. Missing one is a bug, not a shortcut. */
const REQUIRED_STATES = ["loading", "empty", "error", "success"];

// --- validation --------------------------------------------------------------

export function validateFeaturePlan(plan) {
  const e = [];
  const need = (cond, msg) => { if (!cond) e.push(msg); };

  need(plan && typeof plan === "object", "plan must be an object");
  if (!plan || typeof plan !== "object") return e;

  const f = plan.feature;
  need(f && typeof f === "object", "feature: required object");
  if (f) {
    need(typeof f.id === "string" && /^[a-z][a-z0-9-]*$/.test(f.id),
      "feature.id: required kebab-case string");
    need(typeof f.title === "string" && f.title.length > 0, "feature.title: required");
    need(typeof f.problem === "string" && f.problem.length > 0,
      "feature.problem: required — a plan with no problem statement cannot be reviewed");
  }

  need(Array.isArray(plan.surfaces) && plan.surfaces.length > 0,
    "surfaces: at least one required");
  for (const [i, s] of (plan.surfaces ?? []).entries()) {
    const at = `surfaces[${i}]`;
    need(typeof s.id === "string", `${at}.id: required`);
    need(typeof s.name === "string", `${at}.name: required`);
    need(ARCHETYPES.includes(s.archetype),
      `${at}.archetype: must be one of ${ARCHETYPES.join(" | ")} (got ${JSON.stringify(s.archetype)})`);
    need(Array.isArray(s.panels) && s.panels.length > 0,
      `${at}.panels: at least one required — a surface with no panels cannot be drawn`);
    // The peak and the end are named before the layout is drawn. A surface
    // whose author cannot say which moment the user takes away is a surface
    // with neither — see docs/principles/emotional-design.md.
    need(s.moments && typeof s.moments === "object",
      `${at}.moments: required — name the peak and the end (docs/principles/emotional-design.md)`);
    for (const m of ["peak", "end"]) {
      need(s.moments && typeof s.moments[m] === "string" && s.moments[m].length > 0,
        `${at}.moments.${m}: required — ${m === "peak"
          ? "the one moment the user came for"
          : "the last impression before they leave"}`);
    }
    for (const st of REQUIRED_STATES) {
      need(s.states && typeof s.states[st] === "string" && s.states[st].length > 0,
        `${at}.states.${st}: required — every async surface renders all four states`);
    }
    // Four archetypes have a floor on how many panels can express them. A plan
    // under the floor draws a wireframe the probe would refuse, so it is caught
    // while it is still a document.
    const panels = (s.panels ?? []).length;
    if (s.archetype === "list") {
      need(panels >= 1,
        `${at}: list needs at least one panel — the collection itself (probe rule B8)`);
    }
    if (s.archetype === "list-detail") {
      need(panels >= 2,
        `${at}: list-detail needs at least two panels — the master and the detail (probe rule B1)`);
    }
    if (s.archetype === "detail") {
      need(panels >= 2,
        `${at}: detail needs at least two panels — one wall of content is not a record (probe rule B5)`);
    }
    if (s.archetype === "settings") {
      need(panels >= 2,
        `${at}: settings needs at least two panels — one group is a form, not a settings page`);
    }
    if (s.archetype === "sequence") {
      need(panels >= 2,
        `${at}: sequence needs at least two panels, one per step — a one-step sequence is a form`);
    }
  }

  for (const [i, c] of (plan.components ?? []).entries()) {
    const at = `components[${i}]`;
    need(typeof c.control === "string", `${at}.control: required`);
    need(typeof c.why === "string" && c.why.length > 0,
      `${at}.why: required — an unjustified control choice is the thing this plan exists to surface`);
  }

  for (const [i, o] of (plan.overlays ?? []).entries()) {
    need(["dialog", "alert-dialog", "sheet", "drawer", "popover"].includes(o.kind),
      `overlays[${i}].kind: must be dialog | alert-dialog | sheet | drawer | popover`);
  }

  return e;
}

// --- ascii primitives --------------------------------------------------------
//
// Everything below composes fixed-width line arrays. Keeping every block
// rectangular is what makes horizontal joins safe and the output byte-stable.

// The shell is a fixed grid: DESKTOP_W is the outer width and every row —
// border, divider, content — must resolve to exactly it, or the box tears.
// bodyW is what's left after both frame edges, the sidebar, and its divider.
const DESKTOP_W = 78;
const SIDEBAR_W = 15;
const BODY_W = DESKTOP_W - SIDEBAR_W - 5;
const MOBILE_W = 28;

/** Mirrors `src/config/nav.ts`. A plan may override with `plan.nav`. */
const DEFAULT_NAV = ["Dashboard", "Customers", "Inbox", "Team", "Billing", "Settings"];

/** Truncate or pad to exactly n columns. Box-drawing chars are single-width. */
function pad(s, n) {
  const t = String(s ?? "");
  if (t.length > n) return n <= 1 ? t.slice(0, n) : t.slice(0, n - 1) + "…";
  return t + " ".repeat(n - t.length);
}

function centre(s, n) {
  const t = String(s ?? "");
  if (t.length >= n) return pad(t, n);
  const left = Math.floor((n - t.length) / 2);
  return " ".repeat(left) + t + " ".repeat(n - t.length - left);
}

const rule = (n) => "─".repeat(n);

/** A bordered box of exact width `w` (borders included). */
function boxOf(w, rows) {
  const inner = w - 2;
  const out = ["┌" + rule(inner) + "┐"];
  for (const r of rows) {
    if (r === "---") out.push("├" + rule(inner) + "┤");
    else out.push("│" + pad(r, inner) + "│");
  }
  out.push("└" + rule(inner) + "┘");
  return out;
}

/** Place blocks side by side, padding short ones so the result stays square. */
function hjoin(blocks, gap = 1) {
  const widths = blocks.map((b) => Math.max(...b.map((l) => l.length), 0));
  const height = Math.max(...blocks.map((b) => b.length));
  const spacer = " ".repeat(gap);
  const out = [];
  for (let i = 0; i < height; i++) {
    out.push(blocks.map((b, j) => pad(b[i] ?? "", widths[j])).join(spacer).replace(/\s+$/, ""));
  }
  return out;
}

/** Lay `cells` out as columns sized to their widest entry. */
function columnize(rows, width) {
  if (!rows.length) return [];
  const cells = rows.map((r) => (Array.isArray(r) ? r : [r]).map(String));
  const cols = Math.max(...cells.map((c) => c.length));
  const w = [];
  for (let c = 0; c < cols; c++) w.push(Math.max(...cells.map((r) => (r[c] ?? "").length)));
  // Last column is right-aligned when it looks like a status/amount, which is
  // what makes a table wireframe read as a table rather than a list.
  return cells.map((r) => {
    const parts = r.map((v, c) => (c === cols - 1 && cols > 1 ? String(v).padStart(w[c]) : pad(v, w[c])));
    return pad(parts.join("  "), width);
  });
}

// --- panel rendering ---------------------------------------------------------

/**
 * One panel as a box of exact width `w`.
 *
 * The panel shape is data, not prose: `toolbar` / `rows` / `fields` / `footer`
 * / `actions` each render a fixed way, so two plans describing the same panel
 * always draw the same box.
 */
function panelBox(panel, w) {
  const inner = w - 2;
  const rows = [];

  if (panel.toolbar) rows.push(" " + pad(panel.toolbar, inner - 1), "---");

  if (panel.title) {
    const badge = panel.badge ? " " + panel.badge : "";
    rows.push(" " + pad(panel.title + badge.padStart(Math.max(0, inner - 2 - panel.title.length)), inner - 1));
    if (panel.subtitle) rows.push(" " + pad(panel.subtitle, inner - 1));
    if (panel.fields?.length || panel.rows?.length) rows.push(" " + rule(inner - 2) + " ");
  }

  if (panel.rows?.length) {
    for (const line of columnize(panel.rows, inner - 2)) rows.push(" " + line + " ");
  }

  if (panel.fields?.length) {
    const labelW = Math.max(...panel.fields.map((f) => String(f.label).length));
    for (const f of panel.fields) {
      const label = pad(f.label, labelW);
      const value = String(f.value ?? "");
      rows.push(" " + pad(label + "  " + value.padStart(Math.max(0, inner - 4 - labelW)), inner - 2) + " ");
    }
  }

  if (panel.footer) rows.push("---", centre(panel.footer, inner));

  if (panel.actions?.length) {
    rows.push(" " + rule(inner - 2) + " ");
    rows.push(" " + pad(panel.actions.map((a) => `[${a}]`).join("  "), inner - 2) + " ");
  }

  return boxOf(w, rows);
}

// --- archetype frames --------------------------------------------------------

/** The app chrome: topbar across the top, sidebar down the left. */
function desktopShell(bodyLines, { app = "Acme", active = "", nav = DEFAULT_NAV } = {}) {
  // The rail is the app's real nav, not a stock list — drawing entries that do
  // not exist is how a plan starts lying. A surface that isn't already in the
  // nav renders as an addition, so the reviewer sees where it lands and that
  // `config/nav.ts` is about to change.
  const known = nav.some((n) => n.toLowerCase() === active.toLowerCase());
  const entries = nav.map((n) => ({
    label: n,
    marker: active && n.toLowerCase() === active.toLowerCase() ? " ◀" : "",
  }));
  if (active && !known) entries.push({ label: active, marker: " ◀ new" });

  const out = [];
  out.push("┌" + rule(DESKTOP_W - 2) + "┐");
  out.push("│ " + pad(`▨ ${app}      ⌕ Search…`, DESKTOP_W - 4 - 14) + pad("⌘K   ◐   ⬤", 14) + " │");
  out.push("├" + rule(SIDEBAR_W) + "┬" + rule(BODY_W + 2) + "┤");
  const rail = entries.map((e) => " " + e.label + e.marker);
  const height = Math.max(bodyLines.length, rail.length);
  for (let i = 0; i < height; i++) {
    out.push("│" + pad(rail[i] ?? "", SIDEBAR_W) + "│ " + pad(bodyLines[i] ?? "", BODY_W) + " │");
  }
  out.push("└" + rule(SIDEBAR_W) + "┴" + rule(BODY_W + 2) + "┘");
  return out;
}

/** Body content for one surface at desktop width, before the shell wraps it. */
function desktopBody(surface) {
  const bodyW = BODY_W;
  const head = [
    pad(surface.name, bodyW - 22) +
      (surface.primaryAction ? `[ ${surface.primaryAction} ]`.padStart(22) : " ".repeat(22)),
    "",
  ];

  if (surface.archetype === "list") {
    // One collection, full width, with the filter drawn above the rows — so
    // nobody plans it into the scroller and meets B8 afterwards.
    const out = [...head];
    out.push(...panelBox({ ...surface.panels[0], name: "Filters" }, bodyW));
    for (const p of surface.panels) {
      out.push(...panelBox(p, bodyW));
      out.push("");
    }
    return out;
  }

  if (surface.archetype === "list-detail") {
    // Two panes side by side. Widths come from the declared ratio so the
    // drawing matches the grid the implementation will use.
    const gap = 1;
    const total = bodyW - gap;
    const first = Math.max(20, Math.round(total * (surface.panels[0].ratio ?? 0.55)));
    const second = total - first;
    const boxes = [panelBox(surface.panels[0], first), panelBox(surface.panels[1], second)];
    return [...head, ...hjoin(boxes, gap)];
  }

  if (surface.archetype === "dashboard-grid") {
    const tiles = surface.panels.filter((p) => p.kind === "stat");
    const rest = surface.panels.filter((p) => p.kind !== "stat");
    const out = [...head];
    if (tiles.length) {
      const w = Math.floor((bodyW - (tiles.length - 1)) / tiles.length);
      out.push(...hjoin(tiles.map((t) => panelBox(t, w)), 1));
      out.push("");
    }
    for (const p of rest) out.push(...panelBox(p, bodyW));
    return out;
  }

  if (surface.archetype === "form") {
    // B3 caps the column at 640px; the wireframe caps it proportionally so
    // nobody plans a full-bleed form and discovers the rule afterwards.
    const w = Math.min(bodyW, 44);
    const indent = Math.floor((bodyW - w) / 2);
    return [...head, ...panelBox(surface.panels[0], w).map((l) => " ".repeat(indent) + l)];
  }

  if (surface.archetype === "detail") {
    // One subject, sectioned, with the primary action drawn as a pinned bar —
    // so nobody plans it into the scroll and meets B5 afterwards.
    const out = [...head];
    for (const p of surface.panels) {
      out.push(...panelBox(p, bodyW));
      out.push("");
    }
    out.push(rule(bodyW));
    out.push(pad("", bodyW - 22) + `[ ${surface.primaryAction ?? "Primary"} ]`.padStart(22));
    return out;
  }

  if (surface.archetype === "settings") {
    // The rail is the archetype. Drawing the content column without it is how a
    // settings page becomes a 4000px scroll.
    const railW = 16;
    const contentW = bodyW - railW - 1;
    const rail = boxOf(
      railW,
      surface.panels.map((p, i) => (i === 0 ? " > " : "   ") + (p.title ?? `Group ${i + 1}`)),
    );
    return [...head, ...hjoin([rail, panelBox(surface.panels[0], contentW)], 1)];
  }

  if (surface.archetype === "sequence") {
    // Progress at the top, one step, Back and Next at the bottom. They never
    // share an edge — that separation is what probe rule B7 checks.
    const w = Math.min(bodyW, 44);
    const indent = Math.floor((bodyW - w) / 2);
    const step = surface.panels[0];
    const total = surface.panels.length;
    const filled = Math.max(1, Math.round(w / total));
    const out = [...head];
    out.push(centre(`Step 1 of ${total} — ${step.title ?? "Step"}`, bodyW));
    out.push(centre("#".repeat(filled) + ".".repeat(w - filled), bodyW));
    out.push("");
    out.push(...panelBox({ ...step, title: undefined }, w).map((l) => " ".repeat(indent) + l));
    out.push("");
    out.push(" ".repeat(indent) + pad("[ Back ]", w - 12) + "[ Next ]".padStart(12));
    return out;
  }

  // centered-card renders without the shell (see renderSurface).
  return [...head, ...panelBox(surface.panels[0], Math.min(bodyW, 40))];
}

function centeredCardFrame(surface) {
  const w = 40;
  const indent = Math.floor((DESKTOP_W - w) / 2);
  const box = panelBox(surface.panels[0], w).map((l) => " ".repeat(indent) + l);
  const blank = " ".repeat(DESKTOP_W - 2);
  const out = ["┌" + rule(DESKTOP_W - 2) + "┐"];
  out.push("│" + blank + "│");
  for (const l of box) out.push("│" + pad(l, DESKTOP_W - 2) + "│");
  out.push("│" + blank + "│");
  out.push("└" + rule(DESKTOP_W - 2) + "┘");
  return out;
}

/** Mobile: the sidebar collapses to ☰ and panes stack into separate routes. */
function mobileFrame(surface) {
  const inner = MOBILE_W - 2;
  const frames = [];
  const panels = surface.archetype === "list-detail" ? surface.panels.slice(0, 2) : surface.panels.slice(0, 1);
  for (const [i, p] of panels.entries()) {
    const rows = [];
    rows.push(i === 0 ? " ☰  " + pad(surface.name, inner - 8) + "⌕ " : " ‹ Back  " + pad(p.title ?? "Detail", inner - 10));
    rows.push("---");
    for (const l of panelBox({ ...p, title: i === 0 ? undefined : p.title }, inner - 2)) rows.push(" " + l);
    if (i === 0 && surface.primaryAction) rows.push(centre(`[ ${surface.primaryAction} ]`, inner));
    frames.push(boxOf(MOBILE_W, rows));
  }
  return frames.length > 1 ? hjoin([frames[0], ["", "", "", "  ──▶", ""], frames[1]], 2) : frames[0];
}

// --- state grid --------------------------------------------------------------

/** The four states drawn, not promised. Copy is reviewable before it's written. */
function statesGrid(surface) {
  const w = 24;
  const wrap = (text, n) => {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > n) { lines.push(line.trim()); line = word; }
      else line = (line + " " + word).trim();
    }
    if (line) lines.push(line);
    return lines;
  };

  const bodies = [
    ["▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓", "▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓", "▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓", "▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓"],
    [
      ...wrap(surface.states.empty, w - 4),
      ...(surface.primaryAction ? ["", `[ ${surface.primaryAction} ]`] : []),
    ],
    ["⚠", ...wrap(surface.states.error, w - 4), "", "[ Try again ]"],
  ];
  // Pad every body to the same height BEFORE boxing, so the three captions
  // below the boxes line up instead of stepping down.
  const tall = Math.max(...bodies.map((b) => b.length));
  const notes = ["Skeleton mirrors rows", "one CTA, 3 lines max", "retry, never raw text"];
  const labels = ["loading", "empty", "error"];
  const cells = bodies.map((body, i) => {
    const rows = [...body, ...Array(tall - body.length).fill("")].map((l) => " " + pad(l, w - 3));
    return [centre(labels[i], w), ...boxOf(w, rows), centre(notes[i], w)];
  });
  return hjoin(cells, 3);
}

// --- overlays ----------------------------------------------------------------

function overlayBox(o) {
  const w = o.kind === "alert-dialog" ? 36 : 34;
  const inner = w - 2;
  const rows = [" " + pad(o.title, inner - 4) + (o.kind === "dialog" ? " ✕ " : "   ")];
  rows.push(" " + rule(inner - 2) + " ");
  if (o.body) for (const l of String(o.body).split("\n")) rows.push(" " + pad(l, inner - 2) + " ");
  if (o.fields?.length) {
    const labelW = Math.max(...o.fields.map((f) => String(f.label).length));
    for (const f of o.fields) {
      rows.push(" " + pad(`${pad(f.label, labelW)}  [ ${pad(f.placeholder ?? "", 14)}]`, inner - 2) + " ");
    }
    rows.push(" " + rule(inner - 2) + " ");
  }
  if (o.buttons?.length) {
    rows.push(" " + o.buttons.map((b) => `[ ${b} ]`).join(" ").padStart(inner - 2) + " ");
  }
  return boxOf(w, rows);
}

// --- markdown sections -------------------------------------------------------

// Trim trailing spaces only. \s+$ with the m flag also eats the newline, which
// silently collapses the blank lines that separate blocks inside a fence.
const fence = (lines) => "```\n" + lines.join("\n").replace(/[ \t]+$/gm, "") + "\n```";

function renderSurface(s, { nav = DEFAULT_NAV, app = "Acme" } = {}) {
  const out = [];
  out.push(`### ${s.name}${s.route ? ` · \`${s.route}\`` : ""}`);
  out.push("");
  out.push(`Archetype: \`${s.archetype}\`${s.purpose ? ` — ${s.purpose}` : ""}`);
  out.push("");
  // Above the wireframe on purpose: a reviewer should read what the surface is
  // for before they read what it looks like.
  out.push(`**Peak** — ${s.moments.peak}`);
  out.push("");
  out.push(`**End** — ${s.moments.end}`);
  out.push("");
  out.push("**Desktop @1440**");
  out.push("");
  out.push(fence(s.archetype === "centered-card" ? centeredCardFrame(s) : desktopShell(desktopBody(s), { active: s.name, nav, app })));
  out.push("");
  out.push("**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.");
  out.push("");
  out.push(fence(mobileFrame(s)));
  out.push("");
  out.push("**States**");
  out.push("");
  out.push(fence(statesGrid(s)));
  out.push("");
  out.push(`Success: ${s.states.success}`);
  out.push("");
  out.push("Held to:");
  out.push("");
  for (const r of ARCHETYPE_RULES[s.archetype]) out.push(`- ${r}`);
  out.push("");
  return out;
}

function renderComponents(plan) {
  if (!plan.components?.length) return [];
  const rows = plan.components.map(
    (c) => `| ${c.surface ?? "—"} | \`${c.control}\` | ${c.why} | ${c.rejected ? `\`${c.rejected}\`` : "—"} |`,
  );
  return [
    "## Components",
    "",
    "Each choice states the neighbour it beat. `Use when:` / `Instead:` for every",
    "component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;",
    "the choices between families live in",
    "`docs/principles/component-selection.md`.",
    "",
    "| Surface | Control | Why this one | Not |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ];
}

function renderOverlays(plan) {
  if (!plan.overlays?.length) return [];
  const out = ["## Overlays", ""];
  const boxes = plan.overlays.map((o) => [centre(`${o.kind} · ${o.id}`, 36), ...overlayBox(o)]);
  out.push(fence(hjoin(boxes, 3)));
  out.push("");
  return out;
}

function renderIntegration(plan) {
  if (!plan.integration?.length) return [];
  const w = Math.max(...plan.integration.map((i) => i.from.length));
  const lines = plan.integration.map((i) => `  ${pad(i.from, w)}  ──▶  ${i.to}${i.note ? `   (${i.note})` : ""}`);
  return ["## Integration points", "", fence(lines), ""];
}

function renderBlastRadius(plan) {
  const b = plan.blastRadius;
  if (!b) return [];
  const lines = [];
  if (b.new?.length) {
    lines.push(`new (${b.new.length})`);
    b.new.forEach((f, i) => lines.push(`  ${i === b.new.length - 1 ? "└──" : "├──"} ${f}`));
  }
  if (b.changed?.length) {
    if (lines.length) lines.push("");
    lines.push(`changed (${b.changed.length})`);
    b.changed.forEach((f, i) => lines.push(`  ${i === b.changed.length - 1 ? "└──" : "├──"} ${f}`));
  }
  return ["## Blast radius", "", fence(lines), ""];
}

function renderDataModel(plan) {
  if (!plan.entities?.length) return [];
  const out = ["## Data model", ""];
  for (const e of plan.entities) {
    out.push(`- **${e.name}**`);
    for (const f of e.fields ?? []) out.push(`  - \`${f.name}\`: ${f.type}${f.note ? ` — ${f.note}` : ""}`);
    if (e.relations?.length) out.push(`  - _relations:_ ${e.relations.join("; ")}`);
  }
  out.push("");
  return out;
}

function renderEndpoints(plan) {
  if (!plan.endpoints?.length) return [];
  return [
    "## API endpoints",
    "",
    "| Method | Path | Auth | Purpose |",
    "| --- | --- | --- | --- |",
    ...plan.endpoints.map((e) => `| ${e.method} | \`${e.path}\` | ${e.auth ? "yes" : "no"} | ${e.purpose} |`),
    "",
  ];
}

function renderVerification(plan) {
  const steps = plan.verification?.length
    ? plan.verification
    : ["npm run type-check", "npm run lint", "npm run ui-lint", "npm run test", "npm run ui-probe"];
  return [
    "## Verification plan",
    "",
    ...steps.map((s) => `- [ ] \`${s}\``),
    "- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7",
    "",
  ];
}

export function renderFeaturePlanMarkdown(plan) {
  const errors = validateFeaturePlan(plan);
  if (errors.length) {
    throw new Error("Invalid feature plan:\n" + errors.map((e) => "  - " + e).join("\n"));
  }
  const f = plan.feature;
  const out = [];
  out.push("<!-- feature-plan:v1 — generated, do not hand-edit.");
  out.push(`     Regenerate with: node scripts/feature-plan.mjs ${f.id}.feature-plan.json -->`);
  out.push("");
  out.push(`# ${f.title}`);
  out.push("");
  out.push(`\`${f.id}\` · ${plan.surfaces.length} surface${plan.surfaces.length === 1 ? "" : "s"}`);
  out.push("");
  out.push("## Problem");
  out.push("");
  out.push(f.problem);
  out.push("");
  if (f.nonGoals?.length) {
    out.push("## Not in this feature");
    out.push("");
    for (const n of f.nonGoals) out.push(`- ${n}`);
    out.push("");
  }
  out.push("## Surfaces");
  out.push("");
  for (const s of plan.surfaces) out.push(...renderSurface(s, { nav: plan.nav ?? DEFAULT_NAV, app: plan.app ?? "Acme" }));
  out.push(...renderOverlays(plan));
  out.push(...renderComponents(plan));
  out.push(...renderDataModel(plan));
  out.push(...renderEndpoints(plan));
  out.push(...renderIntegration(plan));
  out.push(...renderBlastRadius(plan));
  out.push(...renderVerification(plan));
  out.push("---");
  out.push("");
  out.push("Approve this before any file is written. Every diagram above is rendered");
  out.push("from this feature's plan JSON, so the drawing and the build cannot drift;");
  out.push("the archetype frames are the same shapes `ui-probe` rules B1-B4 assert");
  out.push("against the real DOM once the screens exist.");
  out.push("");
  return out.join("\n");
}

// --- cli ---------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]).endsWith("feature-plan.mjs");

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("-"));
  if (!file) {
    console.error("usage: node scripts/feature-plan.mjs <plan.json> [-o FEATURE-PLAN.md] [--check]");
    process.exit(2);
  }
  const plan = JSON.parse(fs.readFileSync(file, "utf8"));
  const errors = validateFeaturePlan(plan);
  if (errors.length) {
    console.error(`feature-plan: ${errors.length} problem(s) in ${file}`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  if (args.includes("--check")) {
    console.log(`feature-plan: ${file} is valid (${plan.surfaces.length} surfaces)`);
    process.exit(0);
  }
  const md = renderFeaturePlanMarkdown(plan);
  const oIndex = args.indexOf("-o");
  if (oIndex !== -1 && args[oIndex + 1]) {
    fs.writeFileSync(args[oIndex + 1], md);
    console.log(`feature-plan: ${plan.surfaces.length} surfaces → ${args[oIndex + 1]}`);
  } else {
    process.stdout.write(md);
  }
}
