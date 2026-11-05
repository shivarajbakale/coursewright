import {
  createTheme,
  defaultVariantColorsResolver,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type VariantColorsResolver,
} from '@mantine/core';

import classes from './theme.module.css';

/**
 * The Mantine theme — the single source of colour, radius and type.
 *
 * **Instrument** (user decision, 2026-10-11): the gym-copilot prototype's design
 * system, the same one the Flutter starter ships. Near-black grounds, every
 * surface closed with a 1px hairline instead of a shadow, one lime that means
 * "do this", figures in a monospace, and status drawn as a wash, an edge and
 * an ink — never as a solid block. Dark is the identity; light is its
 * companion, white with an olive ink, because a lime that bright cannot be text
 * on white.
 *
 * Tuples run light (index 0) to dark (index 9). `primaryShade` picks the index
 * a filled Button, a checked Checkbox and a focus ring use: 5 in dark (the
 * prototype's lime), 7 in light (the olive). Mantine hovers a filled control on
 * the *next* index, so 6 is the lime pressed a step and 8 the olive pressed a
 * step — the ramp is laid out around those two jobs, not as an even gradient.
 */

/** Lime. Index 5 is the prototype's `#C6F24E`; index 7 the light theme's olive. */
const brand: MantineColorsTuple = [
  '#F8FDE8',
  '#EFFBCF',
  '#E3F8AA',
  '#D6F582',
  '#CEF468',
  '#C6F24E',
  '#B4DE3C',
  '#556E00',
  '#465C00',
  '#36470A',
];

/**
 * The neutral ramp, which Mantine reads by index for named jobs. These are the
 * prototype's grounds, lines and greys, flattened over its card where the
 * prototype wrote white-at-alpha, so every contrast check measures an opaque
 * colour.
 *
 *   dark[0]  text                     #F4F5F7
 *   dark[2]  dimmed — support copy     the prototype's 66% white
 *   dark[3]  placeholder, the quiet grey, lifted to 4.5:1 (the prototype's
 *            40% white measured 3.9:1 and carries text people read)
 *   dark[4]  control edge              the prototype's 12% line
 *   dark[5]  default hover, hairline   the prototype's 7% line
 *   dark[6]  control ground            the prototype's surface-3
 *   dark[7]  card                      the prototype's surface-2
 *   dark[8]  page                      the prototype's phone surface
 *   dark[9]  chrome — rail and top bar the prototype's chrome
 */
const dark: MantineColorsTuple = [
  '#F4F5F7',
  '#C9CBCE',
  '#A9ABAE',
  '#9C9DA1',
  '#33353B',
  '#272A30',
  '#1F232B',
  '#171A20',
  '#101216',
  '#0B0D10',
];

/*
 * The status ramps, overriding Mantine's stock names rather than living beside
 * them: Mantine reaches for `red` by itself — an input's error state — and for
 * `green` in a success notification, so a parallel name would leave half the
 * app on this palette. Index 5 is the prototype's own hex (dark); index 7 a
 * darker step that clears 4.5:1 as text on white (light).
 *
 * `green` is the lime. The prototype draws "done" in the colour of "do": an
 * accepted plan, a met target. Kept, as the Flutter identity keeps it.
 */
const green: MantineColorsTuple = brand;

/** Amber — recovery, a warning. */
const yellow: MantineColorsTuple = [
  '#FEF6E7',
  '#FDEBC7',
  '#FBD891',
  '#F9C55C',
  '#F7B43A',
  '#F5A524',
  '#E0921A',
  '#9A5B00',
  '#7E4A00',
  '#623A00',
];

/** Red — an error, a destructive action, pain. */
const red: MantineColorsTuple = [
  '#FFECEC',
  '#FFD1D1',
  '#FFA8A8',
  '#FF8585',
  '#FF6F6F',
  '#FF5C5C',
  '#EB4848',
  '#C02626',
  '#9E1D1D',
  '#7A1616',
];

