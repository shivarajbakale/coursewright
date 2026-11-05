import { StatePanel } from '@/components/state-panel';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Indicator,
  Menu,
  ScrollArea,
  Skeleton,
  Text,
  ThemeIcon,
  UnstyledButton,
  Stack,
} from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  AtSign,
  Bell,
  CheckCheck,
  CreditCard,
  GitMerge,
  MessageSquare,
  Rocket,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import type { Notification, NotificationKind } from '@/api/types';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from '@/hooks/useNotifications';

/** Icon + colour per notification kind. Kept here so the bell and the inbox
 *  use the same colour language. Colours are Mantine theme colours, so the
 *  `light` variant supplies both the tint and the foreground. */
const KIND_META: Record<NotificationKind, { icon: LucideIcon; color: string }> = {
  mention: { icon: AtSign, color: 'brand' },
  comment: { icon: MessageSquare, color: 'cyan' },
  invite: { icon: UserPlus, color: 'green' },
  deploy: { icon: Rocket, color: 'yellow' },
  payment: { icon: CreditCard, color: 'green' },
  system: { icon: GitMerge, color: 'gray' },
};

/** "8m", "3h", "2d" — relative time formatter for the bell preview. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.round(day / 7);
  if (week < 5) return `${week}w`;
  return new Date(iso).toLocaleDateString();
}

/** The topbar bell + dropdown. Shows the unread badge, the latest 5
 *  notifications, and a "Mark all read" action. Clicks on a row route to the
 *  notification's `href` (defaulting to /inbox) and mark it read. */
export function NotificationsDropdown() {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unread = (notifications ?? []).filter((n) => !n.read).length;
  const preview = (notifications ?? []).slice(0, 5);

  const onSelect = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    navigate({ to: n.href ?? '/inbox' });
  };

  return (
    <Menu position="bottom-end" width={360} withinPortal>
      <Menu.Target>
        {/* Indicator rather than a hand-placed absolute pill: it owns the
            offset, the overflow label and the ring against the header. */}
        <Indicator
          color="red"
          size={16}
          offset={4}
          disabled={unread === 0}
          label={unread > 9 ? '9+' : unread}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          >
            <Bell size={16} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>

      <Menu.Dropdown p={0}>
        <Group justify="space-between" px="md" py="sm" wrap="nowrap">
          <Text size="sm" fw={600}>
            Notifications
          </Text>
          {unread > 0 && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              leftSection={<CheckCheck size={14} />}
              onClick={(e) => {
                e.preventDefault();
                markAllRead.mutate();
              }}
            >
              Mark all read
            </Button>
          )}
        </Group>
        <Menu.Divider m={0} />

        {isLoading ? (
          <Stack component="ul" gap={4} p="xs" style={{ listStyle: 'none', margin: 0 }}>
            {[0, 1, 2].map((i) => (
              <Group key={i} component="li" align="flex-start" gap="sm" wrap="nowrap" p="xs">
                <Skeleton height={32} width={32} radius="md" />
                <Stack gap={6} style={{ flex: 1 }}>
                  <Skeleton height={14} width={160} />
                  <Skeleton height={12} width={96} />
                </Stack>
              </Group>
            ))}
          </Stack>
        ) : preview.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea.Autosize mah={420}>
            <Box component="ul" p={4} style={{ listStyle: 'none', margin: 0 }}>
              {preview.map((n) => (
                <NotificationRow key={n.id} n={n} onSelect={onSelect} />
              ))}
            </Box>
          </ScrollArea.Autosize>
        )}

        <Menu.Divider m={0} />
        <Box p={4}>
          <Button
            component={Link}
            to="/inbox"
            variant="subtle"
            color="gray"
            size="xs"
            fullWidth
          >
            View all notifications
          </Button>
        </Box>
      </Menu.Dropdown>
    </Menu>
  );
}

function NotificationRow({
  n,
  onSelect,
}: {
  n: Notification;
  onSelect: (n: Notification) => void;
}) {
  const meta = KIND_META[n.kind];
  const Icon = meta.icon;
  return (
    <li>
      <UnstyledButton
        type="button"
        onClick={() => onSelect(n)}
        px={10}
        py="xs"
        w="100%"
        display="flex"
        ta="left"
        style={{
          alignItems: 'flex-start',
          gap: 'var(--mantine-spacing-sm)',
          borderRadius: 'var(--mantine-radius-md)',
          // Unread rows sit on a faint wash so the eye finds them without a
          // second colour; read rows are flat.
          background: n.read
            ? undefined
            : 'color-mix(in oklab, var(--mantine-color-dimmed) 10%, transparent)',
        }}
      >
        <ThemeIcon variant="light" color={meta.color} size={32} radius="md">
          <Icon size={16} />
        </ThemeIcon>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Group justify="space-between" align="baseline" gap="xs" wrap="nowrap">
            <Text size="sm" fw={n.read ? 400 : 500} truncate>
              {n.title}
            </Text>
            <Text
              size="xs"
              c="dimmed"
              style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            >
              {relativeTime(n.createdAt)}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" truncate mt={2}>
            {n.body}
          </Text>
        </Box>
        {!n.read && (
          <Box
            aria-hidden
            w={6}
            h={6}
            mt={6}
            bg="var(--mantine-primary-color-filled)"
            style={{ flexShrink: 0, borderRadius: '50%' }}
          />
        )}
      </UnstyledButton>
    </li>
  );
}

function EmptyState() {
  return (
    <StatePanel art="inbox" size="compact" title="You’re all caught up">
      New activity will appear here.
    </StatePanel>
  );
}
