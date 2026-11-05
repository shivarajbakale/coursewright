/**
 * MSW handlers for every Coursewright route (docs/plan/api-contract.md), so
 * the app runs with no backend. In-memory state resets on reload.
 */
import { http, HttpResponse, delay } from 'msw';
import type {
  CourseBrief,
  CourseSummary,
  InterviewQuestion,
  JobEvent,
  NotePage,
  NoteSummary,
  SearchHit,
  Stage,
  Submission,
} from '@/api/types';
import {
  BUILDING_JOB_ID,
  NOTES,
  RAFT_ID,
  SOURCES,
  buildChapter,
  buildProject,
  buildingSummary,
  doneChapters,
  raftDetail,
  raftSummary,
} from '../data/raftCourse';

const ok = <T>(data: T, init?: ResponseInit) => HttpResponse.json({ data }, init);
const uid = () => crypto.randomUUID();

// ── state ────────────────────────────────────────────────────────────────
const notes = new Map<string, NotePage>(NOTES.map((n) => [n.id, structuredClone(n)]));
const extraCourses: CourseSummary[] = [buildingSummary()];
const jobs = new Map<string, { courseId: string; topic: string; startedAt: number; cancelled: boolean }>([
  [BUILDING_JOB_ID, { courseId: 'c-rust', topic: 'Rust ownership', startedAt: Date.now() - 20_000, cancelled: false }],
]);
const milestoneDone = new Map<string, string | null>();
const submissions = new Map<string, Submission>();

// ── interview ────────────────────────────────────────────────────────────
const INTERVIEW: InterviewQuestion[] = [
  {
    id: 'level',
    header: 'Level',
    question: 'How much do you already know about this?',
    multiSelect: false,
    options: [
      { label: 'New to it', description: 'Start from first principles, define every term.' },
      { label: 'Some exposure', description: 'I have used it but never studied how it works.', recommended: true },
      { label: 'Comfortable', description: 'Skip the basics, go deep on the hard parts.' },
    ],
  },
  {
    id: 'goal',
    header: 'Goal',
    question: 'What do you want to be able to do at the end?',
    multiSelect: false,
    options: [
      { label: 'Build something', description: 'Projects carry most of the learning.', recommended: true },
      { label: 'Pass interviews', description: 'Explanations, trade-offs and practice questions.' },
      { label: 'Understand it deeply', description: 'Theory, proofs and the original papers.' },
    ],
  },
  {
    id: 'pace',
    header: 'Pace',
    question: 'How much time can you give it each week?',
    multiSelect: false,
    options: [
      { label: '2 hours', description: 'Short chapters, one small project.' },
      { label: '4–6 hours', description: 'A chapter a day and a project per module.', recommended: true },
      { label: '10+ hours', description: 'Long chapters and bigger projects.' },
    ],
  },
  {
    id: 'style',
    header: 'Style',
    question: 'How do you like things explained?',
    multiSelect: true,
    options: [
      { label: 'Diagrams and movies', description: 'Show the process step by step.', recommended: true },
      { label: 'Worked examples', description: 'Real code and real numbers.', recommended: true },
      { label: 'Analogies', description: 'Everyday comparisons first.' },
      { label: 'Formal', description: 'Definitions, invariants and proofs.' },
    ],
  },
];

// ── build job events (simulated) ─────────────────────────────────────────
function scriptFor(topic: string): Omit<JobEvent, 'id' | 'seq' | 'at'>[] {
  const words = topic.split(/\s+/).filter(Boolean);
  const modules = ['Foundations', `How ${words[0] ?? 'it'} works`, 'The hard parts', 'Putting it together'];
  const chapters = ['The mental model', 'First example', 'Common mistakes', 'Under the hood', 'Edge cases', 'Patterns'];
  return [
    { stage: 'research', message: `Researching ${topic}`, payload: { terms: [...words, 'pitfalls', 'references', 'exercises'] } },
    { stage: 'research', message: 'Reading what learners struggle with', payload: { terms: ['misconceptions', 'prerequisites'] } },
    { stage: 'concepts', message: 'Mapping concepts and prerequisites', payload: { concepts: ['Core idea', 'Model', 'Invariants', 'Failure cases', 'Performance', 'Tooling'] } },
    { stage: 'outline', message: 'Drafting the outline', payload: { modules } },
    ...chapters.map((c, i) => ({ stage: 'chapters' as Stage, message: `Writing “${c}”`, payload: { chapter: c, done: i + 1, total: chapters.length } })),
    { stage: 'projects', message: 'Designing projects', payload: { projects: ['A tiny prototype', 'Break it on purpose', 'The real thing'] } },
    { stage: 'index', message: 'Indexing for the tutor', payload: { chunks: 184 } },
  ];
}

