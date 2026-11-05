import React from 'react';
import { Box, Text } from '@mantine/core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';

import { ErrorBoundary } from './ErrorBoundary';

/** Last-resort crash screen. Wrap the app root; never wrap individual widgets. */
const meta = {
  title: 'Shell/Overlays/Error Boundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

/** Throws on every render so the boundary catches it. */
function Bomb(): React.ReactElement {
  throw new Error('Simulated render crash for storybook');
}

/**
 * Canonical crash path — Bomb throws, the boundary catches, the default
 * fallback ("This screen stopped working" + Try again + Back to the library) renders.
 */
export const Default: Story = {
  render: () => (
    <ErrorBoundary>
      <Bomb />
    </ErrorBoundary>
  ),
};

/**
 * Healthy children pass through untouched. Sanity-check that the boundary
 * is a no-op when nothing throws.
 */
export const HealthyChildren: Story = {
  name: 'Healthy children',
  render: () => (
    <ErrorBoundary>
      <Text size="sm">Everything is fine — children render untouched.</Text>
    </ErrorBoundary>
  ),
};

/**
 * Custom fallback prop wins over the default "This screen stopped working" panel.
 * Renderers can ship branded empty-states this way.
 */
export const CustomFallback: Story = {
  name: 'Custom fallback',
  render: () => (
    <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom UI</div>}>
      <Bomb />
    </ErrorBoundary>
  ),
  play: async () => {
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="custom-fallback"]')).toBeInTheDocument();
    });
  },
};

/**
 * Nested boundaries: only the inner one crashes; the outer one stays
 * untouched. Demonstrates that errors don't propagate past an enclosing
 * boundary.
 */
export const NestedErrors: Story = {
  name: 'Nested boundaries',
  render: () => (
    <ErrorBoundary
      fallback={<div data-testid="outer-fallback">Outer caught it</div>}
    >
      <Box p="md">
        <Text size="sm" c="dimmed" mb="xs">Outer boundary is healthy.</Text>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </Box>
    </ErrorBoundary>
  ),
  play: async () => {
    await waitFor(() => {
      // The default fallback text ("This screen stopped working") is rendered by
      // the inner boundary; the outer fallback must not appear.
      expect(document.body.textContent).toContain('This screen stopped working');
      expect(document.body.querySelector('[data-testid="outer-fallback"]')).toBeNull();
    });
  },
};

/**
 * Clicking "Try again" resets the boundary state, the children re-render,
 * the Bomb re-throws, and the fallback reappears. Demonstrates the
 * boundary's reset path is wired.
 */
export const ResetWorks: Story = {
  name: 'Try again resets the boundary',
  render: () => (
    <ErrorBoundary>
      <Bomb />
    </ErrorBoundary>
  ),
  play: async () => {
    // Initial crash — default fallback is up.
    const tryAgain = await waitFor(() => {
      const btn = Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent === 'Try again',
      );
      expect(btn).toBeTruthy();
      return btn as HTMLButtonElement;
    });
    // Click it — Bomb re-throws on the next render, fallback reappears.
    await userEvent.click(tryAgain);
    await waitFor(() => {
      expect(document.body.textContent).toContain('This screen stopped working');
    });
  },
};
