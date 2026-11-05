/** Plain helpers the scenes share. Kept out of `scene-kit.tsx` so that file
 *  exports only components (fast refresh). */
import s from './scene.module.css';

export { s as paint };

/** Join class names, dropping falsy entries. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

/** Clip a label to `max` characters with a trailing ellipsis. */
export function trunc(label: string, max: number): string {
  const clean = label.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Rough rendered width of a label in the SVG's user units. */
export function textWidth(label: string, fontSize: number, mono = false): number {
  return Math.ceil(label.length * fontSize * (mono ? 0.62 : 0.56));
}

/** The live list if it has entries, else the placeholder words. */
export function pick(list: string[] | undefined, fallback: string[]): string[] {
  const real = (list ?? []).map(x => x.trim()).filter(Boolean);
  return real.length ? real : fallback;
}
