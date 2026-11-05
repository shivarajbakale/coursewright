import * as React from 'react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  EmptyState,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  AtSign,
  BellOff,
  CheckCheck,
  CreditCard,
  Filter as FilterIcon,
  GitMerge,
  Inbox,
  MessageSquare,
  Rocket,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import type { Notification, NotificationKind } from '@/api/types';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/useNotifications';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';

/**
 * Inbox — the full notification center.
 *
 * Layout: a sticky filter bar at the top (All / Unread / Mentions /
 * Comments / Deploys), then a vertical feed. Each row shows the kind icon
 * (with kind-specific colour), actor, title, body, timestamp, and a "View
 * project" link when the notification is project-scoped.
 *
 * No invented data — every row comes from `useNotifications()` and every
 * action (mark read, mark all read) hits the same mock API the bell uses.
 */

const KIND_META: Record<NotificationKind, { icon: LucideIcon; color: string; label: string }> = {
  mention: { icon: AtSign, color: 'brand', label: 'Mentions' },
  comment: { icon: MessageSquare, color: 'cyan', label: 'Comments' },
  invite: { icon: UserPlus, color: 'green', label: 'Invites' },
  deploy: { icon: Rocket, color: 'yellow', label: 'Deploys' },
  payment: { icon: CreditCard, color: 'green', label: 'Payments' },
  system: { icon: GitMerge, color: 'gray', label: 'System' },
};

type Filter = 'all' | 'unread' | 'mention' | 'comment' | 'deploy' | 'system';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'mention', label: 'Mentions' },
  { value: 'comment', label: 'Comments' },
  { value: 'deploy', label: 'Deploys' },
  { value: 'system', label: 'System' },
];

/** One hairline between feed rows, owned here rather than by each row. */
const ROW_DIVIDER = '1px solid var(--mantine-color-default-border)';

export function InboxPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const [filter, setFilter] = React.useState<Filter>('all');

  const notifications = React.useMemo(() => data ?? [], [data]);
  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = React.useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.kind === filter);
  }, [notifications, filter]);

  const counts = React.useMemo(() => {
    return {
      all: notifications.length,
      unread: unreadCount,
      mention: notifications.filter(n => n.kind === 'mention').length,
      comment: notifications.filter(n => n.kind === 'comment').length,
      deploy: notifications.filter(n => n.kind === 'deploy').length,
      system: notifications.filter(n => n.kind === 'system').length,
    } as Record<Filter, number>;
  }, [notifications, unreadCount]);

  const onSelect = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    navigate({ to: n.href ?? '/inbox' });
  };

  return (
    <PageShell
      title="Inbox"
      description="Activity across your projects, mentions, and deploys."
      archetype="list"
      toolbar={
        /* In the shell's pinned toolbar slot, not in the scrolling body.

           It was in the body, and probe rule B8 failed it the first time this
           page was ever measured: the filter scrolled away with the rows. A
           reader reaches for a filter exactly when they have scrolled far
           enough to be lost, which is exactly when it was gone. */
        <Group gap="xs" wrap="nowrap">
          <FilterIcon aria-hidden size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
          <ScrollArea w="100%" pb={4} style={{ whiteSpace: 'nowrap' }}>
            <SegmentedControl
              size="xs"
              value={filter}
              onChange={v => setFilter(v as Filter)}
              aria-label="Filter notifications"
              data={FILTERS.map(f => ({
                value: f.value,
                label: `${f.label} ${counts[f.value]}`,
              }))}
            />
          </ScrollArea>
        </Group>
      }
      actions={
        unreadCount > 0 && (
          <Button
            variant="default"
            size="xs"
            leftSection={<CheckCheck size={16} />}
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          >
            Mark all read
          </Button>
        )
      }
    >
      <Reveal style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mantine-spacing-md)' }}>
        {/* Feed */}
        {isLoading ? (
          <Paper withBorder radius="md" p={0}>
            <Box component="ul" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <Group
                  key={i}
                  component="li"
                  align="flex-start"
                  gap="sm"
                  wrap="nowrap"
                  p="md"
                  style={{ borderTop: i === 0 ? undefined : ROW_DIVIDER }}
                >
                  <Skeleton height={36} width={36} radius="md" />
                  <Stack gap={6} style={{ flex: 1 }}>
                    <Skeleton height={16} width={192} />
                    <Skeleton height={12} width={288} />
                    <Skeleton height={12} width={96} />
                  </Stack>
                </Group>
              ))}
            </Box>
          </Paper>
        ) : isError ? (
          <Paper withBorder radius="md" p="lg">
            <EmptyState
              icon={<BellOff size={20} />}
              title="Couldn’t load notifications"
              description="Check your connection and try again."
            >
              <Button variant="default" size="xs" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </EmptyState>
          </Paper>
        ) : filtered.length === 0 ? (
          <Paper withBorder radius="md" p="lg">
            <EmptyState
              icon={<Inbox size={20} />}
              title={
                filter === 'unread'
                  ? 'Nothing unread'
                  : filter === 'all'
                    ? 'Your inbox is empty'
                    : `No ${filter} notifications`
              }
              description={
                filter === 'unread'
                  ? 'You’ve cleared everything — nice work.'
                  : 'New activity will show up here.'
              }
            />
          </Paper>
        ) : (
          <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
            {/* The reset is explicit: nothing in this app ships a global one, so
                a bare <ul> arrives with the browser's bullets and indent. */}
            <Box component="ul" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filtered.map((n, i) => (
                <InboxRow key={n.id} n={n} onSelect={onSelect} first={i === 0} />
              ))}
            </Box>
          </Paper>
        )}
      </Reveal>
    </PageShell>
  );
}

