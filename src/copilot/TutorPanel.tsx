import { ActionIcon, Badge, Box, Group, Stack, Text, Tooltip } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { Maximize2, X } from 'lucide-react';
import { TutorChat } from './TutorCopilot';
import { useTutor } from './tutorStore';

/**
 * The tutor beside whatever you are reading (⌘J). It sees the current course,
 * chapter, note and selection through `useTutor`, so "this chapter" means the
 * one on screen.
 */
export function TutorPanel() {
  const { chapterId, noteId, selection, closePanel } = useTutor();
  const scope = chapterId ? 'This chapter' : noteId ? 'This note' : 'All courses';

  return (
    <Stack gap={0} h="100%" style={{ minHeight: 0 }} data-panel="tutor">
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}
      >
        <Group gap="xs">
          <Text fw={600} size="sm">
            Tutor
          </Text>
          <Badge variant="light" size="sm">
            {scope}
          </Badge>
        </Group>
        <Group gap={4}>
          <Tooltip label="Open full tutor">
            <ActionIcon variant="subtle" component={Link} to="/tutor" aria-label="Open full tutor" onClick={closePanel}>
              <Maximize2 size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Close (⌘J)">
            <ActionIcon variant="subtle" onClick={closePanel} aria-label="Close tutor">
              <X size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      {selection && (
        <Box px="md" py="xs" bg="var(--mantine-color-default-hover)" style={{ flexShrink: 0 }}>
          <Text size="xs" c="dimmed" lineClamp={2}>
            Selected: “{selection}”
          </Text>
        </Box>
      )}
      <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TutorChat />
      </Box>
    </Stack>
  );
}
