import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { LibraryPage } from '@/pages/Library/LibraryPage';
import { CoursePage } from '@/pages/Course/CoursePage';
import { renderCourseRoutes } from './render';

/**
 * The layout contract, asserted at runtime: screens render from the mock API,
 * links go to their own routes, and the page header stays outside the single
 * scroll region.
 */
describe('Library', () => {
  it('renders courses from the mock API, each a link to its own route', async () => {
    renderCourseRoutes(LibraryPage);
    const titles = await screen.findAllByText('Distributed Systems: consensus with Raft');
    const hrefs = titles.map((t) => t.closest('a')?.getAttribute('href'));
    expect(hrefs).toContain('/courses/c-raft');
  });

  it('sends a course still being built to its build screen', async () => {
    renderCourseRoutes(LibraryPage);
    const title = await screen.findByText('Rust ownership and borrowing');
    expect(title.closest('a')?.getAttribute('href')).toBe('/courses/c-rust/building');
  });

  it('keeps the page header outside the scroll region', async () => {
    renderCourseRoutes(LibraryPage);
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Library' });
    expect(h1.closest('.mantine-ScrollArea-root')).toBeNull();
  });
});

describe('Course overview', () => {
  it('opens cold from a URL and lists modules and chapters', async () => {
    renderCourseRoutes(CoursePage, '/courses/c-raft');
    expect(await screen.findByRole('heading', { level: 1, name: 'Distributed Systems: consensus with Raft' })).toBeInTheDocument();
    expect(screen.getByText('2. Leader election')).toBeInTheDocument();
    const chapter = await screen.findByText('1.1 Replicated state machines');
    expect(chapter.closest('a')?.getAttribute('href')).toBe('/courses/c-raft/chapters/ch-1-1');
  });

  it('gives a missing course a designed error state', async () => {
    renderCourseRoutes(CoursePage, '/courses/nope');
    expect(await screen.findByText('Could not load this course')).toBeInTheDocument();
  });
});