function sse(jobId: string, after: number) {
  const job = jobs.get(jobId);
  const encoder = new TextEncoder();
  const script = scriptFor(job?.topic ?? 'your topic');
  const stream = new ReadableStream({
    async start(controller) {
      let seq = 0;
      for (const ev of script) {
        seq++;
        if (seq <= after) continue;
        await delay(seq === 1 ? 300 : 1400);
        if (job?.cancelled) break;
        const full: JobEvent = { id: seq, seq, at: new Date().toISOString(), ...ev };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(full)}\n\n`));
      }
      if (!job?.cancelled) {
        seq++;
        const course = extraCourses.find((c) => c.jobId === jobId);
        if (course) {
          course.status = 'ready';
          course.moduleCount = 4;
          course.chapterCount = 6;
          course.projectCount = 3;
          course.jobId = null;
        }
        const done: JobEvent = { id: seq, seq, stage: 'done', message: 'Course ready', payload: { courseId: RAFT_ID }, at: new Date().toISOString() };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`));
      }
      controller.close();
    },
  });
  return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

// ── search ───────────────────────────────────────────────────────────────
function search(query: string): SearchHit[] {
  const q = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const detail = raftDetail();
  const hits: SearchHit[] = [];
  for (const m of detail.modules) {
    for (const c of m.chapters) {
      const ch = buildChapter(c.id)!;
      for (const para of ch.markdown.split(/\n\n+/)) {
        const text = para.toLowerCase();
        const score = q.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
        if (score > 0 && para.length > 40) {
          hits.push({
            chunkId: `${c.id}-${hits.length}`,
            sourceId: `s-${c.id}`,
            title: `${m.position}.${c.position} ${c.title}`,
            text: para.replace(/^#+ /, ''),
            context: `From ${m.position}.${c.position} ${c.title}, in Distributed Systems: consensus with Raft.`,
            score: score / q.length,
            courseId: RAFT_ID,
            chapterId: c.id,
            anchor: null,
          });
        }
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}

const toSummary = (n: NotePage): NoteSummary => ({
  id: n.id,
  parentId: n.parentId,
  position: n.position,
  title: n.title,
  icon: n.icon,
  courseId: n.courseId,
  chapterId: n.chapterId,
  updatedAt: n.updatedAt,
});

// ── handlers ─────────────────────────────────────────────────────────────
export const coursewrightHandlers = [
  http.get('/api/health', () => ok({ ok: true, anthropic: false, voyage: false, version: 'mock' })),

  http.post('/api/interview/next', async ({ request }) => {
    const { answers } = (await request.json()) as { topic: string; answers: unknown[] };
    await delay(500);
    const next = INTERVIEW[answers.length];
    if (next) return ok({ question: next, done: false, summary: null });
    return ok({
      question: null,
      done: true,
      summary: 'A project-led course pitched at someone with some exposure, about 4–6 hours a week, explained with diagrams and worked examples.',
    });
  }),

  http.get('/api/courses', () => ok([raftSummary(), ...extraCourses])),

  http.post('/api/courses', async ({ request }) => {
    const { brief } = (await request.json()) as { brief: CourseBrief };
    const id = uid();
    const jobId = uid();
    const course: CourseSummary = {
      id,
      title: brief.topic.charAt(0).toUpperCase() + brief.topic.slice(1),
      topic: brief.topic,
      status: 'building',
      colour: 'cyan',
      icon: '📘',
      createdAt: new Date().toISOString(),
      moduleCount: 0,
      chapterCount: 0,
      projectCount: 0,
      chaptersDone: 0,
      jobId,
      lastOpenedChapterId: null,
    };
    extraCourses.unshift(course);
    jobs.set(jobId, { courseId: id, topic: brief.topic, startedAt: Date.now(), cancelled: false });
    return ok({ course, jobId }, { status: 201 });
  }),

  http.get('/api/courses/:id', ({ params }) => {
    if (params.id === RAFT_ID) return ok(raftDetail());
    const c = extraCourses.find((x) => x.id === params.id);
    if (!c) return HttpResponse.json({ message: 'Course not found' }, { status: 404 });
    // A finished mock build shows the Raft outline under its own title.
    const detail = c.status === 'ready' ? { ...raftDetail(), ...c } : { ...raftDetail(), ...c, modules: [], concepts: [], edges: [], weakSpots: [] };
    return ok(detail);
  }),

  http.delete('/api/courses/:id', ({ params }) => {
    const i = extraCourses.findIndex((x) => x.id === params.id);
    if (i >= 0) extraCourses.splice(i, 1);
    return ok({ ok: true });
  }),

  http.get('/api/chapters/:id', ({ params }) => {
    const ch = buildChapter(String(params.id));
    if (!ch) return HttpResponse.json({ message: 'Chapter not found' }, { status: 404 });
    const finished = doneChapters.has(ch.id);
    return ok({ ...ch, finishedAt: finished ? (ch.finishedAt ?? new Date().toISOString()) : null });
  }),

  http.post('/api/chapters/:id/progress', async ({ params, request }) => {
    const { finished } = (await request.json()) as { finished: boolean };
    const id = String(params.id);
    if (finished) doneChapters.add(id);
    else doneChapters.delete(id);
    return ok({ startedAt: new Date().toISOString(), finishedAt: finished ? new Date().toISOString() : null });
  }),

  http.post('/api/questions/:id/attempts', async ({ params, request }) => {
    const { chosen } = (await request.json()) as { chosen: number };
    const [chapterId, q] = String(params.id).split(/-q(?=\d+$)/);
    const question = buildChapter(chapterId)?.questions[Number(q)];
    if (!question) return HttpResponse.json({ message: 'Question not found' }, { status: 404 });
    return ok({ correct: chosen === question.answer, answer: question.answer, explanation: question.explanation });
  }),

  http.get('/api/projects/:id', ({ params }) => {
    const p = buildProject(String(params.id));
    if (!p) return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    p.milestones = p.milestones.map((m) => (milestoneDone.has(m.id) ? { ...m, doneAt: milestoneDone.get(m.id)! } : m));
    p.submissions = [...[...submissions.values()].filter((s) => s.projectId === p.id), ...p.submissions];
    return ok(p);
  }),

  http.patch('/api/milestones/:id', async ({ params, request }) => {
    const { done } = (await request.json()) as { done: boolean };
    const id = String(params.id);
    milestoneDone.set(id, done ? new Date().toISOString() : null);
    return ok({ id, position: 0, title: '', body: '', checkCmd: '', doneAt: milestoneDone.get(id) });
  }),

  http.post('/api/projects/:id/submissions', async ({ params, request }) => {
    const body = (await request.json()) as { repoUrl: string; milestoneId?: string; focus?: string };
    const sub: Submission = {
      id: uid(),
      projectId: String(params.id),
      milestoneId: body.milestoneId ?? null,
      repoUrl: body.repoUrl,
      focus: body.focus ?? '',
      status: 'running',
      jobId: uid(),
      createdAt: new Date().toISOString(),
      findings: [],
      error: null,
    };
    submissions.set(sub.id, sub);
    setTimeout(() => {
      sub.status = 'done';
      sub.findings = [
        { kind: 'pass', title: 'Election timer is randomised', body: 'Timeouts are drawn from 150–300 ms. Good.', chapterId: 'ch-2-2' },
        { kind: 'fix', title: 'RPC sent while holding the lock', body: '`sendRequestVote` is called inside `rf.mu.Lock()`. A slow peer stalls the whole server.', chapterId: 'ch-2-3' },
      ];
    }, 4000);
    return ok(sub, { status: 201 });
  }),

  http.get('/api/submissions/:id', ({ params }) => {
    const s = submissions.get(String(params.id));
    return s ? ok(s) : HttpResponse.json({ message: 'Submission not found' }, { status: 404 });
  }),

  // Notes
  http.get('/api/notes/tree', () =>
    ok([...notes.values()].map(toSummary))
  ),
  http.get('/api/notes/recent', () =>
    ok(
      [...notes.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 8)
        .map(toSummary)
    )
  ),
  http.get('/api/notes/search', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    return ok(
      [...notes.values()]
        .filter((n) => n.title.toLowerCase().includes(q) || n.markdown.toLowerCase().includes(q))
        .map((n) => ({ id: n.id, title: n.title, icon: n.icon, snippet: n.markdown.slice(0, 120) }))
    );
  }),
  http.post('/api/notes', async ({ request }) => {
    const body = (await request.json()) as Partial<NotePage>;
    const siblings = [...notes.values()].filter((n) => n.parentId === (body.parentId ?? null));
    const page: NotePage = {
      id: uid(),
      parentId: body.parentId ?? null,
      position: siblings.length,
      title: body.title ?? '',
      icon: body.icon ?? '📄',
      cover: null,
      properties: {},
      markdown: body.markdown ?? '',
      courseId: body.courseId ?? null,
      chapterId: body.chapterId ?? null,
      updatedAt: new Date().toISOString(),
      backlinks: [],
    };
    notes.set(page.id, page);
    return ok(page, { status: 201 });
  }),
  http.get('/api/notes/:id', ({ params }) => {
    const n = notes.get(String(params.id));
    return n ? ok(n) : HttpResponse.json({ message: 'Page not found' }, { status: 404 });
  }),
  http.patch('/api/notes/:id', async ({ params, request }) => {
    const n = notes.get(String(params.id));
    if (!n) return HttpResponse.json({ message: 'Page not found' }, { status: 404 });
    Object.assign(n, (await request.json()) as Partial<NotePage>, { updatedAt: new Date().toISOString() });
    return ok(n);
  }),
  http.delete('/api/notes/:id', ({ params }) => {
    const drop = (id: string) => {
      notes.delete(id);
      [...notes.values()].filter((n) => n.parentId === id).forEach((c) => drop(c.id));
    };
    drop(String(params.id));
    return ok({ ok: true });
  }),

  // Sources
  http.get('/api/sources', () => ok(SOURCES)),
  http.get('/api/sources/stats', () =>
    ok({
      sources: SOURCES.length,
      chunks: SOURCES.reduce((s, x) => s + x.chunkCount, 0),
      courses: 1,
      embedModel: 'local-hash-1024',
      dims: 1024,
      embedder: 'local',
    })
  ),
  http.post('/api/sources', async ({ request }) => {
    const { uri } = (await request.json()) as { uri: string };
    const s = { id: uid(), kind: 'url' as const, title: uri, uri, courseId: null, status: 'pending' as const, chunkCount: 0, error: null, updatedAt: new Date().toISOString() };
    SOURCES.unshift(s);
    setTimeout(() => Object.assign(s, { status: 'indexed', chunkCount: 12 }), 3000);
    return ok(s, { status: 201 });
  }),
  http.post('/api/sources/reindex', () => ok({ jobId: uid() })),
  http.post('/api/search/test', async ({ request }) => {
    const { query } = (await request.json()) as { query: string };
    await delay(250);
    return ok(search(query));
  }),

  // Jobs
  http.get('/api/jobs/:id', ({ params }) => {
    const j = jobs.get(String(params.id));
    if (!j) return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
    const course = extraCourses.find((c) => c.id === j.courseId);
    return ok({
      id: String(params.id),
      kind: 'build_course',
      status: j.cancelled ? 'cancelled' : course?.status === 'ready' ? 'done' : 'running',
      courseId: j.courseId,
      error: null,
      createdAt: new Date(j.startedAt).toISOString(),
      usage: null,
    });
  }),
  http.post('/api/jobs/:id/cancel', ({ params }) => {
    const j = jobs.get(String(params.id));
    if (j) j.cancelled = true;
    const course = extraCourses.find((c) => c.jobId === params.id);
    if (course) course.status = 'failed';
    return ok({ id: String(params.id), kind: 'build_course', status: 'cancelled', courseId: j?.courseId ?? null, error: null, createdAt: new Date().toISOString(), usage: null });
  }),
  http.get('/api/jobs/:id/events', ({ params, request }) => {
    const after = Number(new URL(request.url).searchParams.get('after') ?? 0);
    return sse(String(params.id), after);
  }),
];
