import { Box, Group, ScrollArea, Stack } from '@mantine/core';
import classes from './notes.module.css';

/**
 * The right-hand pane: one pinned toolbar row (breadcrumb, save state, actions)
 * over the pane's single scroll region. Every state of the pane — a page, the
 * recent list, loading, missing — draws through this so the toolbar never jumps.
 */
export function NotesPane({ toolbar, children }: { toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack gap={0} h="100%" style={{ minHeight: 0 }}>
      {toolbar && (
        <Group
          className={classes.toolbar}
          justify="space-between"
          wrap="nowrap"
          gap="sm"
          px="md"
          h={44}
          style={{ flexShrink: 0 }}
        >
          {toolbar}
        </Group>
      )}
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>{children}</ScrollArea>
    </Stack>
  );
}

/**
 * The reading column: left-aligned against the tree divider, never centred, so
 * a wide pane does not open an empty band on the left. The block editor's own
 * gutter (`--blocks-gutter`, room for its + and grip) is the only inset before
 * the text; `inset` is the extra start padding, small for a page and larger for
 * content that has no gutter of its own. The measure caps the text at ~860px.
 */
export function NotesColumn({ children, inset = 'sm' }: { children: React.ReactNode; inset?: string }) {
  return (
    <Box maw={940} ps={inset} pe="xl" pt="xs" pb="xl">
      {children}
    </Box>
  );
}
