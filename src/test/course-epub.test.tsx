import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { notifications } from '@mantine/notifications';
import { Button } from '@mantine/core';

import { useDownloadCourseEpub } from '@/hooks/useCoursewright';
import { courseService } from '@/api/services/coursewrightService';
import { server } from '../mocks/node';
import { renderRoutes } from './render';

const WAIT = { timeout: 5000 };

// The hook behind the course page's "Download as EPUB" menu item. Opening that menu under jsdom takes
// ~25 s (floating menu positioning over a large page), so the item itself is checked in the browser drive.
function DownloadButton() {
  const book = useDownloadCourseEpub();
  return (
    <Button disabled={book.isPending} onClick={() => book.mutate('c-raft')}>
      {book.isPending ? 'Preparing book…' : 'Download as EPUB'}
    </Button>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Downloading a course as an EPUB book', () => {
  it('reads the file name the server gives', async () => {
    const { blob, filename } = await courseService.downloadEpub('c-raft');
    expect(filename).toBe('raft.epub');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('saves the book and says so', async () => {
    const created = vi.fn(() => 'blob:book');
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    const shown = vi.spyOn(notifications, 'show');
    renderRoutes(DownloadButton, { paths: ['/'], initialEntries: ['/'] });
    fireEvent.click(await screen.findByRole('button', { name: 'Download as EPUB' }, WAIT));
    await waitFor(() => expect(clicked).toEqual(['raft.epub']), WAIT);
    expect(created).toHaveBeenCalledTimes(1);
    expect(revoked).toHaveBeenCalledWith('blob:book');
    expect(shown).toHaveBeenCalledWith(expect.objectContaining({ message: 'Book downloaded', color: 'green' }));
  });

  it('says it could not build the book when the server refuses', async () => {
    server.use(
      http.get('/api/courses/c-raft/export.epub', () =>
        HttpResponse.json({ message: 'The course is not ready yet' }, { status: 409 }),
      ),
    );
    const shown = vi.spyOn(notifications, 'show');
    renderRoutes(DownloadButton, { paths: ['/'], initialEntries: ['/'] });
    fireEvent.click(await screen.findByRole('button', { name: 'Download as EPUB' }, WAIT));
    await waitFor(
      () =>
        expect(shown).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Could not build the book. Try again.', color: 'red' }),
        ),
      WAIT,
    );
  });
});
