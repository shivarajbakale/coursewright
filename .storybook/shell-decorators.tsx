import type React from 'react';
import { AppShell, Box } from '@mantine/core';

import { AppSidebar } from '../src/components/app-sidebar';
import { Topbar } from '../src/components/topbar';
import { CommandPalette } from '../src/components/command-palette';
import { NAVBAR_WIDTH } from '../src/hooks/use-shell-nav';

/**
 * Gives a story the navbar's own width and height, which is all a sidebar piece
 * needs to be drawn honestly.
 *
 * It used to be `SidebarProvider`, because every kit sidebar component read its
 * state from that context and threw without it. Nothing throws now: the shell's
 * state lives in `useShellNav`, a store any component can read, so a story that
 * mounts one nav row no longer has to mount the shell to do it.
 */
export const withSidebar = (Story: React.ComponentType) => (
  <Box h="100svh" w={NAVBAR_WIDTH} style={{ overflow: 'hidden' }}>
    <Story />
  </Box>
);

/**
 * Bundles the entire authenticated chrome — Mantine `AppShell` + AppSidebar +
 * Topbar + CommandPalette — around the Story. For composition stories only (the
 * per-piece stories use `withSidebar`). The Story renders inside `AppShell.Main`
 * with padding, intended to be a `PageShell` child or a fixture dashboard.
 *
 * Each piece can be turned off independently so a story can isolate one chrome
 * piece while still being drawn in the real shell geometry.
 */
export const withAppShell =
  (
    opts: {
      initialPath?: string;
      showSidebar?: boolean;
      showTopbar?: boolean;
      showCommandPalette?: boolean;
    } = {},
  ) =>
  (Story: React.ComponentType): React.ReactElement => (
    <>
      <AppShell
        header={{ height: 56 }}
        navbar={{ width: NAVBAR_WIDTH, breakpoint: 'sm', collapsed: { mobile: true } }}
        padding={0}
        h="100svh"
        style={{ overflow: 'hidden' }}
      >
        {opts.showTopbar !== false && (
          <AppShell.Header withBorder={false}>
            <Topbar />
          </AppShell.Header>
        )}
        {opts.showSidebar !== false && (
          <AppShell.Navbar>
            <AppSidebar />
          </AppShell.Navbar>
        )}
        <AppShell.Main h="100svh" style={{ overflow: 'hidden' }}>
          <Box h="100%" p={24} style={{ minHeight: 0, overflow: 'hidden' }}>
            <Story />
          </Box>
        </AppShell.Main>
      </AppShell>
      {opts.showCommandPalette !== false && <CommandPalette />}
    </>
  );
