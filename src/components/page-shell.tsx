import * as React from 'react';

import { Box, Flex, Group, ScrollArea, Stack, Text, Title, type BoxProps } from '@mantine/core';


/**
 * The layout shapes this app declares.
 *
 * The vocabulary is described in `docs/principles/screen-archetypes.md`, drawn
 * by `scripts/feature-plan.mjs`, and checked in a real browser by Module B of
 * the UI probe (`scripts/ui-probe/rules/archetype.ts`). `plan-lint`'s P5 fails
 * when those four lists disagree, so a ninth shape is a change to the
 * document first and to this union second.
 */
export type Archetype =
  | 'dashboard-grid'
  | 'list'
  | 'list-detail'
  | 'detail'
  | 'form'
  | 'settings'
  | 'sequence'
  | 'centered-card';

/**
 * Every page renders through this.
 *
 * The app shell is a fixed viewport (`App.tsx` is `h-svh overflow-hidden`), so a
 * page must never scroll as a whole. `PageShell` pins the title band and the
 * optional toolbar, and gives the body the single scroll region on screen.
 *
 * Pages that own their scroll region — a list whose rows scroll under a pinned
 * filter, for instance — pass `scroll={false}` and take responsibility for
 * scrolling inside it. Anything else is a lint failure (`scripts/ui-lint.mjs`).
 */
export function PageShell({
  title,
  breadcrumb,
  description,
  actions,
  toolbar,
  scroll = true,
  bodyProps,
  archetype,
  children,
}: {
  title: string;
  /**
   * A line above the title — in practice the way back to where this record
   * came from. A `detail` page is reached from a collection and from links
   * that skip the collection entirely, so the route up has to be on the page
   * rather than assumed from history.
   *
   * Above the `h1` and not inside it: the probe's B5 and B8 both require the
   * heading to be the subject's name alone.
   */
  breadcrumb?: React.ReactNode;
  description?: string;
  /** Right-aligned controls in the title band. */
  actions?: React.ReactNode;
  /** Secondary row beneath the title — filters, tabs, segmented controls. */
  toolbar?: React.ReactNode;
  scroll?: boolean;
  /** Extra props for the body box — padding overrides, mostly. */
  bodyProps?: BoxProps;
  /**
   * The layout shape this page promises to hold. Published to the DOM as
   * `data-archetype` so the UI probe can check the promise instead of guessing.
   */
  archetype?: Archetype;
  children: React.ReactNode;
}) {
  return (
    <Stack
      component="section"
      gap={0}
      h="100%"
      style={{ minHeight: 0 }}
      data-archetype={archetype}
    >
      <Flex
        component="header"
        direction={{ base: 'column', sm: 'row' }}
        align={{ base: 'stretch', sm: 'flex-end' }}
        justify="space-between"
        gap="sm"
        px="lg"
        pt="md"
        pb="sm"
        style={{ flexShrink: 0 }}
      >
        <Stack gap={4}>
          {breadcrumb && <Box pb={2}>{breadcrumb}</Box>}
          {/* `order={1}` keeps the document outline right — the probe waits on
              an `h1` — and the theme's h1 is Instrument's page title, the
              prototype's 25pt semibold. */}
          <Title order={1} size="h1">
            {title}
          </Title>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
        {actions && (
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            {actions}
          </Group>
        )}
      </Flex>

      {toolbar && (
        <Box px="lg" pb="sm" style={{ flexShrink: 0 }}>
          {toolbar}
        </Box>
      )}

      {scroll ? (
        <ScrollArea style={{ minHeight: 0, flex: 1 }}>
          <Box px="lg" pb="lg" {...bodyProps}>
            {children}
          </Box>
        </ScrollArea>
      ) : (
        <Box px="lg" pb="lg" style={{ minHeight: 0, flex: 1 }} {...bodyProps}>
          {children}
        </Box>
      )}
    </Stack>
  );
}
