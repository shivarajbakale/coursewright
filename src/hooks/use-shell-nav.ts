import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The shell's navigation state — one store, two independent booleans.
 *
 * The shadcn sidebar kept this in a React context that only its own components
 * could read, which is why the topbar's toggle had to be a kit component too.
 * Mantine's `AppShell` takes the state as props instead, so it lives here: the
 * shell reads it to size the navbar, the topbar's controls write it, and
 * nothing has to be a descendant of anything.
 *
 * - `railed` is the desktop collapse. It persists, because a user who works in
 *   the rail expects the rail on the next visit; the width is a token below so
 *   the shell and the pieces inside it cannot disagree about it.
 * - `mobileOpen` is the overlay drawer. It deliberately does not persist —
 *   arriving on a phone to a navigation panel over the page is not a state
 *   anyone chose.
 */
export const NAVBAR_WIDTH = 256;
export const NAVBAR_RAIL_WIDTH = 68;

type ShellNavState = {
  railed: boolean;
  mobileOpen: boolean;
  toggleRail: () => void;
  setRailed: (value: boolean) => void;
  toggleMobile: () => void;
  closeMobile: () => void;
};

export const useShellNav = create<ShellNavState>()(
  persist(
    (set) => ({
      railed: false,
      mobileOpen: false,
      toggleRail: () => set((s) => ({ railed: !s.railed })),
      setRailed: (value) => set({ railed: value }),
      toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
      closeMobile: () => set({ mobileOpen: false }),
    }),
    {
      name: 'ui-sidebar-state',
      partialize: (s) => ({ railed: s.railed }),
    },
  ),
);
