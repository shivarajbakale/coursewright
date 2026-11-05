<!-- principle:spacing-and-type:v1 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Spacing and type scale

The design system has two scales: **spacing** and **type**. Both are
**token-driven** so every screen reads at the same density. Both live in
`src/theme.ts` — `theme.spacing` and `theme.fontSizes` — and every Mantine
component reads them by name, so `p="md"` and `size="sm"` mean the same thing
everywhere and are retuned in one place.

> Read this before picking a padding, margin, gap, font-size, or font-
> weight in a component. An off-scale value is the thing that makes a
> layout look hand-placed.

## Spacing scale

Mantine's scale is named, not numbered. Every spacing prop — `p`, `px`, `m`,
`mt`, `gap` on `Group` / `Stack`, `spacing` on `SimpleGrid` — takes one of these
names, or a number when the value is genuinely one-off geometry (an icon's box,
a fixed column width).

| Token | px | Used for |
| --- | --- | --- |
| `xs` | 10 | Between tightly-coupled elements (icon + label) |
| `sm` | 12 | Inside controls, between form rows |
| `md` | 16 | Card padding, between paragraphs in a panel |
| `lg` | 20 | Between sections in a panel |
| `xl` | 32 | Between panels in a page |

Anything genuinely off this scale is a number, and a number is the exception:
`mt={4}` to nudge a caption under its value is fine, `p={17}` is not. Add a
token in `src/theme.ts` before inventing a size a second screen will need.

## Type scale

Sizes come from `theme.fontSizes` via `Text size` and `Title order`; weights
come from `fw`. Never a font-size in a style object.

| Prop | Size | Weight | Used for |
| --- | --- | --- | --- |
| `<Text size="xs">` | 12 | 400 | Captions, helper text, table metadata |
| `<Text size="xs" fw={500}>` | 12 | 500 | Eyebrow labels, badges |
| `<Text size="sm">` | 14 | 400 | Body text (default for paragraphs) |
| `<Text size="sm" fw={500}>` | 14 | 500 | Form labels, list item primary text |
| `<Text size="sm" fw={600}>` | 14 | 600 | Sidebar items, table headers |
| `<Text size="md">` | 16 | 400 | Long-form body text |
| `<Title order={4}>` | 18 | 600 | Card titles |
| `<Title order={3}>` | 22 | 600 | Section headings |
| `<Title order={2}>` | 26 | 600 | Page sub-headings |
| `<Title order={1}>` | 34 | 600 | Page titles |
| `<Text fz={36} fw={700}>` | 36 | 700 | Hero / KPI values |

A raw hex colour or font family in a component is banned by the `ui-lint`
`raw-colour` and `raw-font` rules. Use the scale.

## Font weights

- `400` Regular — body text
- `500` Medium — labels, sidebar items, table headers, list-item primary
- `600` Semibold — page titles, card titles, button text
- `700` Bold — hero / KPI values

Don't use weights outside this set. Mantine's default is 400 and `Title`'s is
600; anything else is an explicit `fw`.

## Font families

Two stacks, defined in `src/theme.ts`:

```ts
fontFamily: "'Geist', ui-sans-serif, system-ui, …",
fontFamilyMonospace: "'Geist Mono', ui-monospace, 'SF Mono', …",
```

- The sans stack is the default for everything.
- The mono stack is for figures — a KPI value, the hero number, a table
  column of amounts — and for code and IDs: `Code`, `Kbd`, or
  `ff="monospace"`, paired with `fontVariantNumeric: 'tabular-nums'` so
  column-aligned data reads right. Instrument sets every headline figure in it.

Never set `font-family` inline or in a component. The two stacks are theme
values; reach them by name.

## Spacing relationships

The "right" spacing depends on the relationship:

| Relationship | Recommended gap |
| --- | --- |
| Icon ↔ its label (in a button) | `Group gap="xs"` |
| Form fields stacked vertically | `Stack gap="md"` |
| Two form fields side-by-side | `Group grow gap="md"` |
| Sections in a panel | `Stack gap="lg"` |
| Panels in a page | `Stack gap="xl"` / `SimpleGrid spacing="xl"` |
| Title ↔ its description | `mt={4}` |
| List items vertically | `Stack gap="xs"` / `List spacing="xs"` |
| Above a primary CTA | `mt="xl"` |
| Hero (page title ↔ first KPI) | `mb="lg"` |

The pattern: pick the relationship from the table, use the gap. Don't
eyeball it.

## Density modes

The app ships one density (the default). If we ever add a "compact"
mode, define it in `src/theme.ts` as a different `spacing` map — never
as ad-hoc overrides in components.

## Don'ts

- **Don't invent a size.** `p="md"` before `p={17}`; a new size is a token.
- **Don't centre with an auto margin.** `Center`, or `Group justify="center"`.
- **Don't put a gap on a container *and* margins on its children.** Pick one —
  the container's `gap` is the one that survives a reorder.
- **Don't pick weights outside the scale.** No 100, no 200. They exist in the
  font but they don't read at our sizes.

## Verify

`ui-lint` enforces the `raw-colour`, `raw-font`, `raw-radius` and
`raw-shadow` rules, and its boundary rule rejects a utility class outright.
Run `make ui-lint` before committing. If a rule fires, fix the component or
retune the theme — don't disable the lint.

For typography hierarchy, `ui-probe` rule C1 (type scale census) catches
screens with more than 5 distinct size × weight pairs. If you hit C1,
you've added too many sizes — consolidate.
