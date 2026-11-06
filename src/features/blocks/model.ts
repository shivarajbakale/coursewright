/**
 * The data Coursewright's custom blocks keep, and how each one reads and
 * writes as markdown. Pure: no React, no editor, so the markdown round-trips
 * are unit-testable on their own.
 *
 * - A diagram is a fenced code block whose language is `mermaid`, `flow` or `inkling`.
 * - A quiz card is a fenced code block whose language is `quiz`, holding JSON.
 * - A chapter mention is a link to `/courses/<courseId>/chapters/<chapterId>`.
 */

// ── Diagrams ─────────────────────────────────────────────────────────────────

export type DiagramKind = 'flow' | 'mermaid' | 'inkling';

export interface DiagramProps {
  kind: DiagramKind;
  source: string;
  /** Only while the source editor is open; never written to markdown. */
  editing?: boolean;
}

export const SAMPLE_MERMAID = 'flowchart LR\n  A[Follower] -->|timeout| B[Candidate]\n  B -->|majority| C[Leader]';
export const SAMPLE_FLOW =
  'title A request\n\nc "Client"\ns "Server"\n\nc -> s\n\n# The client asks the server.\nnew r at c\nr -> s  "request"\n\n# The server answers.\nr -> c  "response"\nremove r\n';

export const SAMPLE_INKLING =
  'title "A request"\n\nyou: person "You"\nserver: box "Server"\n\nyou -> server : "asks"\nserver --> you : "answers"\n\nstep 1: you, server "You ask the server"\nstep 2: server "It answers"\n';

export const isDiagramKind = (v: unknown): v is DiagramKind => v === 'flow' || v === 'mermaid' || v === 'inkling';

export function toDiagramProps(raw: Record<string, unknown> | null | undefined): DiagramProps {
  return {
    kind: isDiagramKind(raw?.kind) ? raw.kind : 'mermaid',
    source: typeof raw?.source === 'string' ? raw.source : '',
    ...(raw?.editing ? { editing: true } : {}),
  };
}

// ── Quiz cards ───────────────────────────────────────────────────────────────

export interface QuizCardProps {
  prompt: string;
  options: string[];
  /** Index into `options` of the right answer. */
  answer: number;
  explanation: string;
  /** Only while the card's editor is open; never written to markdown. */
  editing?: boolean;
}

export const EMPTY_QUIZ: QuizCardProps = { prompt: '', options: ['', ''], answer: 0, explanation: '' };

/** Whatever was stored (or pasted as JSON) as a well-formed quiz card, or null when it is not one. */
export function toQuizProps(raw: unknown): QuizCardProps | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.options)) return null;
  const options = r.options.map((o) => (typeof o === 'string' ? o : String(o ?? '')));
  const answer = typeof r.answer === 'number' && Number.isInteger(r.answer) ? r.answer : 0;
  return {
    prompt: typeof r.prompt === 'string' ? r.prompt : '',
    options,
    answer: Math.max(0, Math.min(answer, Math.max(options.length - 1, 0))),
    explanation: typeof r.explanation === 'string' ? r.explanation : '',
    ...(r.editing ? { editing: true } : {}),
  };
}

/** The JSON a quiz card's fence holds: only the four fields, in a stable order. */
export function quizJson(q: QuizCardProps): string {
  const { prompt, options, answer, explanation } = q;
  return JSON.stringify({ prompt, options, answer, explanation }, null, 2);
}

// ── Fences ───────────────────────────────────────────────────────────────────

/** A fence of backticks longer than any run inside the body, so the body can't close it early. */
export function fence(language: string, body: string): string {
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}${language}\n${body.replace(/\n$/, '')}\n${ticks}`;
}

export const diagramMarkdown = (d: DiagramProps) => fence(d.kind, d.source);
export const quizMarkdown = (q: QuizCardProps) => fence('quiz', quizJson(q));

// ── Chapter mentions ─────────────────────────────────────────────────────────

/** One chapter `@` can mention: the flat list the Notes page builds from the user's courses. */
export interface ChapterOption {
  courseId: string;
  courseTitle: string;
  chapterId: string;
  /** "3.2": module number, chapter number within it. */
  number: string;
  title: string;
}

export const chapterUrl = (courseId: string, chapterId: string) =>
  `/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}`;

export const chapterLabel = (c: Pick<ChapterOption, 'number' | 'title'>) => (c.number ? `${c.number} ${c.title}` : c.title);

const CHAPTER_PATH = /^\/courses\/([^/?#]+)\/chapters\/([^/?#]+)\/?$/;

/** The course and chapter a link points at, or null when it is not a chapter link. */
export function parseChapterUrl(url: unknown): { courseId: string; chapterId: string } | null {
  if (typeof url !== 'string') return null;
  const m = CHAPTER_PATH.exec(url);
  if (!m) return null;
  try {
    return { courseId: decodeURIComponent(m[1]), chapterId: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

/** Chapters whose label or course matches what was typed after "@" (all words, any order), best first. */
export function searchChapters(chapters: ChapterOption[], query: string, limit = 8): ChapterOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return chapters.slice(0, limit);
  const scored: { c: ChapterOption; score: number }[] = [];
  for (const c of chapters) {
    const label = chapterLabel(c).toLowerCase();
    const hay = `${label} ${c.courseTitle.toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const score = label.startsWith(words[0]) ? 0 : c.title.toLowerCase().includes(words[0]) ? 1 : 2;
    scored.push({ c, score });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.c);
}
