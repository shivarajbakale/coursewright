<!-- principle:wcag-2.2-aa:v2 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# WCAG 2.2 AA

This is the accessibility contract. Every screen must satisfy AA. Below are the
targets that matter most; the platform section at the end says how this app
satisfies each one and which gate enforces it.

> Source: W3C Web Content Accessibility Guidelines (WCAG) 2.2, Level AA
> (https://www.w3.org/TR/WCAG22/). Free implementation guidance, not
> normative.

## The targets that matter

### 1. Perceivable

| Criterion | What | Checked by |
| --- | --- | --- |
| **1.1.1 Non-text content** | Images and icons need text alternatives; an icon-only button needs an `aria-label` — a tooltip is not a name | axe (image-alt, button-name) |
| **1.3.1 Info and relationships** | Headings, lists and form labels are programmatic, not just styled | axe (label) |
| **1.4.3 Contrast (minimum)** | Text has ≥ 4.5:1 contrast (≥ 3:1 for large text), in every theme | axe (color-contrast) |
| **1.4.11 Non-text contrast** | Borders, focus rings and icons have ≥ 3:1 contrast | axe (color-contrast) |
| **1.4.13 Content on hover or focus** | Hover content is hoverable, dismissable and persistent | manual review |

### 2. Operable

| Criterion | What | Checked by |
| --- | --- | --- |
| **2.1.1 Keyboard** | All functionality is available via keyboard | axe + manual |
| **2.1.2 No keyboard trap** | Focus can move away from any component; a modal holds focus inside itself but `Esc` closes it | axe |
| **2.4.3 Focus order** | Tab order matches visual order; never `tabindex > 0` | axe (tabindex) |
| **2.4.7 Focus visible** | Keyboard focus is visible; never `outline: none` without a replacement | axe |
| **2.5.8 Target size (minimum)** | Targets are ≥ 24×24px — the floor; ≥ 44×44px is the target on anything touch can reach | manual or probe |

### 3. Understandable

| Criterion | What | Checked by |
| --- | --- | --- |
| **3.2.1 On focus** | Focusing a component doesn't trigger a context change | axe |
| **3.2.2 On input** | Changing a value doesn't navigate or submit without warning | axe |
| **3.3.1 Error identification** | Errors are described in text, next to the field | axe |
| **3.3.2 Labels or instructions** | Every input has a visible label | axe (label) |

### 4. Robust

| Criterion | What | Checked by |
| --- | --- | --- |
| **4.1.2 Name, role, value** | Every component has a name and role; never override `role` without also overriding the behaviour | axe |
| **4.1.3 Status messages** | Toasts and async results are announced through a live region | manual review |

## What axe does not catch

- 2.5.8 / 2.5.5 target size — no axe rule; measure it
- 1.4.13 content on hover/focus — reach the tooltip by keyboard and dismiss it
- 4.1.3 status messages — verify the live region announces once, not per frame

## What `ux-prepass` covers

| ux-prepass item | WCAG criterion |
| --- | --- |
| Four states handled | 4.1.3 (status messages) |
| Tap targets | 2.5.8 / 2.5.5 (target size) |
| Visible focus states | 2.4.7 (focus visible) |
| Dark mode / theme tokens | 1.4.3 (contrast in every theme) |
| Text overflow handled | 1.4.4 (resize text up to 200%) |
| Keyboard navigable | 2.1.1 + 2.4.3 (keyboard + focus order) |

## How to use this list

When you add a screen, run the platform's accessibility gate. If axe flags
anything, fix the component — don't disable the rule. For the targets axe
doesn't cover, check by hand. For a new interactive control, prefer the design
system's component over a custom one: it already ships the ARIA.

## On this platform — React + Mantine

| Criterion | How this app satisfies it |
| --- | --- |
| 1.1.1 | `alt` on `<img>`; `aria-label` on every icon-only `ActionIcon` — Mantine's tooltip is not a name |
| 1.3.1 | every Mantine input takes `label`/`description`/`error` as props and wires `for` and `aria-describedby` itself; table headers are `Table.Th`; headings are `Title order={n}` |
| 1.4.3 | all text colour comes from the theme (`c="dimmed"`, `--mantine-color-text`); the ramps in `src/theme.ts` resolve to AA pairs in both schemes |
| 1.4.11 | borders, focus rings and icons come from theme values (`--mantine-color-default-border`, `--mantine-primary-color-filled`) |
| 1.4.13 | Mantine `Tooltip` (hoverable + dismissable); never a hover-only info popup |
| 2.1.2 | the only focus traps are `Modal` and `Drawer`, and `Esc` closes both |
| 2.4.7 | Mantine's own `:focus-visible` ring, tuned once via `theme.focusRing` |
| 2.5.5 | buttons default to `size="sm"` (36px) or `size="md"` (42px); icon-only buttons use `ActionIcon` at `size="lg"` (40×40) or larger; primary CTAs are `size="lg"` (44+ px) |
| 4.1.2 | Mantine exposes the right ARIA for everything except `Spotlight`, whose combobox pattern `src/components/command-palette.tsx` supplies itself |

### The gate: `make a11y`

`make a11y` runs this app's vitest-axe suite, which mounts each page under a
memory router and asserts zero axe violations (color-contrast, label,
image-alt, button-name, link-name, list, region, landmark-one-main,
page-has-heading-one, the aria-* rules, duplicate-id, tabindex). Add a test that
mounts a new screen and asserts `await axe(container)` returns no violations,
and the screen becomes part of the contract.

For a new pattern, check the component's entry in
`.claude/skills/use-mantine/mantine-capabilities.md` for what it does and does
not ship, then read its source before assuming.
