import * as React from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Group,
  NavLink,
  Paper,
  Radio,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Bell,
  CreditCard,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Plug,
  ShieldAlert,
  Sun,
  User,
} from 'lucide-react';
import { toast } from '@/lib/notify';

import { useSession } from '@/lib/auth';
import { useTheme } from '@/components/theme-provider';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { Panel } from '@/components/panel';

/**
 * Settings — sidebar-nav layout, Stripe-style.
 *
 * A long page with three flat tabs reads like a wall of forms. A left rail
 * with section labels reads like a control panel. The rail stays put while
 * the content scrolls, so jumping between sections doesn't lose context.
 *
 * Sections live in a typed registry so adding a new one is a single line.
 */
type SectionId = 'profile' | 'appearance' | 'notifications' | 'integrations' | 'danger';

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'danger', label: 'Danger zone', icon: ShieldAlert },
];

const themes = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const profileSchema = z.object({
  name: z.string().min(1, 'Name can’t be empty'),
  email: z.string().email('Enter a valid email'),
});

type ProfileValues = z.infer<typeof profileSchema>;

const NOTIFICATION_PREFS = [
  {
    id: 'product_updates',
    title: 'Product updates',
    description: 'New features, improvements, and changelog highlights.',
    defaultChecked: true,
  },
  {
    id: 'security_alerts',
    title: 'Security alerts',
    description: 'Sign-ins from new devices, password changes, and team changes.',
    defaultChecked: true,
  },
  {
    id: 'weekly_digest',
    title: 'Weekly digest',
    description: 'A Monday-morning summary of activity across your projects.',
    defaultChecked: false,
  },
  {
    id: 'marketing',
    title: 'Marketing & tips',
    description: 'Occasional emails about how to get more out of the workspace.',
    defaultChecked: false,
  },
] as const;

const INTEGRATIONS = [
  { id: 'github', name: 'GitHub', description: 'Sync issues and pull requests.', connected: true },
  { id: 'slack', name: 'Slack', description: 'Send activity to a Slack channel.', connected: false },
  { id: 'linear', name: 'Linear', description: 'Two-way sync with Linear issues.', connected: false },
  { id: 'figma', name: 'Figma', description: 'Embed Figma frames in projects.', connected: true },
] as const;

const HAIRLINE = '1px solid var(--mantine-color-default-border)';

