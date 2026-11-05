import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { detectPlatform } from '@tanstack/react-hotkeys';

import { CommandPalette, openCommandPalette } from '@/components/command-palette';
import { renderRoutes } from './render';

/**
 * The ⌘K palette is built on `@mantine/spotlight`, not on a hand-rolled dialog.
 * Spotlight brings the dialog and the cursor but no ARIA at all, so these tests
 * assert the combobox pattern the palette adds on top of it: the
 * combobox/listbox roles, arrow-key traversal with exactly one selected option,
 * Enter-to-navigate, and filtering that hides non-matches.
 *
 * The chord is `Mod+K`, registered through `@tanstack/react-hotkeys`, and `Mod`
 * is Command on a Mac and Control everywhere else. So the test presses whichever
 * one this machine's platform resolves to rather than hard-coding Meta: jsdom
 * reports a non-Mac platform whatever the host is, so a hard-coded Meta would
 * pass only by accident and fail on the first CI runner.
 */
const MOD = detectPlatform() === 'mac' ? 'Meta' : 'Control';
function renderPalette() {
  return renderRoutes(() => <CommandPalette />, {
    paths: ['/', '/customers', '/settings'],
    initialEntries: ['/'],
  });
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard(`{${MOD}>}k{/${MOD}}`);
  return screen.findByRole('dialog');
}

describe('command palette', () => {
  it('opens on ⌘K as a combobox over a listbox', async () => {
    const user = userEvent.setup();
    renderPalette();

    await open(user);
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Search or jump to…');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
  });

  it('opens from the topbar event', async () => {
    renderPalette();
    // The router mounts asynchronously, so retry the dispatch until the
    // palette's window listener is registered.
    await waitFor(() => {
      act(() => openCommandPalette());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('marks exactly one option selected and moves it with the arrow keys', async () => {
    const user = userEvent.setup();
    renderPalette();
    await open(user);

    const selected = () =>
      screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true');

    expect(selected()).toHaveLength(1);
    const first = selected()[0].textContent;

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(selected()[0].textContent).not.toBe(first));
    expect(selected()).toHaveLength(1);
  });

  it('navigates on Enter and closes', async () => {
    const user = userEvent.setup();
    const { router } = renderPalette();
    await open(user);

    await user.type(screen.getByRole('combobox'), 'settings');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await user.keyboard('{Enter}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('filters on nav keywords, not just the visible title', async () => {
    const user = userEvent.setup();
    renderPalette();
    await open(user);

    // "overview" is a keyword on Dashboard; it appears in no item's label.
    await user.type(screen.getByRole('combobox'), 'overview');
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('Dashboard');
    });
  });

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    renderPalette();
    await open(user);

    await user.type(screen.getByRole('combobox'), 'zzzzz');
    expect(await screen.findByText('No results found.')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
