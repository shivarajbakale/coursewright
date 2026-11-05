import * as React from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  EmptyState,
  Group,
  Highlight,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import {
  Check,
  Mail,
  MoreHorizontal,
  Search,
  Send,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';

import type { Member, WorkspaceRole } from '@/api/types';
import {
  useChangeRole,
  useInviteMembers,
  useRemoveMember,
  useSeats,
  useTeam,
} from '@/hooks/useTeam';
import { PageShell } from '@/components/page-shell';
import { Stagger, StaggerItem } from '@/components/reveal';
import { StatCard } from '@/components/stat-card';

/**
 * Team — the workspace member directory.
 *
 * Layout:
 *   1. Seats strip — X of Y seats used, with plan context.
 *   2. Member table — every member with avatar, name, email, role, status,
 *      last-active, and a row menu (change role / remove).
 *   3. Invite dialog — one or more emails + role + optional team; sends mock
 *      invites, one request each.
 *
 * No invented data — every row comes from `useTeam()` and every action hits
 * the same mock API.
 */

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: 'Full workspace control. Cannot be removed.',
  admin: 'Manage members and projects.',
  member: 'Create and edit projects.',
  viewer: 'Read-only access.',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function TeamPage() {
  const { data: members, isLoading } = useTeam();
  const { data: seats } = useSeats();
  const [search, setSearch] = React.useState('');
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const list = members ?? [];
  const filtered = list.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.team ?? '').toLowerCase().includes(q)
    );
  });

  const activeCount = list.filter(m => m.status === 'active').length;
  const invitedCount = list.filter(m => m.status === 'invited').length;

  const header = (
    <Table.Tr>
      <Table.Th>Member</Table.Th>
      <Table.Th>Role</Table.Th>
      <Table.Th>Status</Table.Th>
      <Table.Th>Team</Table.Th>
      <Table.Th>Last active</Table.Th>
      <Table.Th w={48} />
    </Table.Tr>
  );

  return (
    <PageShell
      title="Team"
      description="Everyone with access to this workspace."
      archetype="list"
      toolbar={
        /* In the shell's pinned toolbar, not in the scrolling body.

           It was in the body, and probe rule B8 failed it at 1280 the first
           time this page was ever measured — narrow enough for the page to
           scroll, which is exactly when a reader reaches for the search and
           finds it gone. It passed at 1440 and 1920 for no better reason than
           that the content happened to fit. */
        <TextInput
          placeholder="Search by name, email, or team…"
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          leftSection={<Search size={16} />}
          maw={384}
          aria-label="Search team members"
        />
      }
      actions={
        <Button leftSection={<UserPlus size={16} />} onClick={() => setInviteOpen(true)}>
          Invite teammate
        </Button>
      }
    >
      <InviteDialog opened={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Stagger style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mantine-spacing-lg)' }}>
        {/* Seats strip */}
        <StaggerItem>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <StatCard
              icon={Users}
              label="Members"
              value={String(seats?.used ?? '—')}
              sub={`${activeCount} active · ${invitedCount} invited`}
            />
            <StatCard
              icon={Users}
              label="Seats"
              value={seats ? `${seats.used} / ${seats.total}` : '—'}
              sub={`on the ${seats?.plan === 'pro' ? 'Pro' : (seats?.plan ?? 'Free')} plan`}
              progress={seats ? seats.used / seats.total : 0}
            />
            <StatCard
              icon={Mail}
              label="Pending invites"
              value={String(invitedCount)}
              sub={invitedCount === 0 ? 'None waiting' : 'Waiting on accept'}
            />
          </SimpleGrid>
        </StaggerItem>

        {/* Member table */}
        <StaggerItem>
          {isLoading ? (
            <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
              <Table>
                <Table.Thead>{header}</Table.Thead>
                <Table.Tbody>
                  {[0, 1, 2, 3].map(i => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Skeleton height={36} circle />
                          <Stack gap={6}>
                            <Skeleton height={16} width={128} />
                            <Skeleton height={12} width={160} />
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={20} width={64} />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={20} width={64} />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={16} width={64} />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={16} width={80} />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={32} width={32} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          ) : filtered.length === 0 ? (
            <Paper withBorder radius="md" p="lg">
              <EmptyState
                icon={<Users size={20} />}
                title={search ? 'No matches' : 'No team members yet'}
                description={
                  search ? 'Try a different search.' : 'Invite your first teammate to get started.'
                }
              >
                {!search && (
                  <Button
                    leftSection={<UserPlus size={16} />}
                    onClick={() => setInviteOpen(true)}
                  >
                    Invite teammate
                  </Button>
                )}
              </EmptyState>
            </Paper>
          ) : (
            <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
              <ScrollArea>
                <Table highlightOnHover>
                  <Table.Thead>{header}</Table.Thead>
                  <Table.Tbody>
                    {filtered.map(m => (
                      <MemberRow key={m.id} m={m} query={search} />
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}
        </StaggerItem>
      </Stagger>
    </PageShell>
  );
}

function MemberRow({ m, query }: { m: Member; query: string }) {
  const changeRole = useChangeRole();
  const remove = useRemoveMember();

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar src={m.avatarUrl ?? undefined} alt={m.name} size={36} radius="xl" color="brand">
            {initials(m.name)}
          </Avatar>
          <Box style={{ minWidth: 0 }}>
            {/* `Highlight`, not bold text: emphasis and "this is why this row
                came back" are different claims, and <mark> is the one the
                browser and the screen reader already understand. With an empty
                query it renders as plain text. */}
            <Highlight highlight={query} size="sm" fw={500} truncate>
              {m.name}
            </Highlight>
            <Highlight highlight={query} size="xs" c="dimmed" truncate>
              {m.email}
            </Highlight>
          </Box>
        </Group>
      </Table.Td>
      <Table.Td>
        <RoleBadge role={m.role} />
      </Table.Td>
      <Table.Td>
        <StatusBadge status={m.status} />
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {m.team ?? '—'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {relativeTime(m.lastActiveAt)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Menu position="bottom-end" width={192} withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="md" aria-label="Row menu">
              <MoreHorizontal size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Change role</Menu.Label>
            {(['owner', 'admin', 'member', 'viewer'] as WorkspaceRole[]).map(r => (
              <Menu.Item
                key={r}
                disabled={r === m.role || m.role === 'owner'}
                onClick={() => changeRole.mutate({ id: m.id, role: r })}
                rightSection={
                  r === m.role ? (
                    <Check size={14} color="var(--mantine-primary-color-filled)" />
                  ) : null
                }
              >
                {ROLE_LABELS[r]}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item
              color="red"
              disabled={m.role === 'owner'}
              onClick={() => remove.mutate(m.id)}
              leftSection={<UserMinus size={16} />}
            >
              Remove member
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

function RoleBadge({ role }: { role: WorkspaceRole }) {
  // Owner is the only role that carries weight on this screen, so it is the
  // only filled badge; the rest are quiet by design.
  const props = (
    {
      owner: { variant: 'filled' as const, color: 'brand' },
      admin: { variant: 'light' as const, color: 'brand' },
      member: { variant: 'light' as const, color: 'gray' },
      viewer: { variant: 'outline' as const, color: 'gray' },
    } as const
  )[role];
  return (
    <Badge {...props} fw={400}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

const Dot = () => <Box w={6} h={6} bg="currentColor" style={{ borderRadius: '50%' }} />;

function StatusBadge({ status }: { status: Member['status'] }) {
  if (status === 'active') {
    return (
      <Badge variant="light" color="green" leftSection={<Dot />}>
        Active
      </Badge>
    );
  }
  if (status === 'invited') {
    return (
      <Badge variant="light" color="yellow" leftSection={<Dot />}>
        Invited
      </Badge>
    );
  }
  return (
    <Badge variant="light" color="gray" leftSection={<Dot />}>
      Disabled
    </Badge>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const invite = useInviteMembers();
  const [emails, setEmails] = React.useState<string[]>([]);
  const [role, setRole] = React.useState<WorkspaceRole>('member');
  const [team, setTeam] = React.useState('');

  // Everything typed that is not an address, named. A `TagsInput` will accept
  // anything, so the check that the single `TextInput` got from `type="email"`
  // has to be written here instead — silently dropping a typo'd address is how
  // someone finds out a week later that their new hire never got the invite.
  const invalid = emails.filter(e => !EMAIL_RE.test(e));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emails.length === 0 || invalid.length > 0) return;
    invite.mutate(
      emails.map(email => ({ email, role, team: team || undefined })),
      {
        onSuccess: () => {
          setEmails([]);
          setRole('member');
          setTeam('');
          onClose();
        },
      }
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Invite a teammate" size="md" centered>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            We’ll send each of them an invite link. They can join this workspace from any device.
          </Text>

          {/* `TagsInput` rather than `TextInput`: the addresses are the user's
              own, not a list to pick from, and inviting a team of four should
              not mean opening this dialog four times. `MultiSelect` is the
              wrong neighbour here for the same reason — it cannot accept a
              value that is not already an option.

              `data-autofocus`: inside a Modal the focus trap decides where
              focus lands once the open transition finishes, and this is what it
              looks for. `autoFocus` alone is overridden by the trap. */}
          <TagsInput
            id="invite-email"
            label="Emails"
            description="Enter, comma or space commits an address. Paste a list and it splits."
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            placeholder={emails.length === 0 ? 'alex@company.com' : undefined}
            value={emails}
            onChange={setEmails}
            splitChars={[',', ' ', ';']}
            acceptValueOnBlur
            clearable
            error={invalid.length > 0 ? `Not an email address: ${invalid.join(', ')}` : undefined}
            data-autofocus
          />

          <SimpleGrid cols={2} spacing="sm">
            <Select
              id="invite-role"
              label="Role"
              value={role}
              onChange={v => v && setRole(v as WorkspaceRole)}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
              data={(['admin', 'member', 'viewer'] as WorkspaceRole[]).map(r => ({
                value: r,
                label: `${ROLE_LABELS[r]} — ${ROLE_DESCRIPTIONS[r]}`,
              }))}
            />
            <TextInput
              id="invite-team"
              label="Team (optional)"
              placeholder="Engineering"
              value={team}
              onChange={e => setTeam(e.currentTarget.value)}
            />
          </SimpleGrid>

          <Group justify="flex-end" gap="xs">
            <Button type="button" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={emails.length === 0 || invalid.length > 0}
              loading={invite.isPending}
              leftSection={<Send size={16} />}
            >
              {emails.length > 1 ? `Send ${emails.length} invites` : 'Send invite'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
