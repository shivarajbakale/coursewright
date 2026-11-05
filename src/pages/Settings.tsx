import { Badge, Group, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { useTheme } from '@/components/theme-provider';
import { useHealth, useIndexStats } from '@/hooks/useCoursewright';

/**
 * Settings: only what Coursewright actually has. How it looks, and which model
 * and embedder the agent service is using (configured in agent/.env, shown
 * here so you can tell what built a course and what the tutor runs on).
 */
export function Settings() {
  const { theme, setTheme } = useTheme();
  const health = useHealth();
  const stats = useIndexStats();
  const h = health.data;

  const provider = !h
    ? '…'
    : !h.anthropic
      ? 'Not connected'
      : h.provider === 'anthropic' || !h.provider
        ? 'Anthropic'
        : new URL(h.provider).host;

  return (
    <PageShell title="Settings" archetype="detail">
      <Reveal>
        <Stack gap={40} maw={720}>
          <Stack gap="sm" component="section" data-section="appearance" aria-label="Appearance">
            <Title order={2} size="h4">
              Appearance
            </Title>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">Theme</Text>
              <SegmentedControl
                value={theme}
                onChange={(v) => setTheme(v as typeof theme)}
                data={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </Group>
          </Stack>

          <Stack gap="sm" component="section" data-section="services" aria-label="Agent service">
            <Title order={2} size="h4">
              Agent service
            </Title>
            <Text size="sm" c="dimmed">
              Set in <code>agent/.env</code>. Restart the agent service after changing it.
            </Text>
            <Table verticalSpacing="sm">
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td w={200}>
                    <Text size="sm">Model provider</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm">{provider}</Text>
                      {h && !h.anthropic && (
                        <Badge color="yellow">Set ANTHROPIC_API_KEY</Badge>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>
                    <Text size="sm">Model</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {h?.model ?? '…'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>
                    <Text size="sm">Embeddings</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {stats.data ? `${stats.data.embedModel}, ${stats.data.dims} dims` : '…'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>
                    <Text size="sm">Version</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {h?.version ?? '…'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Stack>
        </Stack>
      </Reveal>
    </PageShell>
  );
}
