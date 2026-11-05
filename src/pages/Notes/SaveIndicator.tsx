import { Group, Loader, Text } from '@mantine/core';
import { Check, CircleAlert } from 'lucide-react';
import type { SaveState } from './useDebouncedSave';

/** Saving…, Saved, or a save error that says what to do. */
export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <Group gap={6} wrap="nowrap" aria-live="polite">
        <Loader size={12} />
        <Text size="xs" c="dimmed">
          Saving…
        </Text>
      </Group>
    );
  }
  if (state === 'error') {
    return (
      <Group gap={6} wrap="nowrap" aria-live="polite">
        <CircleAlert size={14} color="var(--mantine-color-red-6)" />
        <Text size="xs" c="red">
          Couldn’t save. Keep typing to retry
        </Text>
      </Group>
    );
  }
  return (
    <Group gap={6} wrap="nowrap" aria-live="polite">
      <Check size={14} color="var(--mantine-color-dimmed)" />
      <Text size="xs" c="dimmed">
        Saved
      </Text>
    </Group>
  );
}
