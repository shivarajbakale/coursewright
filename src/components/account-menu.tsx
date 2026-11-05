import { ActionIcon, Avatar, Group, Menu, Stack, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { LogOut, Settings, User } from 'lucide-react';

import { useSession, signOut } from '@/lib/auth';

/**
 * Compact account menu for the topbar (top-right) — the conventional place users
 * look for sign-out. Mirrors the fuller account menu in the sidebar footer.
 */
export function AccountMenu() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const name = session?.user?.name ?? 'User';
  const email = session?.user?.email ?? '';
  const initials =
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ||
    email[0]?.toUpperCase() ||
    '?';

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: '/login' });
  };

  return (
    <Menu position="bottom-end" offset={8} width={224} withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" radius="xl" size="lg" aria-label="Account menu">
          <Avatar size={32} radius="xl" color="brand" variant="light">
            {initials}
          </Avatar>
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Group gap="xs" wrap="nowrap">
            <Avatar size={32} radius="xl" color="brand" variant="light">
              {initials}
            </Avatar>
            <Stack gap={0} ta="left" style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={500} truncate>
                {name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {email}
              </Text>
            </Stack>
          </Group>
        </Menu.Label>
        <Menu.Divider />
        <Menu.Item
          leftSection={<User size={16} />}
          onClick={() => navigate({ to: '/settings' })}
        >
          Account
        </Menu.Item>
        <Menu.Item
          leftSection={<Settings size={16} />}
          onClick={() => navigate({ to: '/settings' })}
        >
          Settings
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<LogOut size={16} />} onClick={handleSignOut}>
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
