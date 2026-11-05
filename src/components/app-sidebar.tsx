import { Link, useRouterState } from '@tanstack/react-router';
import { ActionIcon, Box, Group, Kbd, ScrollArea, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import { GraduationCap, MessagesSquare, PanelLeft, Search } from 'lucide-react';

import { NavMain, type NavMainItem } from '@/components/nav-main';
import { NotificationsDropdown } from '@/components/notifications-dropdown';
import { ThemeToggle } from '@/components/theme-toggle';
import { openCommandPalette } from '@/components/command-palette';
import { useShellNav } from '@/hooks/use-shell-nav';
import { useTutor } from '@/copilot/tutorStore';
import { navItems } from '@/config/nav';

/**
 * Everything the shell needs, in one column: the product mark and the rail
 * toggle, primary navigation, and the global controls (notifications, search
 * ⌘K, tutor ⌘J, theme). There is no desktop top bar: it only repeated the page title the
 * page already shows, and cost a row of height on every screen.
 *
 * Items come from `src/config/nav.ts`, the single source of truth shared with
 * the ⌘K palette.
 */
/** The footer controls are pointer targets: 44 px tall rows, 44 px icons when railed (WCAG 2.5.5). */
const TARGET = 44;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { railed, toggleRail } = useShellNav();
  const tutorOpen = useTutor((s) => s.panelOpen);
  const toggleTutor = useTutor((s) => s.togglePanel);

  const navMain: NavMainItem[] = navItems.map((item) => ({
    title: item.title,
    url: item.to,
    icon: item.icon,
    isActive:
      item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`),
  }));

  const control = (label: string, hint: string, icon: React.ReactNode, onClick: () => void, active = false) =>
    railed ? (
      <Tooltip label={`${label} (${hint})`} position="right" withArrow>
        <ActionIcon
          variant={active ? 'light' : 'subtle'}
          color="gray"
          size={TARGET}
          onClick={onClick}
          aria-label={label}
          aria-pressed={active || undefined}
        >
          {icon}
        </ActionIcon>
      </Tooltip>
    ) : (
      <UnstyledButton
        onClick={onClick}
        aria-pressed={active || undefined}
        px="sm"
        mih={TARGET}
        bg={active ? 'var(--mantine-color-default-hover)' : undefined}
        style={{ borderRadius: 'var(--mantine-radius-md)', display: 'flex', alignItems: 'center' }}
      >
        <Group gap="sm" wrap="nowrap" w="100%">
          {icon}
          <Text size="sm" style={{ flex: 1 }}>
            {label}
          </Text>
          <Kbd size="xs">{hint}</Kbd>
        </Group>
      </UnstyledButton>
    );

  return (
    <Stack gap={0} h="100%" style={{ minHeight: 0, overflow: 'hidden' }}>
      <Group
        p="xs"
        gap="xs"
        justify={railed ? 'center' : 'space-between'}
        wrap="nowrap"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        {!railed && (
          <UnstyledButton
            component={Link}
            to="/"
            aria-label="Coursewright home"
            p={4}
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
          >
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={28} radius="md" variant="filled">
                <GraduationCap size={16} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Coursewright
              </Text>
            </Group>
          </UnstyledButton>
        )}
        <Tooltip label={railed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'} position="right" withArrow>
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
        </Tooltip>
      </Group>

      <ScrollArea style={{ minHeight: 0, flex: 1 }}>
        <NavMain items={navMain} railed={railed} />
      </ScrollArea>

      <Stack
        gap={0}
        p="xs"
        align={railed ? 'center' : 'stretch'}
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <NotificationsDropdown railed={railed} />
        {control('Search', '⌘K', <Search size={16} />, openCommandPalette)}
        {control('Tutor', '⌘J', <MessagesSquare size={16} />, toggleTutor, tutorOpen)}
        <Box px={railed ? 0 : 4}>
          <ThemeToggle size={TARGET} />
        </Box>
      </Stack>
    </Stack>
  );
}