/** Sky — information, a second data domain. */
const blue: MantineColorsTuple = [
  '#ECF8FE',
  '#D3EFFD',
  '#B2E4FD',
  '#9ADCFC',
  '#8AD7FC',
  '#7DD3FC',
  '#5EC2F2',
  '#0B6A9C',
  '#09587F',
  '#074563',
];

/** Violet — anything the assistant said or inferred. */
const violet: MantineColorsTuple = [
  '#F7EFFE',
  '#ECDBFE',
  '#DEC0FD',
  '#D2A6FD',
  '#C994FC',
  '#C084FC',
  '#AE6CF4',
  '#7A35C4',
  '#64299F',
  '#4E1F7C',
];

/**
 * The ink on a filled surface, per scheme.
 *
 * Mantine's auto-contrast picks the text colour once, against the *light*
 * scheme's shade — here the olive — and keeps it in dark, where the same fill is
 * the lime: "New customer" shipped white on lime at 1.29:1. Every fill this
 * palette draws in dark is light (the five index-5 hues) and every fill in
 * light is dark (the index-7 steps), so the ink is one token that flips with
 * the scheme: `--app-on-fill`, set in the resolver below. Buttons, badges,
 * icon buttons and theme icons all resolve their colours through here.
 */
const variantColorResolver: VariantColorsResolver = input => {
  const colors = defaultVariantColorsResolver(input);
  const neutral = input.color === 'gray' || input.color === 'dark';
  if (input.variant === 'filled' && !neutral) {
    return { ...colors, color: 'var(--app-on-fill)' };
  }
  return colors;
};

