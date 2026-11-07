import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useRouterState } from '@tanstack/react-router';

import { CoursePage } from '@/pages/Course/CoursePage';
import { ExtendCourseModal } from '@/pages/Course/ExtendCourseModal';
import { OutlineReview } from '@/pages/Generating/OutlineReview';
import type { CoursePlan } from '@/api/types';
import { server } from '../mocks/node';
import { raftDetail } from '../mocks/data/raftCourse';
import { renderRoutes } from './render';

const WAIT = { timeout: 5000 };

function Page() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path.endsWith('/building') ? <p>The build page</p> : <CoursePage />;
}

const mountCourse = () =>
  renderRoutes(Page, { paths: ['/courses/$courseId', '/courses/$courseId/building'], initialEntries: ['/courses/c-raft'] });

describe('Extending a finished course', () => {
  it.each([
    ['planning', 'Planning new modules on top of this course…', 'See progress'],
    ['review', 'New modules are ready for you to review.', 'Review them'],
    ['writing', 'Writing the new modules. You can keep reading.', 'See progress'],
    ['failed', 'Extending this course stopped before it finished.', 'See what happened'],
  ])('says where an extension stands while it is %s', async (status, text, action) => {
    server.use(
      http.get('/api/courses/c-raft', () =>
        HttpResponse.json({ data: { ...raftDetail(), extension: { status, jobId: 'j', request: 'x' }, extendable: false } }),
      ),
    );
    mountCourse();
    const banner = await screen.findByRole('status', {}, WAIT);
    expect(banner).toHaveTextContent(text);
    expect(within(banner).getByRole('link', { name: action })).toHaveAttribute('href', '/courses/c-raft/building');
    fireEvent.click(screen.getByRole('button', { name: 'Course options' }));
    expect(screen.queryByRole('menuitem', { name: 'Extend this course' })).not.toBeInTheDocument();
  });

  it('asks what to add, starts planning, and goes to the build page', async () => {
    const sent: string[] = [];
    server.use(
      http.post('/api/courses/c-raft/extend', async ({ request }) => {
        sent.push(((await request.json()) as { request: string }).request);
        return HttpResponse.json({ data: { jobId: 'j-ext' } }, { status: 202 });
      }),
    );
    // The dialog on its own: opening the course page's menu under jsdom takes ~25 s (floating menu
    // positioning over a large page); the menu item is checked in the browser drive.
    function Dialog() {
      const path = useRouterState({ select: (st) => st.location.pathname });
      return path.endsWith('/building') ? <p>The build page</p> : <ExtendCourseModal courseId="c-raft" title="Raft" opened onClose={() => {}} />;
    }
    renderRoutes(Dialog, { paths: ['/courses/$courseId', '/courses/$courseId/building'], initialEntries: ['/courses/c-raft'] });
    const dialog = await screen.findByRole('dialog', { name: 'Extend this course' }, WAIT);
    const start = within(dialog).getByRole('button', { name: 'Plan new modules' });
    expect(start).toBeDisabled(); // nothing said yet
    fireEvent.change(within(dialog).getByLabelText('What should it add?'), { target: { value: 'Snapshots and log compaction' } });
    fireEvent.click(start);
    expect(await screen.findByText('The build page', {}, WAIT)).toBeInTheDocument();
    expect(sent).toEqual(['Snapshots and log compaction']);
  });
});

describe('Reviewing an extension', () => {
  it('shows the existing modules as already in the course and writes only the new ones', async () => {
    const ch = (key: string, title: string) => ({ key, title, summary: '', readingMinutes: 4, conceptKeys: [] });
    const plan: CoursePlan = {
      courseId: 'c1', status: 'ready', messages: [], estimate: { tokens: 1000 }, approvedAt: null, extensionFrom: 1,
      outline: {
        title: 'Raft', topic: 'Raft', summary: '', colour: 'teal', icon: '', concepts: [], edges: [],
        modules: [
          { key: 'm1', title: 'Foundations', summary: '', projectKey: null, chapters: [ch('c01', 'Terms'), ch('c02', 'Votes')] },
          { key: 'm2', title: 'Snapshots', summary: '', projectKey: null, chapters: [ch('c03', 'Log compaction: dropping old entries')] },
        ],
      },
    };
    server.use(http.get('/api/courses/c1/plan', () => HttpResponse.json({ data: plan })));
    renderRoutes(() => <OutlineReview courseId="c1" />, { paths: ['/'], initialEntries: ['/'] });
    expect(await screen.findByText('Foundations · 2 chapters · already in the course', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText('Terms')).not.toBeInTheDocument();
    expect(screen.getByText('Log compaction: dropping old entries')).toBeInTheDocument();
    expect(screen.getByText('1 new modules · 1 new chapters')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Write these modules/ })).toBeInTheDocument());
  });
});
