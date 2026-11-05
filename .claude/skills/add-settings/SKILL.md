---
name: add-settings
description: Build a settings page with the Stripe-style sidebar-nav layout (sections in a left rail, content in the right pane). Covers Profile, Appearance, Notifications, Integrations, and Danger Zone patterns, plus the Mantine input `label`/`description` slots for settings that no form owns. Use when the user asks to add a settings page, a profile page, a preferences page, or "where users configure X".
---

# add-settings — Stripe-style sidebar-nav settings page

Settings pages in this app use the **sidebar-nav layout** that ds-011
adopted: a left rail with section labels and a right pane showing the
active section's content. This replaces the older tabbed layout and
makes deep-link sharing, screen-reader navigation, and mobile collapse
all simpler.

## Read these first

- `src/pages/Settings.tsx` — the canonical example. Five
  sections (Profile / Appearance / Notifications / Integrations / Danger
  Zone), each in its own right pane, with the rail driving state.
- `src/components/panel.tsx` — the section surface every settings group sits
  in. Mantine inputs carry their own label, description and error slots, so a
  settings field is one component and needs no RHF unless it is a real form.
- `docs/principles/microcopy.md` — button verbs, danger-zone copy.

## The recipe

A settings page is a `<PageShell>` with two children: a left rail and a
right pane. Both are inside the shell so the scroll region is shared.

```tsx
// src/pages/Settings.tsx
import { useState } from 'react';
import { Box, Flex, NavLink, SimpleGrid, Tabs } from '@mantine/core';

import { PageShell } from '@/components/page-shell';

type Section = 'profile' | 'appearance' | 'notifications' | 'integrations' | 'danger';

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  // ...
];

export function Settings() {
  const [active, setActive] = useState<Section>('profile');

  return (
    <PageShell title="Settings" description="Configure your workspace." archetype="settings" scroll={false}>
      <Flex direction={{ base: 'column', lg: 'row' }} h="100%" style={{ minHeight: 0 }}>
        {/* Section rail — desktop. `visibleFrom` / `hiddenFrom` are Mantine's
            own responsive switch: the two halves never both render. */}
        <Box component="nav" aria-label="Settings sections" w={208} visibleFrom="lg" style={{ flexShrink: 0 }}>
          {SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              label={s.label}
              leftSection={<s.icon size={16} />}
              active={active === s.id}
              onClick={() => setActive(s.id)}
            />
          ))}
        </Box>

        {/* Mobile — the same sections as a scrolling tab strip */}
        <Tabs value={active} onChange={(v) => v && setActive(v as Section)} hiddenFrom="lg">
          <Tabs.List style={{ width: 'max-content', flexWrap: 'nowrap' }}>
            {SECTIONS.map((s) => (
              <Tabs.Tab key={s.id} value={s.id} fz="xs">
                {s.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {active === 'profile' && <ProfileSection />}
        {active === 'appearance' && <AppearanceSection />}
      </Flex>
    </PageShell>
  );
}
```

## Section patterns

### Profile

```tsx
function ProfileSection() {
  return (
    <Panel title="Profile">
      <Stack gap="md">
        <TextInput
          label="Display name"
          description="How your name appears across the workspace."
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          defaultValue="Demo User"
        />
        <TextInput
          label="Email"
          type="email"
          description="Used for notifications and sign-in."
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          defaultValue="demo@rocketship.dev"
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray">
            Cancel
          </Button>
          <Button>Save changes</Button>
        </Group>
      </Stack>
    </Panel>
  );
}
```

### Appearance (theme cards)

The Appearance section shows a row of selectable cards (Light / Dark /
System) with a small swatch inside. Use the radio-group pattern:

