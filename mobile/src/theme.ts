/**
 * The reader's tokens, from the approved design canvas (https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS)
 * and the web app's palette (src/theme.ts: dark ramp, lime accent). React Native styles take values,
 * not CSS classes, so the tokens live here and every screen reads the active palette from
 * `usePalette()` in settings.ts.
 *
 * Every text colour below was chosen to clear 4.5:1 on its own ground and surface.
 */
export type ThemeName = 'dark' | 'light' | 'sepia';

export type Palette = {
  ground: string;
  surface: string;
  raised: string;
  border: string;
  borderStrong: string;
  text: string;
  body: string;
  muted: string;
  /** Fills: progress bars, the primary button, the current chapter's marker. */
  accent: string;
  onAccent: string;
  /** Accent used as text or a thin line on this ground (lime is unreadable on white). */
  accentInk: string;
  /** Progress fills: lime on dark, olive on light grounds where lime vanishes. */
  meter: string;
  /** A soft tint behind the current chapter and Key idea callouts. */
  tint: string;
  codeGround: string;
  danger: string;
  scrim: string;
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    ground: '#0B0D10',
    surface: '#171A20',
    raised: '#1F232B',
    border: '#272A30',
    borderStrong: '#33353B',
    text: '#F4F5F7',
    body: '#E4E5E8',
    muted: '#A9ABAE',
    accent: '#C6F24E',
    onAccent: '#0B0D10',
    accentInk: '#C6F24E',
    meter: '#C6F24E',
    tint: '#1E2614',
    codeGround: '#171A20',
    danger: '#FF8A80',
    scrim: 'rgba(0,0,0,0.55)',
  },
  light: {
    ground: '#FFFFFF',
    surface: '#F5F6F7',
    raised: '#ECEDEF',
    border: '#E2E3E6',
    borderStrong: '#CFD1D5',
    text: '#14161A',
    body: '#24272C',
    muted: '#5E6168',
    accent: '#C6F24E',
    onAccent: '#14161A',
    accentInk: '#465C00',
    meter: '#556E00',
    tint: '#F2F9DF',
    codeGround: '#F5F6F7',
    danger: '#B42318',
    scrim: 'rgba(0,0,0,0.35)',
  },
  sepia: {
    ground: '#F3EBDD',
    surface: '#EAE0CE',
    raised: '#E2D6C1',
    border: '#D9CCB4',
    borderStrong: '#C8B99E',
    text: '#2B2620',
    body: '#352F27',
    muted: '#675D4F',
    accent: '#556E00',
    onAccent: '#F8FDE8',
    accentInk: '#465C00',
    meter: '#556E00',
    tint: '#E4E3C6',
    codeGround: '#EAE0CE',
    danger: '#9A2B16',
    scrim: 'rgba(43,38,32,0.4)',
  },
};

export const font = {
  ui: 'Geist, system-ui, sans-serif',
  reading: "'Source Serif 4', Georgia, serif",
  mono: "'Geist Mono', ui-monospace, monospace",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
/** Smallest comfortable touch target. */
export const touch = 44;

/** Window widths where the layout changes (iPad Split View changes the window, not the device). */
export const breakpoint = { wide: 700, split: 1024 } as const;
/** Longest comfortable line for the chapter text. */
export const readingWidth = 680;

/** The reading column for a text size: about 66 characters a line plus the side gutters. */
export function measure(size: number): number {
  return Math.round(size * 33) + 44;
}
