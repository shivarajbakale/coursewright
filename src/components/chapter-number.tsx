import { Text } from '@mantine/core';

/**
 * Coursewright's one signature detail: a chapter's position ("2.3") set small,
 * in the mono, wherever a chapter is named — the outline, the reader, tutor
 * citations. It is how a learner keeps their place across the course.
 */
export function ChapterNumber({ value }: { value: string }) {
  return (
    <Text
      component="span"
      ff="monospace"
      size="xs"
      c="dimmed"
      miw={28}
      style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
    >
      {value}
    </Text>
  );
}
