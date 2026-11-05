import { Link } from '@tanstack/react-router';
import { Avatar, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from 'lucide-react';

import { useIsMobile } from '@/hooks/use-mobile';

/**
 * The account block at the foot of the sidebar.
 *
 * A Mantine `Menu` over an `UnstyledButton`, which is the honest shape: the
 * trigger is a button that opens a menu, and it needed three kit components
 * (`SidebarMenuButton`, `DropdownMenu`, `Avatar`) to say that before. On a
 * phone the menu opens upward from the bottom of the drawer rather than to the
 * right, where there is no room for it.
 *
 * In the rail it collapses to the avatar alone — the initials are the label,
 * and `aria-label` carries the name for anyone not reading pixels.
 */
export function NavUser({
  user,
  railed = false,
}: {
  user: { name: string; email: string; avatar: string };
  railed?: boolean;
}) {
  const isMobile = useIsMobile();
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Menu
      position={isMobile ? 'top' : 'right-end'}
      withArrow
      width={224}
      shadow="md"
      offset={8}
    >
      <Menu.Target>
        <UnstyledButton
          aria-label={`Account: ${user.name}`}
          p="xs"
          style={{ borderRadius: 'var(--mantine-radius-md)', width: '100%' }}
        >
          <Group gap="sm" wrap="nowrap" justify={railed ? 'center' : undefined}>
            <Avatar src={user.avatar || undefined} radius="md" size={32}>
              {initials}
            </Avatar>
            {!railed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {user.email}
                  </Text>
                </div>
                <ChevronsUpDown size={16} />
              </>
            )}
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={500} truncate>
            {user.name}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {user.email}
          </Text>
        </Menu.Label>
        <Menu.Divider />
        <Menu.Item leftSection={<Sparkles size={16} />}>Upgrade to Pro</Menu.Item>
        <Menu.Divider />
        <Menu.Item
          component={Link}
          to="/settings"
          leftSection={<BadgeCheck size={16} />}
        >
          Account
        </Menu.Item>
        <Menu.Item
          component={Link}
          to="/billing"
          leftSection={<CreditCard size={16} />}
        >
          Billing
        </Menu.Item>
        <Menu.Item leftSection={<Bell size={16} />}>Notifications</Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<LogOut size={16} />}>Log out</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
