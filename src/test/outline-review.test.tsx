import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { OutlineReview } from '@/pages/Generating/OutlineReview';
import type { CoursePlan, PlanOutline } from '@/api/types';
import { server } from '../mocks/node';
import { renderRoutes } from './render';

const WAIT = { timeout: 5000 };
const ch = (key: string, title: string) => ({ key, title, summary: `About ${title}`, readingMinutes: 8, conceptKeys: [] });

function outline(extra = false): PlanOutline {
  return {
    title: 'Agentic RAG', topic: 'Agentic RAG', summary: '', colour: 'cyan', icon: '', concepts: [], edges: [],
    modules: [
      { key: 'm1', title: 'Foundations', summary: '', projectKey: 'p1',
        chapters: [ch('c01', 'What a model can know'), ...(extra ? [ch('c99', 'Chunking documents')] : []), ch('c02', 'Embeddings')] },
      { key: 'm2', title: 'Agents', summary: '', projectKey: 'p2', chapters: [ch('c03', 'The agent loop')] },
    ],
  };
}

function plan(o: PlanOutline, messages: CoursePlan['messages'] = []): CoursePlan {
  return { courseId: 'c1', status: 'planning', outline: o, messages, estimate: { tokens: 120_000 }, approvedAt: null };
}

function mount() {
  const calls: string[] = [];
  let current = plan(outline());
  server.use(
    http.get('/api/courses/c1/plan', () => HttpResponse.json({ data: current })),
    http.post('/api/courses/c1/plan/chat', async ({ request }) => {
      const { message } = (await request.json()) as { message: string };
      calls.push(`chat:${message}`);
      if (message === 'fail') return HttpResponse.json({ message: 'The change couldn’t be made' }, { status: 502 });
      const at = new Date().toISOString();
      current = plan(outline(true), [
        { role: 'user', text: message, at },
        { role: 'agent', text: 'Added 1.2 Chunking documents, 4 chapters now.', at, changed: ['c99'] },
      ]);
      return HttpResponse.json({ data: { ...current, reply: 'Added', changed: ['c99'] } });
    }),
    http.post('/api/courses/c1/plan/remove', async ({ request }) => {
      const { chapterKey } = (await request.json()) as { chapterKey: string };
      calls.push(`remove:${chapterKey}`);
      const o = outline();
      o.modules[0].chapters = o.modules[0].chapters.filter((c) => c.key !== chapterKey);
      current = plan(o);
      return HttpResponse.json({ data: current });
    }),
    http.post('/api/courses/c1/plan/approve', () => {
      calls.push('approve');
      return HttpResponse.json({ data: { course: { id: 'c1', status: 'building', outlineReady: false }, jobId: 'j2' } });
    })
  );
  renderRoutes(() => <OutlineReview courseId="c1" />, { paths: ['/'], initialEntries: ['/'] });
  return calls;
}

const rows = () => [...document.querySelectorAll('[data-chapter-key]')].map((el) => el.getAttribute('data-chapter-key'));

describe('Outline review', () => {
  it('shows the outline with numbers and an estimate, and removes a chapter in one click', async () => {
    const calls = mount();
    expect(await screen.findByText('What a model can know', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByText(/2 modules · 3 chapters · about 120k tokens to write/)).toBeInTheDocument();
    // The only chapter of a module can't be removed.
    expect(screen.getByRole('button', { name: 'Remove 2.1 The agent loop' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove 1.2 Embeddings' }));
    await waitFor(() => expect(rows()).toEqual(['c01', 'c03']), WAIT);
    expect(calls).toEqual(['remove:c02']);
  });

  it('changes the outline by asking, marks what changed, and keeps it on a failed turn', async () => {
    const calls = mount();
    const box = await screen.findByRole('textbox', { name: 'Ask for a change to the outline' }, WAIT);

    fireEvent.change(box, { target: { value: 'fail' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByText('That change didn’t go through', undefined, WAIT)).toBeInTheDocument();
    expect(rows()).toEqual(['c01', 'c02', 'c03']);

    fireEvent.change(box, { target: { value: 'add a chapter on chunking before 1.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(rows()).toEqual(['c01', 'c99', 'c02', 'c03']), WAIT);
    expect(document.querySelector('[data-chapter-key="c99"]')).toHaveAttribute('data-changed', 'true');
    expect(screen.getByText('Added 1.2 Chunking documents, 4 chapters now.')).toBeInTheDocument();
    expect(screen.queryByText('That change didn’t go through')).toBeNull();
    expect(calls).toEqual(['chat:fail', 'chat:add a chapter on chunking before 1.2']);
  });

  it('starts writing from the agreed outline', async () => {
    const calls = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Write this course' }, WAIT));
    await waitFor(() => expect(calls).toEqual(['approve']), WAIT);
  });
});
