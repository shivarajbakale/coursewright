import { Link, useRouterState } from '@tanstack/react-router';
import { Box, Group, ScrollArea, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { GalleryVerticalEnd, type LucideIcon } from 'lucide-react';

import { NavMain, type NavMainItem } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { useShellNav } from '@/hooks/use-shell-nav';
import { useSession } from '@/lib/auth';
import { navItems } from '@/config/nav';

/**
 * Everything inside the shell's navbar: workspace badge, primary navigation,
 * account block.
 *
 * It is a plain column now rather than a family of nine kit components. The
 * navbar's width, its position and its mobile behaviour belong to Mantine's
 * `AppShell` in `App.tsx`; what belongs here is the content and the one thing
 * the content has to know — whether it is being drawn in the rail.
 *
 * Items come from `src/config/nav.ts`, the single source of truth shared with
 * the ⌘K palette.
 */
export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const railed = useShellNav((s) => s.railed);

  // Workspace badge — single-tenant for now, so we show the product name.
  const workspace = { name: 'Console', logo: GalleryVerticalEnd as LucideIcon, plan: 'Workspace' };

  const navMain: NavMainItem[] = navItems.map((item) => ({
    title: item.title,
    url: item.to,
    icon: item.icon,
    isActive:
      item.to === '/'
        ? pathname === '/'
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
  }));

  const user = session
    ? {
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.image ?? '',
      }
    : { name: 'Guest', email: '', avatar: '' };

  return (
    <Stack gap={0} h="100%" style={{ minHeight: 0, overflow: 'hidden' }}>
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <UnstyledButton
          component={Link}
          to="/"
          aria-label={`${workspace.name} home`}
          p={6}
          style={{ borderRadius: 'var(--mantine-radius-md)', display: 'block' }}
        >
          <Group gap="sm" wrap="nowrap" justify={railed ? 'center' : undefined}>
            <ThemeIcon size={32} radius="md" variant="filled">
              <workspace.logo size={16} />
            </ThemeIcon>
            {!railed && (
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {workspace.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {workspace.plan}
                </Text>
              </div>
            )}
          </Group>
        </UnstyledButton>
      </Box>

      <ScrollArea style={{ minHeight: 0, flex: 1 }}>
        <NavMain items={navMain} railed={railed} />
      </ScrollArea>

      <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
        <NavUser user={user} railed={railed} />
      </Box>
    </Stack>
  );
}
