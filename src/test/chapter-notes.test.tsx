import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { ChapterPage } from '@/pages/Chapter/ChapterPage';
import { renderCourseRoutes } from './render';

// The chapter page mounts a whole block editor. Role queries and userEvent (which reads the computed
// style of every ancestor before each click) are slow over that DOM under the full parallel run, so this
// test finds elements by their labels directly and clicks with fireEvent.
const q = (selector: string) => document.querySelector<HTMLElement>(selector);
const WAIT = { timeout: 5000 };

describe('Chapter notes', () => {
  it(
    'opens a notes panel beside the chapter in place of the outline',
    async () => {
      renderCourseRoutes(ChapterPage, '/courses/c-raft/chapters/ch-1-1');
      const toggle = await waitFor(() => {
        const b = [...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(
          (el) => el.textContent?.trim() === 'Notes'
        );
        if (!b) throw new Error('no Notes button yet');
        return b;
      }, WAIT);
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(toggle);
      await waitFor(() => expect(q('aside[aria-label="Your notes"]')).not.toBeNull(), WAIT);
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      // Nothing written yet: the panel explains itself and creates no page until the first keystroke.
      expect(await screen.findByText(/Write about this chapter in your own words/, undefined, WAIT)).toBeInTheDocument();
      expect(q('[role="separator"][aria-label="Resize notes"]')).not.toBeNull();
      expect(q('nav[aria-label="On this page"]')).toBeNull();

      fireEvent.click(q('button[aria-label="Close notes"]')!);
      await waitFor(() => expect(q('aside[aria-label="Your notes"]')).toBeNull(), WAIT);
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    },
    15_000
  );
});
