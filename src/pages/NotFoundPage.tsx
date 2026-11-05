import { Box, Button, Flex, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Compass, Home, Search } from 'lucide-react';

/**
 * 404 — friendly "page not found" with three recovery actions.
 *
 * Renders without the app shell (no sidebar/topbar) so the user lands on a
 * focused error screen instead of an empty sidebar with a 404 message.
 */
export function NotFoundPage() {
  return (
    <Flex
      data-archetype="centered-card"
      bg="var(--mantine-color-body)"
      align="center"
      justify="center"
      px="md"
      mih="100svh"
    >
      <Box data-panel="not-found" pos="relative" w="100%" maw={448} ta="center">
        {/* Decorative halo. A blurred disc of the accent, not a token surface —
            it has no content and no edge, so it is drawn rather than composed. */}
        <Box
          aria-hidden
          pos="absolute"
          top="50%"
          left="50%"
          w={288}
          h={288}
          style={{
            zIndex: 0,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'var(--mantine-primary-color-light)',
            filter: 'blur(64px)',
          }}
        />
        <Box pos="relative">
          <ThemeIcon variant="light" size={56} radius="xl" mx="auto">
            <Compass size={28} />
          </ThemeIcon>
          <Text fz="4.5rem" fw={600} lh={1.1} mt="lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
            404
          </Text>
          <Title order={1} size="h4" mt="xs">
            Page not found
          </Title>
          <Text size="sm" c="dimmed" mt="xs">
            We couldn’t find what you were looking for. The link may be broken, or the page
            may have been moved.
          </Text>
          <Stack gap="xs" mt="lg">
            <Group gap="xs" justify="center" wrap="wrap">
              <Button component={Link} to="/" leftSection={<Home size={16} />}>
                Back to Dashboard
              </Button>
              <Button
                component={Link}
                to="/projects"
                variant="default"
                leftSection={<Search size={16} />}
              >
                Browse Projects
              </Button>
            </Group>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              mt="xs"
              leftSection={<ArrowLeft size={14} />}
              onClick={() => history.back()}
            >
              Go back
            </Button>
          </Stack>
        </Box>
      </Box>
    </Flex>
  );
}
