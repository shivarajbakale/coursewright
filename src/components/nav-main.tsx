import { Link } from '@tanstack/react-router';
import { ActionIcon, NavLink, Stack, Text, Tooltip } from '@mantine/core';
import { type LucideIcon } from 'lucide-react';

/**
 * Primary sidebar navigation.
 *
 * Mantine's `NavLink` is the whole component now: it carries the active state,
 * the icon slot, and — for an entry with children — the disclosure that used to
 * need a `Collapsible` wrapper, a rotating chevron and a `SidebarMenuSub` list.
 * Nesting is `<NavLink>` inside `<NavLink>`, and `defaultOpened` on the active
 * branch keeps the group a user is inside open when they arrive.
 *
 * `railed` is the icon-only mode. A rail cannot show a label, so it must say
 * the name some other way or the navigation becomes a row of guesses: each
 * entry is a tooltip-wrapped `ActionIcon` with an `aria-label`, which is also
 * what a screen reader reads. A collapsed group flattens to its parent icon and
 * navigates to the parent route — the children are reachable the moment the
 * rail expands, and a fly-out menu on hover is a worse answer than the width
 * toggle already sitting in the topbar.
 */
export type NavMainItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: { title: string; url: string }[];
};

export function NavMain({ items, railed = false }: { items: NavMainItem[]; railed?: boolean }) {
  if (railed) {
    return (
      <Stack gap={4} align="center" p="xs" component="nav" aria-label="Primary">
        {items.map((item) => (
          <Tooltip key={item.title} label={item.title} position="right" withArrow>
            <ActionIcon
              component={Link}
              to={item.url}
              aria-label={item.title}
              size="lg"
              radius="md"
              variant={item.isActive ? 'light' : 'subtle'}
              color={item.isActive ? undefined : 'gray'}
            >
              {item.icon && <item.icon size={16} />}
            </ActionIcon>
          </Tooltip>
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={2} p="xs" component="nav" aria-label="Primary">
      <Text size="xs" fw={500} c="dimmed" px="xs" pb={4}>
        Platform
      </Text>
      {items.map((item) =>
        item.items?.length ? (
          <NavLink
            key={item.title}
            label={item.title}
            leftSection={item.icon && <item.icon size={16} />}
            defaultOpened={item.isActive}
            childrenOffset={28}
          >
            {item.items.map((sub) => (
              <NavLink key={sub.title} component={Link} to={sub.url} label={sub.title} />
            ))}
          </NavLink>
        ) : (
          <NavLink
            key={item.title}
            component={Link}
            to={item.url}
            label={item.title}
            leftSection={item.icon && <item.icon size={16} />}
            active={item.isActive}
          />
        ),
      )}
    </Stack>
  );
}