```tsx
<Radio.Group value={theme} onChange={setTheme} label="Theme">
  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
    {themes.map((t) => (
      <Card
        key={t.id}
        withBorder
        padding="md"
        component="label"
        style={{ cursor: 'pointer' }}
        // The selected card is outlined with the primary colour, which is the
        // same signal the rest of the app uses for "this one".
        __vars={{ '--card-border-color': theme === t.id ? 'var(--mantine-primary-color-filled)' : undefined }}
      >
        <Radio value={t.id} label={t.label} size="xs" />
        <SimpleGrid cols={3} spacing={4} mt="sm">
          {t.swatches.map((s) => (
            <Box key={s} h={20} bg={s} style={{ borderRadius: 'var(--mantine-radius-sm)' }} />
          ))}
        </SimpleGrid>
      </Card>
    ))}
  </SimpleGrid>
</Radio.Group>
```

### Notifications (toggle rows)

```tsx
function NotificationsSection() {
  const [emailDigest, setEmailDigest] = useState(true);
  return (
    <Panel title="Notifications">
      <Group justify="space-between" wrap="nowrap">
        <Box style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            Weekly email digest
          </Text>
          <Text size="xs" c="dimmed">
            Summary of activity in your workspace.
          </Text>
        </Box>
        <Switch
          checked={emailDigest}
          onChange={(e) => setEmailDigest(e.currentTarget.checked)}
          aria-label="Weekly email digest"
        />
      </Group>
      {/* more toggle rows */}
    </Panel>
  );
}
```

### Integrations (service cards)

A row of service cards with a "Connected" / "Not connected" badge and a
disclosure menu for "Disconnect". Real integrations call a service; here
we use a "starter placeholder" disabled button.

### Danger Zone

The danger zone is a `Panel` whose actions are red and whose confirmation is
`modals.openConfirmModal` — the manager is mounted in `ThemeProvider`, so any
component can open one without threading state:

```tsx
import { modals } from '@mantine/modals';

<Panel title="Danger zone">
  <Group justify="space-between" wrap="nowrap">
    <Box style={{ flex: 1 }}>
      <Text size="sm" fw={500}>
        Delete this workspace
      </Text>
      <Text size="xs" c="dimmed">
        Permanently remove this workspace and every account in it. This cannot be undone.
      </Text>
    </Box>
    <Button
      color="red"
      size="xs"
      onClick={() =>
        modals.openConfirmModal({
          title: 'Delete "Acme Inc."?',
          children: <Text size="sm">This cannot be undone.</Text>,
          labels: { confirm: 'Delete', cancel: 'Cancel' },
          confirmProps: { color: 'red' },
          onConfirm: onDelete,
        })
      }
    >
      Delete workspace
    </Button>
  </Group>
</Panel>
```

Never `window.confirm()` — `ui-lint`'s `native-dialog` rule fails the build on
it, and a native dialog is unstyled, unthemed and blocks the main thread.

## Don'ts

- **Don't use Tabs for section nav.** Tabs are for switching between
  *views of the same data*; sections are orthogonal. Use a sidebar rail.
- **Don't put Save buttons in every section header.** One primary action
  per section is enough. If the section is read-only (Appearance shows
  the theme; Integrations shows connections), don't add a Save button at
  all — the controls mutate immediately and toast on success/error.
- **Don't put destructive actions outside the Danger Zone.** API tokens,
  billing, delete — all in one section, with red controls so users read it as
  the kill-switch it is.
- **Don't forget mobile collapse.** The rail goes to a top bar on
  screens narrower than `md`. Sections become a row of tabs.
- **Don't disable the Save button while idle.** Only disable while
  pending. "Disabled when nothing has changed" is the same anti-pattern
  as "always disabled".
- **Don't use modals for settings content.** The settings page IS the
  modal — its own right pane. Use a dialog only for confirmation of a
  destructive action.

## Verify

1. Tab through every interactive element — focus is visible and the
   order is logical (rail → section content → buttons).
2. Click each section — the URL doesn't change unless you wire
   `?section=…` for deep linking. Settings state is local by default.
3. Toggle a switch — it persists across navigation (settings are stored
   server-side; the local state is just for the UI).
4. Open the Danger Zone confirmation — focus lands on Cancel (the safe
   choice), not Delete.
5. Resize to mobile width — the rail collapses to a top tab strip.
6. Toggle theme — the Appearance card outline tracks the selected theme.

See `ux-prepass` for the mandatory UI gates.
