import { useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { AppShell, Box } from '@mantine/core';
import { useHotkey } from '@tanstack/react-hotkeys';
import './App.css';
import { AppSidebar } from '@/components/app-sidebar';
import { Topbar } from '@/components/topbar';
import { CommandPalette } from '@/components/command-palette';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { NAVBAR_RAIL_WIDTH, NAVBAR_WIDTH, useShellNav } from '@/hooks/use-shell-nav';

/**
 * Application shell.
 *
 * Public routes (auth) render bare. Everything else renders inside the
 * authenticated chrome: Mantine `AppShell` with a collapsible navbar, a sticky
 * header and the ⌘K palette.
 *
 * The shell is a **fixed viewport** — `h="100svh"` with `overflow: hidden` all
 * the way down. Nothing here scrolls; pages scroll internally through
 * `PageShell`, which keeps headers and toolbars pinned. Adding an `overflowY:
 * 'auto'` to this file (or to a page) breaks the contract and fails
 * `scripts/ui-lint.mjs`. `AppShell`
 * pads `Main` down by the header's height, and box-sizing is border-box here,
 * so a `100svh` main is the viewport minus the header rather than one header
 * taller than it.
 *
 * The navbar has three widths, not two: full, rail, and gone. `railed` swaps
 * the first two on desktop (⌘B, or the topbar control); `mobileOpen` is the
 * third, where Mantine draws the navbar as an overlay over the page and the
 * route change closes it, because navigating is the point of opening it.
 */
const PUBLIC_ROUTES = ['/login', '/signup'];

function App() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const { railed, mobileOpen, toggleRail, closeMobile } = useShellNav();

  // `ignoreInputs` is explicit because the default would change behaviour: it
  // is off for Command/Control chords, and Mantine's `useHotkeys` — which owned
  // this binding before — ignored input, textarea and select unconditionally.
  // A rail that collapses under someone mid-sentence is not an improvement, and
  // ⌘B is bold inside anything editable.
  useHotkey('Mod+B', toggleRail, {
    ignoreInputs: true,
    meta: { name: 'Toggle the sidebar', description: 'Collapse the navigation to a rail' },
  });

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  if (isPublic) {
    return <Outlet />;
  }

  return (
    <AuthGuard>
      <AppShell
        header={{ height: 56 }}
        navbar={{
          width: railed ? NAVBAR_RAIL_WIDTH : NAVBAR_WIDTH,
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpen },
        }}
        padding={0}
        h="100svh"
        style={{ overflow: 'hidden' }}
      >
        <AppShell.Header withBorder={false}>
          <Topbar />
        </AppShell.Header>
        <AppShell.Navbar>
          <AppSidebar />
        </AppShell.Navbar>
        <AppShell.Main h="100svh" style={{ overflow: 'hidden' }}>
          <Box component="main" h="100%" style={{ minHeight: 0, overflow: 'hidden' }}>
            {/* No route-level transition wrapper here, deliberately.

                There was one, and it faded the whole viewport from 0 to 1 on
                every navigation — on top of the page's own blocks fading in
                underneath it. Two fades over the same pixels is what reads as a
                flicker, and the outer one is the one that blanks the screen.
                The router already unmounts the old page and mounts the new, so
                the new page's `Reveal`/`Stagger` *are* the route transition.
                See `docs/principles/motion.md`. */}
            <Outlet />
          </Box>
        </AppShell.Main>
      </AppShell>
      <CommandPalette />
    </AuthGuard>
  );
}

export default App;
