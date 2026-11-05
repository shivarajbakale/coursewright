import * as React from 'react';
import { Group, Menu, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { ChevronsUpDown, Plus } from 'lucide-react';

import { useIsMobile } from '@/hooks/use-mobile';

/**
 * The workspace switcher: the header block of a multi-tenant sidebar.
 *
 * The rocketship shell is single-tenant, so `AppSidebar` renders a static
 * workspace badge instead — this is the component to swap in the day the
 * product grows a second workspace, and its stories are the specification for
 * what that block has to do: name the current team, list the others with their
 * ⌘-number shortcut, and offer the one action that creates another.
 */
export function TeamSwitcher({
  teams,
}: {
  teams: { name: string; logo: React.ElementType; plan: string }[];
}) {
  const isMobile = useIsMobile();
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);

  if (!activeTeam) {
    return null;
  }

  return (
    <Menu position={isMobile ? 'bottom-start' : 'right-start'} width={224} shadow="md" offset={8}>
      <Menu.Target>
        <UnstyledButton
          aria-label={`Workspace: ${activeTeam.name}`}
          p="xs"
          style={{ borderRadius: 'var(--mantine-radius-md)', width: '100%' }}
        >
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={32} radius="md" variant="filled">
              <activeTeam.logo size={16} />
            </ThemeIcon>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                {activeTeam.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {activeTeam.plan}
              </Text>
            </div>
            <ChevronsUpDown size={16} />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Teams</Menu.Label>
        {teams.map((team, index) => (
          <Menu.Item
            key={team.name}
            onClick={() => setActiveTeam(team)}
            leftSection={
              <ThemeIcon size={24} radius="sm" variant="default">
                <team.logo size={14} />
              </ThemeIcon>
            }
            rightSection={
              <Text size="xs" c="dimmed">
                ⌘{index + 1}
              </Text>
            }
          >
            {team.name}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item
          leftSection={
            <ThemeIcon size={24} radius="sm" variant="default">
              <Plus size={16} />
            </ThemeIcon>
          }
        >
          <Text size="sm" c="dimmed" fw={500}>
            Add team
          </Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
