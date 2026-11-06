/**
 * Reading settings: per device, applied on change, remembered in window.localStorage.
 *
 * Storage can be missing or throw (private browsing, blocked site data). Settings then still apply
 * for this visit, and `remembered` turns false so the settings screen can say so.
 */
import { create } from 'zustand';
import { palettes, type Palette, type ThemeName } from './theme';

export type Typeface = 'serif' | 'sans';
export type Spacing = 'tight' | 'normal' | 'loose';

export type ReaderSettings = {
  size: number;
  theme: ThemeName;
  typeface: Typeface;
  spacing: Spacing;
};

export const SIZE_MIN = 16;
export const SIZE_MAX = 26;
export const lineHeights: Record<Spacing, number> = { tight: 1.45, normal: 1.6, loose: 1.8 };

const KEY = 'cw-reader-settings';

/**
 * The first size follows the device's text-size setting: 18 px on a phone and 20 px on an iPad when
 * the browser default is 16, since an iPad is read from further away.
 */
export function defaultSize(): number {
  let root = 16;
  let wide = false;
  try {
    root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    wide = window.innerWidth >= 700;
  } catch {
    // no document (tests without a DOM); keep 16
  }
  return clamp(Math.round(root * (wide ? 1.25 : 1.125)));
}

export function clamp(size: number): number {
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(size)));
}

function defaults(): ReaderSettings {
  return { size: defaultSize(), theme: 'dark', typeface: 'serif', spacing: 'normal' };
}

function load(): { settings: ReaderSettings; remembered: boolean } {
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<ReaderSettings>) : {};
    const base = defaults();
    return {
      remembered: true,
      settings: {
        size: typeof saved.size === 'number' ? clamp(saved.size) : base.size,
        theme: saved.theme && saved.theme in palettes ? saved.theme : base.theme,
        typeface: saved.typeface === 'sans' ? 'sans' : base.typeface,
        spacing: saved.spacing && saved.spacing in lineHeights ? saved.spacing : base.spacing,
      },
    };
  } catch {
    return { settings: defaults(), remembered: false };
  }
}

type Store = ReaderSettings & {
  remembered: boolean;
  set: (patch: Partial<ReaderSettings>) => void;
};

const initial = load();

export const useSettings = create<Store>((setState, getState) => ({
  ...initial.settings,
  remembered: initial.remembered,
  set: (patch) => {
    setState(patch);
    const { size, theme, typeface, spacing } = getState();
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ size, theme, typeface, spacing }));
      if (!getState().remembered) setState({ remembered: true });
    } catch {
      setState({ remembered: false });
    }
  },
}));

export function usePalette(): Palette {
  return palettes[useSettings((s) => s.theme)];
}
