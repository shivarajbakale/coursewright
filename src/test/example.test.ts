import { describe, it, expect } from 'vitest';

/**
 * Reference test for the Coursewright API mocks.
 *
 * Exercises the MSW handlers the app boots on (the same routes and `{ data }`
 * envelope the Python service serves, docs/plan/api-contract.md), so the
 * frontend keeps running with no backend.
 */
const api = (path: string) => `${location.origin}${path}`;
const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('Coursewright API (MSW handlers)', () => {
  it('lists courses in the { data } envelope', async () => {
    const res = await fetch(api('/api/courses'));
    const body = await res.json();
    expect(res.ok).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toMatchObject({ id: expect.any(String), status: expect.any(String) });
  });

  it('returns a course with modules, chapters and concepts', async () => {
    const body = await (await fetch(api('/api/courses/c-raft'))).json();
    expect(body.data.modules.length).toBeGreaterThan(0);
    expect(body.data.modules[0].chapters.length).toBeGreaterThan(0);
    expect(body.data.concepts.length).toBeGreaterThan(0);
  });

  it('grades a check-yourself answer', async () => {
    const ch = (await (await fetch(api('/api/chapters/ch-2-2'))).json()).data;
    const q = ch.questions[0];
    const res = (await (await fetch(api(`/api/questions/${q.id}/attempts`), json({ chosen: q.answer }))).json()).data;
    expect(res.correct).toBe(true);
  });

  it('asks interview questions one at a time, then finishes', async () => {
    const first = (await (await fetch(api('/api/interview/next'), json({ topic: 'Raft', answers: [] }))).json()).data;
    expect(first.done).toBe(false);
    expect(first.question.options.length).toBeGreaterThan(1);
    const answers = Array.from({ length: 6 }, (_, i) => ({ question: `q${i}`, answer: ['a'] }));
    const last = (await (await fetch(api('/api/interview/next'), json({ topic: 'Raft', answers }))).json()).data;
    expect(last.done).toBe(true);
  });

  it('creates, edits and deletes a note', async () => {
    const page = (await (await fetch(api('/api/notes'), json({ title: 'Scratch', markdown: 'hi' }))).json()).data;
    const patched = (
      await (
        await fetch(api(`/api/notes/${page.id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: '# changed' }),
        })
      ).json()
    ).data;
    expect(patched.markdown).toBe('# changed');
    const del = await fetch(api(`/api/notes/${page.id}`), { method: 'DELETE' });
    expect(del.ok).toBe(true);
    expect((await fetch(api(`/api/notes/${page.id}`))).status).toBe(404);
  });

  it('retrieves passages for a query', async () => {
    const hits = (await (await fetch(api('/api/search/test'), json({ query: 'leader election timeout' }))).json()).data;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chapterId).toBeTruthy();
  });
});