export const theme = createTheme({
  variantColorResolver,
  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 5 },
  colors: { brand, dark, green, yellow, red, blue, violet },

  /** Mantine picks black or white text on a filled surface by contrast, not by guess. */
  autoContrast: true,
  /* Where that choice flips. At Mantine's 0.3 the prototype's red (0.28) took
     white text at 3.1:1; at 0.25 it takes the dark ink at 6.8:1, and the
     olive, the light ramps' darker steps and the light red still take white. */
  luminanceThreshold: 0.25,

  /* The prototype's corners: 10 small, 14 for a control or button, 20 a card,
     28 a sheet. Only badges and the live dot are round. */
  defaultRadius: 'md',
  radius: { xs: '0.375rem', sm: '0.625rem', md: '0.875rem', lg: '1.25rem', xl: '1.75rem' },

  /* Geist for words, Geist Mono for figures. */
  fontFamily:
    "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontFamilyMonospace: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",

  /* The prototype's sizes: 11.5 the quiet line, 13 support, 15 running copy. */
  fontSizes: {
    xs: '0.71875rem',
    sm: '0.8125rem',
    md: '0.9375rem',
    lg: '1.0625rem',
    xl: '1.25rem',
  },
  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.5625rem', lineHeight: '1.15' },
      h2: { fontSize: '1.25rem', lineHeight: '1.2' },
      h3: { fontSize: '1.0625rem', lineHeight: '1.3' },
      h4: { fontSize: '0.9375rem', lineHeight: '1.35' },
    },
  },

  /* No resting shadow anywhere: a surface is found by its edge. What floats
     keeps a deep, soft one, because over a near-black page only a wide shadow
     reads at all. */
  shadows: {
    xs: 'none',
    sm: 'none',
    md: '0 12px 32px -8px rgb(0 0 0 / 0.55)',
    lg: '0 20px 50px -12px rgb(0 0 0 / 0.6)',
    xl: '0 30px 70px -16px rgb(0 0 0 / 0.65)',
  },

  components: {
    /*
     * `data-panel` is the ui-probe's hook — it measures every element carrying
     * one and checks its bounds, padding and hierarchy. A surface is the card
     * ground closed with the hairline: `withBorder` by default, at the card
     * corner.
     */
    Paper: {
      defaultProps: { bg: 'var(--app-surface)', 'data-panel': 'card', withBorder: true },
      classNames: { root: classes.surface },
    },
    Card: {
      defaultProps: {
        bg: 'var(--app-surface)',
        'data-panel': 'card',
        withBorder: true,
        radius: 'lg',
      },
      classNames: { root: classes.surface },
    },

    Title: { classNames: { root: classes.title } },

    /* The rail and the top bar are the prototype's chrome: a step darker than
       the page, closed from it with the hairline. */
    AppShell: { classNames: { navbar: classes.chrome, header: classes.chrome } },

    /* A button is 14 corners, semibold, and the primary is the one solid
       colour on the screen. The quiet variants are the prototype's frame. */
    Button: {
      defaultProps: { radius: 'md' },
      classNames: { root: classes.button },
    },
    ActionIcon: { classNames: { root: classes.actionIcon } },

    /* Status as a wash, an edge and an ink: a pill with a tinted hairline. */
    Badge: {
      defaultProps: { variant: 'light', radius: 'xl' },
      classNames: { root: classes.badge },
    },
    ThemeIcon: { defaultProps: { variant: 'light' } },

    /* A spinner is state, not decoration: it says "still working". The slot
       names it as a loading indicator, which is what the ui-probe's motion
       rules (M1, M3) read to tell a spinner from an ambient loop. */
    Loader: { defaultProps: { 'data-slot': 'loader' } },
    Alert: {
      defaultProps: { variant: 'light', radius: 'md' },
      classNames: { root: classes.alert, message: classes.alertMessage },
    },
    Notification: { classNames: { root: classes.notification } },

    /* The rail: the selected destination is the faint white wash and the text
       ink, not a coloured slab — the prototype's `.rail-item.on`. */
    NavLink: { classNames: { root: classes.navLink } },

    /*
     * The selected segment is pressed *into* the track: the page colour under a
     * small shadow, the label in the ink and the rest in the quiet grey. A
     * label neither wraps nor pushes the control wider — it clips — so the last
     * thing in it, always the count, is guarded here once.
     */
    SegmentedControl: {
      defaultProps: { withItemsBorders: false, radius: 'md' },
      classNames: {
        root: classes.segmentedRoot,
        indicator: classes.segmentedIndicator,
        label: classes.segmentedLabel,
      },
    },

    Tabs: { defaultProps: { color: 'brand' } },

    /* The prototype's small switch: lime on, a faint track off, a dark thumb
       on lime. */
    Switch: {
      defaultProps: { size: 'sm', color: 'brand' },
      classNames: { track: classes.switchTrack, thumb: classes.switchThumb },
    },
    Checkbox: { defaultProps: { color: 'brand' } },
    Radio: { defaultProps: { color: 'brand' } },

    /* A field is the card ground with the control edge. */
    TextInput: { classNames: { input: classes.input } },
    PasswordInput: { classNames: { input: classes.input, innerInput: classes.innerInput } },
    Textarea: { classNames: { input: classes.input } },
    Select: { classNames: { input: classes.input } },
    MultiSelect: { classNames: { input: classes.input } },
    NumberInput: { classNames: { input: classes.input } },
    Autocomplete: { classNames: { input: classes.input } },

    /* A bar is always paired with its value; the track is the faint wash. */
    Progress: { defaultProps: { size: 'sm', radius: 'xl' }, classNames: { root: classes.track } },

    /* Column headers are labels, lettered as a gauge is. */
    Table: { classNames: { th: classes.th, td: classes.td } },

    /* Overlays float: the card ground, the control edge, a deep shadow. */
    Modal: { classNames: { content: classes.overlay, header: classes.overlayHeader } },
    Drawer: { classNames: { content: classes.overlay, header: classes.overlayHeader } },
    Menu: { classNames: { dropdown: classes.overlay } },
    Popover: { classNames: { dropdown: classes.overlay } },
    Combobox: { classNames: { dropdown: classes.overlay } },
    Tooltip: { classNames: { tooltip: classes.tooltip } },
    ChartTooltip: { classNames: { tooltip: classes.overlay } },

    /*
     * `Highlight` renders a `Mark` per match, and Mantine's mark is yellow — a
     * row of highlighter blocks that wins every contest for attention on the
     * screen. The brand wash says the same thing at the volume the rest of the
     * app speaks at.
     */
    Highlight: {
      defaultProps: {
        highlightStyles: {
          backgroundColor: 'var(--mantine-color-brand-light)',
          color: 'var(--mantine-color-brand-light-color)',
          borderRadius: 'var(--mantine-radius-xs)',
        },
      },
    },
  },
});

