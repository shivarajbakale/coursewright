import { forwardRef } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Indicator,
  Menu,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { Bell, BookOpen, Check, CheckCheck, Hammer, Link2, X, type LucideIcon } from 'lucide-react';

import type { Notification, NotificationKind } from '@/api/types';
import { ErrorState, StatePanel } from '@/components/state-panel';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/useNotifications';

/**
 * What each notice is about, and whether it went well. The subject icon stays
 * neutral; only the small mark carries colour (lime for ready, red for
 * failed), so a menu of failures reads as a list, not an alarm.
 */
const KIND_META: Record<NotificationKind, { icon: LucideIcon; ok: boolean; label: string }> = {
  course_ready: { icon: BookOpen, ok: true, label: 'Course ready' },
  course_failed: { icon: BookOpen, ok: false, label: 'Build failed' },
  review_ready: { icon: Hammer, ok: true, label: 'Review ready' },
  review_failed: { icon: Hammer, ok: false, label: 'Review failed' },
  source_failed: { icon: Link2, ok: false, label: 'Link not indexed' },
};

/** "8m", "3h", "2d": relative time for a row. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.round(day / 7);
  if (week < 5) return `${week}w`;
  return new Date(iso).toLocaleDateString();
}

/** The sidebar row that opens the menu: a full row, or an icon when the sidebar is collapsed. */
const MenuTarget = forwardRef<HTMLButtonElement, { railed: boolean; unread: number; label: string }>(
  function MenuTarget({ railed, unread, label, ...rest }, ref) {
    if (railed) {
      return (
        <Tooltip label="Notifications" position="right" withArrow>
          <Indicator color="red" size={14} offset={6} disabled={unread === 0} label={unread > 9 ? '9+' : unread}>
            <ActionIcon ref={ref} variant="subtle" color="gray" size="lg" aria-label={label} {...rest}>
              <Bell size={16} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      );
    }
    return (
      <UnstyledButton
        ref={ref}
        aria-label={label}
        px="sm"
        py={6}
        style={{ borderRadius: 'var(--mantine-radius-md)', display: 'block' }}
        {...rest}
      >
        <Group gap="sm" wrap="nowrap">
          <Bell size={16} />
          <Text size="sm" style={{ flex: 1 }}>
            Notifications
          </Text>
          {unread > 0 && (
            <Badge size="sm" variant="filled" color="red" circle={unread < 10}>
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Group>
      </UnstyledButton>
    );
  }
);

/**
 * Notifications: a sidebar row with the unread count that opens the latest
 * notices. The agent service writes one when a course build or a project
 * review finishes or fails, and when a link you added can't be indexed.
 * Clicking a notice marks it read and opens what it is about.
 */
export function NotificationsDropdown({ railed = false }: { railed?: boolean }) {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const list = notifications.data ?? [];
  const unread = list.filter((n) => !n.read).length;

  const onSelect = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    void navigate({ to: n.href });
  };

  return (
    <Menu position={railed ? 'right-end' : 'top-start'} width={380} withinPortal offset={8}>
      <Menu.Target>
        <MenuTarget railed={railed} unread={unread} label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} />
      </Menu.Target>

      <Menu.Dropdown p={0}>
        <Group justify="space-between" px="md" py="sm" wrap="nowrap">
          <Text size="sm" fw={500}>
            Notifications
          </Text>
          {unread > 0 && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              leftSection={<CheckCheck size={14} />}
              loading={markAllRead.isPending}
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

        {notifications.isPending ? (
          <Stack component="ul" gap={4} p="xs" style={{ listStyle: 'none', margin: 0 }}>
            {[0, 1, 2].map((i) => (
              <Group key={i} component="li" align="flex-start" gap="sm" wrap="nowrap" p="xs">
                <Skeleton height={32} width={32} radius="md" />
                <Stack gap={6} style={{ flex: 1 }}>
                  <Skeleton height={14} width={180} />
                  <Skeleton height={12} width={120} />
                </Stack>
              </Group>
            ))}
          </Stack>
        ) : notifications.isError ? (
          <ErrorState
            size="compact"
            error={notifications.error}
            title="Notifications didn’t load"
            onRetry={() => notifications.refetch()}
            retrying={notifications.isRefetching}
          />
        ) : list.length === 0 ? (
          <StatePanel art="inbox" size="compact" title="You’re all caught up">
            Builds and reviews tell you here when they finish.
          </StatePanel>
        ) : (
          <ScrollArea.Autosize
            mah={440}
            scrollbars="y"
            // The scroll content is `min-width: min-content` by default, so it grew to the
            // longest title and the rows stopped truncating.
            styles={{ content: { minWidth: 0 } }}
          >
            <Box component="ul" p={4} m={0} style={{ listStyle: 'none' }} aria-label="Notifications">
              {list.map((n) => (
                <NotificationRow key={n.id} n={n} onSelect={onSelect} />
              ))}
            </Box>
          </ScrollArea.Autosize>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

function NotificationRow({ n, onSelect }: { n: Notification; onSelect: (n: Notification) => void }) {
  const meta = KIND_META[n.kind] ?? KIND_META.course_ready;
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
        aria-label={`${meta.label}: ${n.title}${n.read ? '' : ', unread'}`}
        style={{
          alignItems: 'flex-start',
          gap: 'var(--mantine-spacing-sm)',
          borderRadius: 'var(--mantine-radius-md)',
          // Unread rows sit on a faint wash so the eye finds them without a
          // second colour; read rows are flat.
          background: n.read ? undefined : 'color-mix(in oklab, var(--mantine-color-dimmed) 10%, transparent)',
        }}
      >
        <Box pos="relative" style={{ flexShrink: 0 }}>
          <ThemeIcon variant="default" size={32} radius="md">
            <Icon size={16} />
          </ThemeIcon>
          <ThemeIcon
            pos="absolute"
            bottom={-4}
            right={-4}
            size={16}
            radius="xl"
            color={meta.ok ? 'brand' : 'red'}
            variant="filled"
            aria-hidden
            style={{ border: '2px solid var(--mantine-color-body)' }}
          >
            {meta.ok ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
          </ThemeIcon>
        </Box>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Group justify="space-between" align="baseline" gap="xs" wrap="nowrap">
            <Text size="sm" fw={n.read ? 400 : 500} truncate>
              {n.title}
            </Text>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {relativeTime(n.createdAt)}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
            {n.body}
          </Text>
        </Box>
        {!n.read && (
          <Box
            aria-hidden
            w={6}
            h={6}
            mt={7}
            bg="var(--mantine-primary-color-filled)"
            style={{ flexShrink: 0, borderRadius: '50%' }}
          />
        )}
      </UnstyledButton>
    </li>
  );
}
