import type { ReactNode } from 'react';
import { Button, Code, Group, Stack, Text, Title } from '@mantine/core';
import { RotateCw } from 'lucide-react';

import { Spot, type SpotKind } from '@/illustrations/spots';
import { errorDetail, errorKind, type ErrorKind } from '@/lib/errors';

type Size = 'page' | 'section' | 'compact';

const ART: Record<Size, number> = { page: 200, section: 168, compact: 104 };

export interface StatePanelProps {
  art: SpotKind;
  title: ReactNode;
  children?: ReactNode;
  /** Buttons, primary first. */
  actions?: ReactNode;
  /** `page` fills a screen, `section` sits in a column, `compact` fits a list or a menu. */
  size?: Size;
  /** `alert` for an error the person should hear about; omitted for an empty state. */
  role?: 'alert' | 'status';
}

/**
 * One empty or error state: a spot drawing, a title that says what happened,
 * one sentence on what to do, and the action that does it. Every list, page
 * and panel in the app uses this, so the states read as one family.
 */
export function StatePanel({ art, title, children, actions, size = 'section', role }: StatePanelProps) {
  const compact = size === 'compact';
  return (
    <Stack
      align="center"
      ta="center"
      gap={compact ? 6 : 'sm'}
      py={size === 'page' ? 64 : compact ? 'md' : 40}
      px="md"
      mx="auto"
      maw={compact ? 320 : 440}
      role={role}
      data-state-panel={art}
    >
      <Spot kind={art} width={ART[size]} />
      <Title order={size === 'page' ? 2 : 3} size={size === 'page' ? 'h3' : compact ? 'h6' : 'h4'} mt={compact ? 0 : 4}>
        {title}
      </Title>
      {children && (
        <Text size={compact ? 'xs' : 'sm'} c="dimmed" component="div">
          {children}
        </Text>
      )}
      {actions && (
        <Group gap="xs" justify="center" mt={compact ? 4 : 'xs'}>
          {actions}
        </Group>
      )}
    </Stack>
  );
}

const ERROR_ART: Record<ErrorKind, SpotKind> = { offline: 'offline', missing: 'missing', server: 'broken', other: 'broken' };

export interface ErrorStateProps {
  error: unknown;
  /** What failed to load, as a title: "Your courses didn’t load". */
  title: string;
  /** The title when the thing does not exist: "This course doesn’t exist". */
  missingTitle?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Extra ways out, after Retry. */
  actions?: ReactNode;
  size?: Size;
}

/**
 * A failed request, said plainly: whether the service is down, the thing is
 * gone, or the service broke, and the one action that helps. The server's own
 * message is kept, small, when it says more than a stock phrase.
 */
export function ErrorState({ error, title, missingTitle, onRetry, retrying, actions, size = 'section' }: ErrorStateProps) {
  const kind = errorKind(error);
  const detail = errorDetail(error);
  const advice = {
    offline: 'The Coursewright service isn’t answering. Check that it is running, then try again.',
    missing: 'It may have been deleted, or the link is out of date.',
    server: 'The service hit an error on its side. Trying again usually works.',
    other: 'Something went wrong with the request. Try again in a moment.',
  }[kind];
  const missing = kind === 'missing';
  return (
    <StatePanel
      art={ERROR_ART[kind]}
      title={missing && missingTitle ? missingTitle : title}
      size={size}
      role="alert"
      actions={
        (onRetry && !missing) || actions ? (
          <>
            {onRetry && !missing && (
              <Button
                size={size === 'compact' ? 'xs' : 'sm'}
                variant="default"
                leftSection={<RotateCw size={14} />}
                loading={retrying}
                onClick={onRetry}
              >
                Try again
              </Button>
            )}
            {actions}
          </>
        ) : undefined
      }
    >
      {advice}
      {detail && kind !== 'missing' && (
        <Code block mt="sm" ta="left" fz="xs" c="dimmed">
          {detail}
        </Code>
      )}
    </StatePanel>
  );
}
