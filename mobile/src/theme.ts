/**
 * The reader's tokens, taken from the approved design canvas and the web app's palette
 * (src/theme.ts: dark ramp, lime accent). React Native styles take values, not CSS classes, so the
 * tokens live here as constants and every screen reads them from this one place.
 */
export const color = {
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
  danger: '#FF8A80',
} as const;

export const font = {
  ui: 'Geist, system-ui, sans-serif',
  reading: "'Source Serif 4', Georgia, serif",
  mono: "'Geist Mono', ui-monospace, monospace",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
/** Smallest comfortable touch target. */
export const touch = 44;
