import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChapterPage } from '@/pages/Chapter/ChapterPage';
import { renderCourseRoutes } from './render';

describe('Chapter notes', () => {
  it('opens a notes panel beside the chapter in place of the outline', async () => {
    renderCourseRoutes(ChapterPage, '/courses/c-raft/chapters/ch-1-1');
    const toggle = await screen.findByRole('button', { name: 'Notes' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    const panel = await screen.findByRole('complementary', { name: 'Your notes' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Nothing written yet: the panel explains itself and creates no page until the first keystroke.
    expect(await screen.findByText(/Write about this chapter in your own words/)).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Resize notes' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close notes' }));
    expect(panel).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});
