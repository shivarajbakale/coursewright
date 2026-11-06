import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

type Switch = {
  target: (path: string, handheld: boolean, pref: string | null) => string | null;
  handheld: (nav: { userAgent: string; maxTouchPoints: number }, width: number) => boolean;
};

const source = readFileSync(path.resolve(import.meta.dirname, '../../public/app-switch.js'), 'utf8');

/** Run the script against a fake window, the way a browser would before either app loads. */
function run(win: Record<string, unknown>) {
  new Function('window', source)(win);
  return win;
}

const api = run({ __cwNoAppSwitch: true }).cwAppSwitch as Switch;

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', maxTouchPoints: 5 };
const IPAD = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 };
const MAC = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 0 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile', maxTouchPoints: 5 };
const TOUCH_LAPTOP = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 10 };

describe('which screens count as handheld', () => {
  it('phones and iPads (which call themselves Macs) do; desktops and touch laptops do not', () => {
    expect(api.handheld(IPHONE, 390)).toBe(true);
    expect(api.handheld(IPAD, 1180)).toBe(true);
    expect(api.handheld(ANDROID, 412)).toBe(true);
    expect(api.handheld(MAC, 1440)).toBe(false);
    expect(api.handheld(MAC, 600)).toBe(false);
    expect(api.handheld(TOUCH_LAPTOP, 1366)).toBe(false);
  });
});

describe('where each page goes', () => {
  it('sends handhelds from the full app to the same place in the reader', () => {
    expect(api.target('/', true, null)).toBe('/m/');
    expect(api.target('/courses/c1', true, null)).toBe('/m/courses/c1');
    expect(api.target('/courses/c1/chapters/ch9', true, null)).toBe('/m/courses/c1/chapters/ch9');
  });

  it('leaves pages only the full app has where they are', () => {
    for (const p of ['/new', '/notes', '/sources', '/courses/c1/projects/p1', '/courses/c1/building', '/login']) {
      expect(api.target(p, true, null)).toBeNull();
    }
  });

  it('sends desktops from the reader to the same place in the full app', () => {
    expect(api.target('/m/', false, null)).toBe('/');
    expect(api.target('/m', false, null)).toBe('/');
    expect(api.target('/m/courses/c1/chapters/ch9', false, null)).toBe('/courses/c1/chapters/ch9');
    expect(api.target('/m/settings', false, null)).toBe('/');
  });

  it('stays put when already in the right app, and a remembered choice wins', () => {
    expect(api.target('/m/courses/c1', true, null)).toBeNull();
    expect(api.target('/courses/c1', false, null)).toBeNull();
    expect(api.target('/', true, 'full')).toBeNull();
    expect(api.target('/', false, 'reader')).toBe('/m/');
  });
});

describe('on page load', () => {
  function page(pathname: string, search: string, nav: object, port = '') {
    const store = new Map<string, string>();
    const win = {
      location: { pathname, search, hash: '', port, replace: vi.fn() },
      history: { replaceState: vi.fn() },
      navigator: nav,
      innerWidth: 390,
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    return { win: run(win) as typeof win, store };
  }

  it('redirects a phone opening a chapter in the full app, keeping other query parameters', () => {
    const { win } = page('/courses/c1/chapters/ch9', '?x=1', IPHONE);
    expect(win.location.replace).toHaveBeenCalledWith('/m/courses/c1/chapters/ch9?x=1');
  });

  it('remembers ?app=full on a phone for the visit, stays, and tidies the address', () => {
    const { win, store } = page('/', '?app=full', IPHONE);
    expect(store.get('cw-app')).toBe('full');
    expect(win.location.replace).not.toHaveBeenCalled();
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('leaves the dev servers alone', () => {
    const { win } = page('/', '', IPHONE, '5173');
    expect(win.location.replace).not.toHaveBeenCalled();
  });
});
