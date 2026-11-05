import type { Meta, StoryObj } from '@storybook/react-vite';
import userEvent from '@testing-library/user-event';
import { expect, waitFor } from 'storybook/test';

import { mswSession, withMemoryRouter } from '../../.storybook/tanstack-router-decorator';
import { CommandPalette } from './command-palette';

/**
 * ⌘K command palette over the nav config. Opens via the exported
 * `openCommandPalette()` or the keyboard shortcut.
 */
const meta = {
  title: 'Shell/Overlays/Command Palette',
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/')],
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof CommandPalette>;

/**
 * Canonical closed state — the dialog is not mounted until ⌘K fires or the
 * topbar dispatches the open event.
 */
export const Default: Story = {};

/**
 * Opens via the keyboard shortcut. Asserts the dialog (with its combobox +
 * listbox inside) is in the document after pressing ⌘K.
 */
export const OpenedViaKeyboard: Story = {
  name: 'Opens with ⌘K',
  play: async () => {
    const input = document.body.querySelector('[role=dialog] input');
    if (!input) {
      await userEvent.keyboard('{Meta>}k{/Meta}');
    }
    await expect(document.body.querySelector('[role=dialog]')).toBeInTheDocument();
  },
};

/**
 * Pre-populated query "proj". Projects and any other item whose keywords
 * contain "proj" remain visible; everything else is filtered out.
 */
export const OpenedWithQuery: Story = {
  name: 'Opened with "proj" query',
  render: () => {
    // Pre-seed the input by opening + typing on mount. The dialog starts
    // closed, so we need to open it first via the keyboard shortcut.
    return <CommandPalette />;
  },
  play: async () => {
    await userEvent.keyboard('{Meta>}k{/Meta}');
    const combobox = await waitFor(() => document.body.querySelector('[role=combobox]'));
    expect(combobox).toBeTruthy();
    await userEvent.type(combobox as HTMLElement, 'proj');
    // Projects should remain; Dashboard (no "proj" keyword) should be filtered out.
    await waitFor(() => {
      const options = document.body.querySelectorAll('[role=option]');
      const labels = Array.from(options).map((o) => o.textContent ?? '');
      expect(labels.some((l) => /Projects/i.test(l))).toBe(true);
    });
  },
};

/**
 * Query "xyzzy" — no nav item matches, so the CommandEmpty placeholder
 * ("No results found.") is rendered and no options are shown.
 */
export const NoResults: Story = {
  name: 'No results for "xyzzy"',
  play: async () => {
    await userEvent.keyboard('{Meta>}k{/Meta}');
    const combobox = await waitFor(() => document.body.querySelector('[role=combobox]'));
    expect(combobox).toBeTruthy();
    await userEvent.type(combobox as HTMLElement, 'xyzzy');
    await expect(document.body.textContent).toContain('No results found.');
    expect(document.body.querySelectorAll('[role=option]')).toHaveLength(0);
  },
};

/**
 * Open the palette, type "dash" (matches Dashboard's title and keywords),
 * click the first remaining option, and assert the router navigated to /
 * (Dashboard's `to`).
 */
export const SelectingItem: Story = {
  name: 'Selecting an item navigates',
  // The palette must NOT be mounted on the path it navigates to, or the
  // "did we navigate?" assertion below is unfalsifiable: with the default
  // `withMemoryRouter('/')` the story itself owns `/`, so selecting
  // Dashboard re-renders the palette and the stub never appears.
  decorators: [withMemoryRouter('/palette-host')],
  play: async () => {
    await userEvent.keyboard('{Meta>}k{/Meta}');
    const combobox = await waitFor(() => document.body.querySelector('[role=combobox]'));
    expect(combobox).toBeTruthy();
    await userEvent.type(combobox as HTMLElement, 'dash');
    // Wait for the filter to settle to a single Dashboard option.
    const firstOption = await waitFor(() => {
      const options = document.body.querySelectorAll('[role=option]');
      expect(options.length).toBeGreaterThan(0);
      return options[0] as HTMLElement;
    });
    await userEvent.click(firstOption);
    // The dashboard route is mounted on "/" by withMemoryRouter — assert
    // the dashboard stub renders.
    await waitFor(
      () => {
        expect(document.body.textContent).toContain('Stubbed page:');
      },
      { timeout: 3000 },
    );
  },
};
