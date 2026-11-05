import * as React from 'react';
import { Box, Flex, Group, Paper, Text, type BoxProps, type PaperProps } from '@mantine/core';

/**
 * Panel — the "section card with a header band" pattern that appears 9+
 * times across the app (Settings, Billing, Team, Inbox, Dashboard, …).
 *
 * Replaces the inline `<Paper withBorder><header
 * style={{borderBottom:…}}>…</header><div>…</div></Paper>` recipe with one
 * call. Header and content can be omitted individually (e.g. for header-less
 * or borderless panels), and the `tone` prop tints the header for danger /
 * muted sections (mirrors Settings.tsx).
 *
 * Forwards extra props to the underlying Paper so callers can attach
 * `data-panel="chart"` (the ui-probe's hook) or other data-* attributes
 * without losing the Panel chrome.
 *
 * Thin molecule on top of Mantine's Paper — extending rather than duplicating.
 * New pages should reach for `<Panel>` before they hand-roll a section card.
 *
 * The borders are inline `style`, not classes: Mantine owns borders, and the
 * two danger tones are alpha over the theme's red rather than a token of their
 * own, so they follow whatever `theme.colors.red` becomes.
 */
type PanelTone = 'default' | 'muted' | 'danger';

const DANGER_BORDER = 'color-mix(in oklab, var(--mantine-color-red-6) 40%, transparent)';

export function Panel({
  title,
  description,
  actions,
  children,
  tone = 'default',
  contentProps,
  ...props
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot in the header (e.g. a "Mark all read" button). */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  tone?: PanelTone;
  /** Extra props for the content box — padding overrides, mostly. */
  contentProps?: BoxProps;
} & PaperProps) {
  const hasHeader = Boolean(title || description || actions);
  const danger = tone === 'danger';

  return (
    <Paper
      withBorder
      radius="md"
      p={0}
      {...props}
      style={{ ...(danger ? { borderColor: DANGER_BORDER } : {}), ...props.style }}
    >
      {hasHeader && (
        <Flex
          component="header"
          px="lg"
          py="md"
          direction={{ base: 'column', sm: 'row' }}
          align={{ base: 'stretch', sm: 'center' }}
          justify="space-between"
          gap={4}
          style={
            danger
              ? { background: 'color-mix(in oklab, var(--mantine-color-red-6) 4%, transparent)' }
              : undefined
          }
        >
          <Box style={{ minWidth: 0 }}>
            {title && (
              <Text size="sm" fw={600}>
                {title}
              </Text>
            )}
            {description && (
              <Text size="xs" c="dimmed" mt={2}>
                {description}
              </Text>
            )}
          </Box>
          {actions && (
            <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
              {actions}
            </Group>
          )}
        </Flex>
      )}
      {children && (
        <Box
          p="lg"
          {...contentProps}
          // Merged, not replaced. A caller passes `contentProps.style` to lay
          // the content out — a grid template, say — and a plain `style` here
          // would silently drop it after the spread, which is how the billing
          // summary's three columns became one stacked list.
          style={{
            ...(hasHeader
              ? {
                  borderTop: `1px solid ${
                    danger
                      ? 'color-mix(in oklab, var(--mantine-color-red-6) 30%, transparent)'
                      : 'var(--mantine-color-default-border)'
                  }`,
                }
              : null),
            ...(contentProps?.style as React.CSSProperties | undefined),
          }}
        >
          {children}
        </Box>
      )}
    </Paper>
  );
}
