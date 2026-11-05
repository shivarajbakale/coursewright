import { Box, Center, Flex, Group, List, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Check } from 'lucide-react';

const features = [
  'Auth, sidebar, and command palette wired in',
  'Type-safe data layer with mock API included',
  'A skills system to build any feature end-to-end',
];

/** Split-screen auth chrome: a dark brand panel + a centered form column. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={0} mih="100svh">
      {/* Brand panel. One step darker than the page so the form column reads as
          the place to act — `--mantine-color-dark-9` in dark, the light-mode
          equivalent in light. */}
      <Flex
        direction="column"
        justify="space-between"
        p={48}
        pos="relative"
        visibleFrom="lg"
        style={{
          overflow: 'hidden',
          background:
            'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-9))',
        }}
      >
        <Box className="bg-grid bg-radial-fade" pos="absolute" inset={0} opacity={0.4} />
        {/* Accent bloom behind the panel — drawn, not composed: no edge, no
            content, so it is a background rather than a surface. */}
        <Box
          aria-hidden
          pos="absolute"
          top="-25%"
          left="50%"
          w={560}
          h={560}
          style={{
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: 'var(--mantine-primary-color-light)',
            filter: 'blur(120px)',
          }}
        />

        <Group gap={10} pos="relative">
          <ThemeIcon size={32} radius="md">
            <svg viewBox="0 0 32 32" width={16} height={16} fill="none">
              <path
                d="M10 11.5L14.5 16L10 20.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M16.5 21H22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Console
          </Text>
        </Group>

        <Stack gap="lg" pos="relative">
          <Title order={2} size="h2" maw={448} lh={1.2}>
            Ship your product, not your boilerplate.
          </Title>
          {/* `List` with `icon` per item, not a hand-built `ul` of icon+text
              rows: the component owns the marker column and its alignment. */}
          <List
            spacing="sm"
            center
            icon={
              <ThemeIcon variant="light" size={20} radius="xl">
                <Check size={12} />
              </ThemeIcon>
            }
          >
            {features.map(f => (
              <List.Item key={f}>
                <Text size="sm" c="dimmed">
                  {f}
                </Text>
              </List.Item>
            ))}
          </List>
        </Stack>

        <Text component="blockquote" size="sm" c="dimmed" maw={448} pos="relative">
          “The fastest way from idea to a real, running product.”
          <Text component="footer" size="sm" fw={500} mt="xs">
            — Your future self
          </Text>
        </Text>
      </Flex>

      {/* Form column. The archetype is declared here rather than on the
          viewport: the brand panel beside it is chrome, and `centered-card`
          measures the card against the space it is centred in (probe rule B4,
          docs/principles/screen-archetypes.md). */}
      <Center data-archetype="centered-card" px={{ base: 'lg', sm: 40 }} py={48}>
        <Box data-panel="auth" w="100%" maw={384}>
          {children}
        </Box>
      </Center>
    </SimpleGrid>
  );
}
