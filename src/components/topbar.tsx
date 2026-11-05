import { ActionIcon, Burger, Button, Divider, Group, Kbd, Text } from '@mantine/core';
import { useRouterState } from '@tanstack/react-router';
import { MessagesSquare, PanelLeft, Search } from 'lucide-react';
import { useTutor } from '@/copilot/tutorStore';

import { useShellNav } from '@/hooks/use-shell-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { AccountMenu } from '@/components/account-menu';
import { openCommandPalette } from '@/components/command-palette';
import { pageTitleFor } from '@/config/nav';

/**
 * Sticky application header: sidebar toggle, page title, ⌘K, notifications,
 * theme.
 *
 * The one toggle became two, because the two states it used to switch between
 * are not the same state. On a phone the navbar is an overlay that is open or
 * closed, and a `Burger` is the control every user already reads as that; on a
 * desktop it is a column that is wide or a rail, and it never disappears. The
 * kit's single `SidebarTrigger` hid the distinction behind a media query.
 *
 * The `<header>` element is `AppShell.Header`'s, not this component's: two
 * nested banner landmarks is one more than the page has headers.
 */
export function Topbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = pageTitleFor(pathname);
  const { railed, mobileOpen, toggleRail, toggleMobile } = useShellNav();
  const tutorOpen = useTutor((s) => s.panelOpen);
  const toggleTutor = useTutor((s) => s.togglePanel);

  return (
    <Group
      px="md"
      h="100%"
      gap="xs"
      wrap="nowrap"
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--mantine-color-default-border)',
        // Translucent so content scrolling underneath reads as depth rather
        // than as a seam; the blur is what keeps the title legible over it.
        background: 'color-mix(in oklab, var(--mantine-color-body) 80%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Burger
        opened={mobileOpen}
        onClick={toggleMobile}
        size="sm"
        hiddenFrom="sm"
        aria-label="Toggle navigation"
      />
      <ActionIcon
        onClick={toggleRail}
        variant="subtle"
        color="gray"
        visibleFrom="sm"
        aria-label={railed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!railed}
      >
        <PanelLeft size={16} />
      </ActionIcon>
      <Divider orientation="vertical" my={10} mr={4} />
      {/*
        Chrome, not a heading. This repeats the section the nav rail already
        highlights, and `PageShell` renders the page's real `h1` a few pixels
        below it — so marking this one up as a heading gave every page two, and
        on a detail route they disagree ("Customers" here, the account's name
        there). `aria-hidden` keeps the duplicate out of the accessibility tree
        entirely: a screen reader gets the page's own heading, which is the one
        that says something.
      */}
      <Text size="sm" fw={500} aria-hidden>
        {title}
      </Text>

      <Group gap={6} wrap="nowrap" ml="auto">
        <Button
          variant={tutorOpen ? 'light' : 'default'}
          size="xs"
          leftSection={<MessagesSquare size={14} />}
          onClick={toggleTutor}
          aria-pressed={tutorOpen}
        >
          Tutor
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={openCommandPalette}
          leftSection={<Search size={14} />}
          rightSection={<Kbd size="xs">⌘K</Kbd>}
          visibleFrom="sm"
        >
          Search…
        </Button>
        <ThemeToggle />
        <Divider orientation="vertical" my={10} ml={4} />
        <AccountMenu />
      </Group>
    </Group>
  );
}