/**
 * The tokens this app declares beside Mantine's, per scheme.
 *
 * `--app-surface` is a card's ground: Mantine paints Paper and Card with
 * `--mantine-color-body`, which would make a card the page's own tone.
 * `--app-control` is a control's ground, a step above both the page and a card
 * because a control appears on each. `--app-chrome` is the rail and the top
 * bar. `--app-line` is the quiet hairline that closes a surface; Mantine's
 * `default-border` is the stronger control edge. `--app-faint` is the quietest
 * text grey — a label, a column header, an inactive tab — still at 4.5:1.
 * `--app-wash` is the faint white (or ink) frame a quiet control is filled with.
 *
 * Mantine builds `--mantine-color-<c>-light` by alpha-ing a colour through its
 * own parser. These are hex, so it would work — but the prototype's wash is
 * 14% with a 22% edge, not Mantine's 10%/15%, so the brand's is set here in
 * both schemes.
 */
export const cssVariablesResolver: CSSVariablesResolver = t => ({
  variables: {},
  light: {
    '--app-surface': t.white,
    '--app-control': t.colors.gray[1],
    '--app-chrome': t.colors.gray[0],
    '--app-line': t.colors.gray[3],
    '--app-faint': t.colors.gray[7],
    '--app-wash': 'color-mix(in oklab, var(--mantine-color-black) 4%, transparent)',
    '--app-on-fill': t.white,
    '--mantine-color-anchor': 'var(--mantine-color-brand-7)',
    // Mantine's own error and success read `red-8` and `teal-8`; this palette
    // names its own steps for both.
    // Mantine's light dimmed is gray-6, 3.32:1 on white; every text grey here
    // clears 4.5:1, so support copy is gray-7.
    '--mantine-color-dimmed': 'var(--mantine-color-gray-7)',
    '--mantine-color-error': 'var(--mantine-color-red-7)',
    '--mantine-color-success': 'var(--mantine-color-green-7)',
    '--mantine-color-brand-light':
      'color-mix(in oklab, var(--mantine-color-brand-7) 12%, transparent)',
    '--mantine-color-brand-light-hover':
      'color-mix(in oklab, var(--mantine-color-brand-7) 18%, transparent)',
    '--mantine-color-brand-light-color': 'var(--mantine-color-brand-7)',
  },
  dark: {
    '--mantine-color-body': t.colors.dark[8],
    '--app-surface': t.colors.dark[7],
    '--app-control': t.colors.dark[6],
    '--app-chrome': t.colors.dark[9],
    '--app-line': t.colors.dark[5],
    '--app-faint': t.colors.dark[3],
    '--app-wash': 'color-mix(in oklab, var(--mantine-color-white) 6%, transparent)',
    '--app-on-fill': t.colors.dark[9],
    '--mantine-color-anchor': 'var(--mantine-color-brand-5)',
    '--mantine-color-error': 'var(--mantine-color-red-5)',
    '--mantine-color-success': 'var(--mantine-color-green-5)',
    '--mantine-color-brand-light':
      'color-mix(in oklab, var(--mantine-color-brand-5) 14%, transparent)',
    '--mantine-color-brand-light-hover':
      'color-mix(in oklab, var(--mantine-color-brand-5) 20%, transparent)',
    '--mantine-color-brand-light-color': 'var(--mantine-color-brand-5)',
  },
});