export function Settings() {
  const [active, setActive] = React.useState<SectionId>('profile');

  return (
    <PageShell
      title="Settings"
      description="Manage your account and workspace preferences."
      scroll={false}
      archetype="settings"
      bodyProps={{ px: 0 }}
    >
      {/* Rail beside content on a wide window, stacked under the tab strip on
          a narrow one. `Flex` rather than a grid because the two children that
          switch places are the ones being hidden, and `visibleFrom`/`hiddenFrom`
          take an element out of the flow entirely. */}
      <Flex direction={{ base: 'column', lg: 'row' }} h="100%" style={{ minHeight: 0 }}>
        {/* Section rail — left */}
        <Box
          component="nav"
          aria-label="Settings sections"
          px="xs"
          py={8}
          w={224}
          visibleFrom="lg"
          style={{ flexShrink: 0, borderRight: HAIRLINE }}
        >
          {SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              component="button"
              type="button"
              active={active === s.id}
              onClick={() => setActive(s.id)}
              aria-current={active === s.id ? 'page' : undefined}
              label={s.label}
              leftSection={<s.icon size={16} />}
              variant="light"
            />
          ))}
        </Box>

        {/* Mobile section select — Tabs, scrolled horizontally when the labels
            outrun the viewport. */}
        <Box
          px="lg"
          py={8}
          hiddenFrom="lg"
          mb="xs"
          mx="calc(var(--mantine-spacing-lg) * -1)"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            borderBottom: HAIRLINE,
            background: 'color-mix(in oklab, var(--mantine-color-body) 95%, transparent)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Tabs value={active} onChange={(v) => v && setActive(v as SectionId)}>
            <ScrollArea w="100%">
              <Tabs.List style={{ width: 'max-content', flexWrap: 'nowrap' }}>
                {SECTIONS.map((s) => (
                  <Tabs.Tab key={s.id} value={s.id} fz="xs">
                    {s.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </ScrollArea>
          </Tabs>
        </Box>

        {/* Content — right, scrolls */}
        <ScrollColumn>
          {/* Keyed on the section, so switching sections replays the entrance.
              A settings pane swap is a content change with no navigation and no
              scroll movement to signal it; without this the right-hand column
              simply becomes different text. */}
          <Reveal key={active}>
            {active === 'profile' && <ProfileSection />}
            {active === 'appearance' && <AppearanceSection />}
            {active === 'notifications' && <NotificationsSection />}
            {active === 'integrations' && <IntegrationsSection />}
            {active === 'danger' && <DangerSection />}
          </Reveal>
        </ScrollColumn>
      </Flex>
    </PageShell>
  );
}

/* ----------------------------- Sections ----------------------------- */

function ProfileSection() {
  const { data: session } = useSession();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: session?.user?.name ?? '',
      email: session?.user?.email ?? '',
    },
  });

  const initials = (session?.user?.name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Stack gap="lg">
      {/* Identity card */}
      <Panel
        title="Profile"
        description="Your personal information and how it appears across the workspace."
      >
        <Group align="flex-start" gap="md" wrap="nowrap">
          <Avatar
            src={session?.user?.image ?? undefined}
            alt={session?.user?.name}
            size={64}
            radius="xl"
            color="brand"
          >
            {initials}
          </Avatar>
          <Stack gap="xs">
            <div>
              <Text size="sm" fw={500}>
                {session?.user?.name ?? '—'}
              </Text>
              <Text size="xs" c="dimmed">
                {session?.user?.email ?? '—'}
              </Text>
            </div>
            <Group gap="xs">
              <Button variant="default" size="xs" disabled>
                Upload photo
              </Button>
              <Button variant="subtle" color="gray" size="xs" disabled>
                Remove
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Avatar upload is a starter placeholder — wire it to your provider.
            </Text>
          </Stack>
        </Group>
      </Panel>

      {/* Editable fields */}
      <Panel title="Account" description="Update your name and email address.">
        {session ? (
          <form onSubmit={handleSubmit(() => toast.success('Profile saved'))}>
            <Stack gap="md" maw={576}>
              <TextInput
                label="Name"
                placeholder="Your name"
                error={errors.name?.message}
                {...register('name')}
              />
              <TextInput
                label="Email"
                type="email"
                placeholder="you@example.com"
                description="Used for sign-in and notifications."
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                error={errors.email?.message}
                {...register('email')}
              />
              <Group justify="flex-end">
                <Button type="submit" size="xs">
                  Save changes
                </Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <Stack gap="sm" maw={384}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
      </Panel>
    </Stack>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = React.useState('comfortable');
  return (
    <Stack gap="lg">
      <Panel
        title="Theme"
        description="Choose how the console looks. System follows your OS preference."
      >
        <Radio.Group
          value={theme}
          onChange={(v) => setTheme(v as (typeof themes)[number]['value'])}
          aria-label="Theme"
        >
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {themes.map((t) => (
              <ChoiceCard
                key={t.value}
                value={t.value}
                label={t.label}
                icon={t.icon}
                description={t.value === 'system' ? 'Match OS' : `Always ${t.value.toLowerCase()}`}
              />
            ))}
          </SimpleGrid>
        </Radio.Group>
      </Panel>

      <Panel title="Density" description="How compact the workspace should feel.">
        <Radio.Group value={density} onChange={setDensity} aria-label="Density">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <ChoiceCard
              value="comfortable"
              label="Comfortable"
              description="More breathing room between rows."
            />
            <ChoiceCard value="compact" label="Compact" description="More rows visible at once." />
          </SimpleGrid>
        </Radio.Group>
      </Panel>
    </Stack>
  );
}

function NotificationsSection() {
  return (
    <Panel
      title="Notifications"
      description="Decide which emails we send you. You can change these anytime."
    >
      <Box component="ul" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {NOTIFICATION_PREFS.map((p, i) => (
          <Group
            key={p.id}
            component="li"
            align="flex-start"
            justify="space-between"
            gap="md"
            wrap="nowrap"
            py="md"
            style={{ borderTop: i === 0 ? undefined : HAIRLINE }}
          >
            <Box>
              <Text size="sm" fw={500}>
                {p.title}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                {p.description}
              </Text>
            </Box>
            <Switch defaultChecked={p.defaultChecked} aria-label={p.title} />
          </Group>
        ))}
      </Box>
    </Panel>
  );
}

function IntegrationsSection() {
  return (
    <Panel
      title="Integrations"
      description="Connect third-party services. Disconnecting won't delete data on the other side."
    >
      <SimpleGrid
        cols={{ base: 1, sm: 2 }}
        spacing="sm"
        component="ul"
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {INTEGRATIONS.map((i) => (
          <li key={i.id}>
            <Paper
              withBorder
              radius="md"
              p="md"
              h="100%"
              display="flex"
              style={{ alignItems: 'flex-start', gap: 'var(--mantine-spacing-sm)' }}
            >
              <ThemeIcon variant="light" color="gray" size={36} radius="md">
                <Plug size={16} />
              </ThemeIcon>
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} truncate>
                    {i.name}
                  </Text>
                  {i.connected ? (
                    <Badge
                      variant="light"
                      color="green"
                      leftSection={
                        <Box w={6} h={6} bg="currentColor" style={{ borderRadius: '50%' }} />
                      }
                    >
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="light" color="gray">
                      Not connected
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {i.description}
                </Text>
                <Button variant="default" size="xs" mt="sm" disabled>
                  {i.connected ? 'Manage' : 'Connect'}
                </Button>
              </Box>
            </Paper>
          </li>
        ))}
      </SimpleGrid>
      <SectionHint>
        Integration buttons are starter placeholders. Wire each one to your provider's OAuth
        flow.
      </SectionHint>
    </Panel>
  );
}

function DangerSection() {
  return (
    <Stack gap="lg">
      <Panel
        title="API tokens"
        description="Personal access tokens for the CLI and scripts."
        tone="muted"
      >
        <Group justify="space-between" gap="md" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <KeyRound size={16} color="var(--mantine-color-dimmed)" />
            <div>
              <Text size="sm" fw={500}>
                No active tokens
              </Text>
              <Text size="xs" c="dimmed">
                Tokens are starter placeholders in the demo.
              </Text>
            </div>
          </Group>
          <Button variant="default" size="xs" disabled>
            Generate token
          </Button>
        </Group>
      </Panel>

      <Panel
        title="Billing"
        description="Update your plan, payment method, or invoice email."
        tone="muted"
      >
        <Group justify="space-between" gap="md" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <CreditCard size={16} color="var(--mantine-color-dimmed)" />
            <div>
              <Text size="sm" fw={500}>
                Free workspace
              </Text>
              <Text size="xs" c="dimmed">
                You're on the demo plan — no card required.
              </Text>
            </div>
          </Group>
          <Button variant="default" size="xs" disabled>
            Upgrade
          </Button>
        </Group>
      </Panel>

      <Panel
        title="Danger zone"
        description="Irreversible actions. Be sure before you proceed."
        tone="danger"
      >
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <AlertTriangle
            size={20}
            style={{ marginTop: 2, flexShrink: 0 }}
            color="var(--mantine-color-red-filled)"
          />
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              Delete this workspace
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Permanently remove this workspace, all its projects, and revoke access for every
              member. This action cannot be undone.
            </Text>
          </Box>
          <Button
            color="red"
            size="xs"
            onClick={() => toast.error('This is a demo — nothing was deleted.')}
          >
            Delete workspace
          </Button>
        </Group>
      </Panel>
    </Stack>
  );
}

/* ----------------------------- Primitives ----------------------------- */

function ScrollColumn({ children }: { children: React.ReactNode }) {
  return (
    <ScrollArea style={{ minWidth: 0, minHeight: 0, flex: 1 }}>
      <Stack gap="lg" maw={768} mx="auto" px="lg" py="lg">
        {children}
      </Stack>
    </ScrollArea>
  );
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" c="dimmed" mt="md">
      <Text span size="xs" fw={500} inherit>
        Heads up:
      </Text>{' '}
      {children}
    </Text>
  );
}

/**
 * A selectable card inside a `Radio.Group`.
 *
 * `Radio.Card` owns the hit area, the selected border and the radio semantics
 * together — a screen reader announces one choice out of three, and the arrow
 * keys traverse the group. Hand-rolling this as `<button aria-pressed>` loses
 * all of that, which is why the component exists rather than a styled div.
 */
function ChoiceCard({
  value,
  label,
  description,
  icon: Icon,
}: {
  value: string;
  label: string;
  description: string;
  icon?: React.ElementType;
}) {
  return (
    <Radio.Card value={value} radius="md" p="md" style={{ cursor: 'pointer' }}>
      <Group justify="space-between" wrap="nowrap">
        {Icon ? (
          <Icon size={20} color="var(--mantine-color-dimmed)" />
        ) : (
          <Text size="sm" fw={500}>
            {label}
          </Text>
        )}
        <Radio.Indicator />
      </Group>
      <Box mt="sm">
        {Icon && (
          <Text size="sm" fw={500}>
            {label}
          </Text>
        )}
        <Text size="xs" c="dimmed" mt={2}>
          {description}
        </Text>
      </Box>
    </Radio.Card>
  );
}