function InboxRow({
  n,
  onSelect,
  first,
}: {
  n: Notification;
  onSelect: (n: Notification) => void;
  first: boolean;
}) {
  const meta = KIND_META[n.kind];
  const Icon = meta.icon;
  return (
    <li style={{ borderTop: first ? undefined : ROW_DIVIDER }}>
      <UnstyledButton
        type="button"
        onClick={() => onSelect(n)}
        p="md"
        w="100%"
        display="flex"
        ta="left"
        style={{
          alignItems: 'flex-start',
          gap: 'var(--mantine-spacing-sm)',
          // Unread rows sit on a faint wash. No second colour, no badge — the
          // weight of the title and this tint carry it.
          background: n.read
            ? undefined
            : 'color-mix(in oklab, var(--mantine-color-dimmed) 8%, transparent)',
        }}
      >
        <ThemeIcon variant="light" color={meta.color} size={36} radius="md" aria-hidden>
          <Icon size={16} />
        </ThemeIcon>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Group justify="space-between" align="baseline" gap="sm" wrap="nowrap">
            <Text size="sm" fw={n.read ? 400 : 500}>
              {n.title}
            </Text>
            <Text component="time" size="xs" c="dimmed" style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {new Date(n.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            {n.body}
          </Text>
          <Group gap="sm" mt="xs">
            <Badge size="sm" variant="light" color="gray" tt="capitalize">
              {KIND_META[n.kind].label.replace(/s$/, '')}
            </Badge>
            {n.projectId && (
              /*
               * `renderRoot` rather than `component={Link}`: a typed route link
               * carries its own generics for `to` and `params`, and passing it
               * through Mantine's polymorphic `component` erases them — the
               * param object stops type-checking against the route. This keeps
               * Link's types intact and lets Mantine style the element it
               * renders.
               */
              <Anchor
                size="xs"
                fw={500}
                onClick={e => e.stopPropagation()}
                renderRoot={props => (
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: n.projectId as string }}
                    {...props}
                  />
                )}
              >
                View project →
              </Anchor>
            )}
          </Group>
        </Box>
        {!n.read && (
          <Box
            aria-label="Unread"
            w={8}
            h={8}
            mt={8}
            bg="var(--mantine-primary-color-filled)"
            style={{ flexShrink: 0, borderRadius: '50%' }}
          />
        )}
      </UnstyledButton>
    </li>
  );
}
