import { Box, Button, Center, Flex, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Home, Search } from 'lucide-react';
import { Spot } from '@/illustrations/spots';

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
        <Box pos="relative">
          <Center>
            <Spot kind="missing" width={200} />
          </Center>
          <Text fz="3rem" fw={500} lh={1.1} mt="lg" ff="monospace" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
            404
          </Text>
          <Title order={1} size="h4" mt="xs">
            Page not found
          </Title>
          <Text size="sm" c="dimmed" mt="xs">
            Nothing lives at this address. The course, chapter or note may have been deleted.
          </Text>
          <Stack gap="xs" mt="lg">
            <Group gap="xs" justify="center" wrap="wrap">
              <Button component={Link} to="/" leftSection={<Home size={16} />}>
                Back to the library
              </Button>
              <Button component={Link} to="/notes" variant="default" leftSection={<Search size={16} />}>
                Open notes
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
