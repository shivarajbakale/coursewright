/**
 * WCAG contrast maths for rule C4.
 *
 * Browsers report colours as `rgb()`/`rgba()` in either the legacy comma form
 * or the modern space/slash form, so both are parsed. Alpha matters here: a
 * design that fades text with `/70` is *reducing* contrast, and a ladder built
 * from opaque values only would not see it.
 *
 * `oklch()` and `oklab()` are parsed too, and that is not a nicety. Chromium
 * does **not** normalise a wide-gamut colour to `rgb()` in
 * `getComputedStyle().color` — it returns the `oklch(...)` string verbatim.
 * This palette is authored in oklch, so a parser that understood `rgb()` alone
 * skipped 40 of the 44 text nodes on a page and reported a flat ladder built
 * from the four that happened to be plain white. A measurement gap reads
 * exactly like a design failure, which is the worst kind of gate.
 */

export type Rgba = [number, number, number, number];

/** sRGB gamma encode: linear 0–1 in, 0–255 out. */
function encodeSrgb(linear: number): number {
  const c = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
}

/**
 * Oklab to sRGB via the LMS cone space. The matrices are Björn Ottosson's, the
 * same ones CSS Color 4 specifies.
 */
function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    encodeSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encodeSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encodeSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const asNumber = (raw: string): number =>
  raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);

/** `oklch(L C H)` / `oklab(L a b)`, each with an optional `/ alpha`. */
function parseOk(css: string): Rgba | null {
  const match = css.match(/^\s*(oklch|oklab)\(([^)]+)\)\s*$/i);
  if (!match) return null;

  const fn = match[1].toLowerCase();
  const [coords, alphaPart] = match[2].split('/');
  const parts = coords.trim().split(/\s+/).map(asNumber);
  if (parts.length < 3 || parts.some((v) => !Number.isFinite(v))) return null;

  const alpha = alphaPart === undefined ? 1 : asNumber(alphaPart.trim());
  if (!Number.isFinite(alpha)) return null;

  const [L, second, third] = parts;
  const [a, b] =
    fn === 'oklch'
      ? [second * Math.cos((third * Math.PI) / 180), second * Math.sin((third * Math.PI) / 180)]
      : [second, third];

  const [r, g, blue] = oklabToRgb(L, a, b);
  return [r, g, blue, alpha];
}

export function parseRgb(css: string): Rgba | null {
  const ok = parseOk(css);
  if (ok) return ok;

  const match = css.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1]
    .split(/[,/\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((v) => !Number.isFinite(v))) return null;
  const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
  return [parts[0], parts[1], parts[2], alpha];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgba: Rgba): number {
  return 0.2126 * channel(rgba[0]) + 0.7152 * channel(rgba[1]) + 0.0722 * channel(rgba[2]);
}

/** Composite a possibly-translucent foreground over an opaque background. */
export function flatten(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const l1 = relativeLuminance(flatten(fg, bg));
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
