/**
 * The service worker: registered once at start (vite-plugin-pwa's virtual module), and a small store
 * that says when a new version is waiting. Reload activates it; until then the reader keeps running
 * the version it started with, so nothing changes under someone mid-chapter.
 */
import { create } from 'zustand';

interface UpdateState {
  waiting: boolean;
  apply: (() => void) | null;
  dismissed: boolean;
  dismiss: () => void;
}

export const useUpdate = create<UpdateState>((set) => ({
  waiting: false,
  apply: null,
  dismissed: false,
  dismiss: () => set({ dismissed: true }),
}));

export async function registerWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.MODE === 'test') return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    const update = registerSW({
      onNeedRefresh: () => useUpdate.setState({ waiting: true, dismissed: false, apply: () => void update(true) }),
      onRegisteredSW: (_url, reg) => {
        // Look for a new version when the reader comes back to the app, and every hour while open.
        if (!reg) return;
        const check = () => document.visibilityState === 'visible' && void reg.update().catch(() => {});
        document.addEventListener('visibilitychange', check);
        setInterval(check, 60 * 60 * 1000);
      },
    });
  } catch {
    // No worker (http, or the browser refused): the reader works online as before.
  }
}

/** Chromium's install prompt, caught when the browser offers it (Safari never does). */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useInstall = create<{ prompt: InstallPrompt | null }>(() => ({ prompt: null }));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e as InstallPrompt });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ prompt: null }));
}

/** Opened from the home screen (or as an installed app) rather than in a browser tab. */
export function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iPhone, iPad (which calls itself a Mac with a touch screen), iPod. */
export function isApple(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}
