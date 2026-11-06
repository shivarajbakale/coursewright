/**
 * Turns the tutor agent's AG-UI messages into what the reader shows: your questions, the tutor's
 * replies, and a card for each tool it used. Pure, so it is tested without a running agent.
 *
 * Citations: search_course returns numbered hits and the tutor cites them as [n]. Numbers restart
 * with every search, so a reply's [n] refers to the most recent search before it.
 */
export type Hit = { n: number; title: string; chapterId: string | null; courseId: string | null; text: string };
export type MadeQuestion = { prompt: string; options: string[]; answer: number; explanation: string };
export type MadeDiagram = { kind: 'flow' | 'mermaid'; title: string; source: string };

export type Card =
  | { kind: 'search'; query: string; hits: Hit[] | null }
  | { kind: 'flow'; diagram: MadeDiagram | null }
  | { kind: 'quiz'; questions: MadeQuestion[] | null }
  | { kind: 'other'; name: string; done: boolean };

export type Item =
  | { kind: 'user'; id: string; text: string; about: string | null }
  | { kind: 'reply'; id: string; text: string; hits: Hit[] }
  | { kind: 'tool'; id: string; pending: boolean; card: Card };

type ToolCall = { id: string; function?: { name?: string; arguments?: string } };
export type LooseMessage = { id: string; role: string; content?: unknown; toolCalls?: ToolCall[]; toolCallId?: string };

function json<T>(raw: unknown): T | null {
  if (raw && typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function text(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text) : ''))
      .join('');
  }
  return '';
}

export function buildTranscript(messages: ReadonlyArray<LooseMessage>, about: Record<string, string>, running: boolean): Item[] {
  const results = new Map<string, unknown>();
  for (const m of messages) if (m.role === 'tool' && m.toolCallId) results.set(m.toolCallId, m.content);

  const items: Item[] = [];
  let hits: Hit[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      const t = text(m.content).trim();
      if (t) items.push({ kind: 'user', id: m.id, text: t, about: about[m.id] ?? null });
      continue;
    }
    if (m.role !== 'assistant') continue;
    const t = text(m.content).trim();
    if (t) items.push({ kind: 'reply', id: m.id, text: t, hits });
    for (const call of m.toolCalls ?? []) {
      const name = call.function?.name ?? 'tool';
      const has = results.has(call.id);
      const result = results.get(call.id);
      let card: Card;
      if (name === 'search_course') {
        const found = has ? (json<{ hits?: Hit[] }>(result)?.hits ?? []) : null;
        if (found) hits = found;
        card = { kind: 'search', query: String(json<{ query?: string }>(call.function?.arguments)?.query ?? ''), hits: found };
      } else if (name === 'make_flow') {
        card = { kind: 'flow', diagram: has ? json<MadeDiagram>(result) : null };
      } else if (name === 'make_quiz') {
        card = { kind: 'quiz', questions: has ? (json<{ questions?: MadeQuestion[] }>(result)?.questions ?? []) : null };
      } else {
        card = { kind: 'other', name, done: has };
      }
      // A tool still running only counts as pending while the run is alive.
      items.push({ kind: 'tool', id: call.id, pending: !has && running, card });
    }
  }
  return items;
}

/** Cited hits grouped by chapter, so three passages from one chapter make one source with three numbers. */
export function sourcesByChapter(cited: Hit[]): { hit: Hit; ns: number[] }[] {
  const out: { hit: Hit; ns: number[] }[] = [];
  for (const h of cited) {
    if (!h.chapterId) continue;
    const same = out.find((s) => s.hit.chapterId === h.chapterId);
    if (same) same.ns.push(h.n);
    else out.push({ hit: h, ns: [h.n] });
  }
  return out;
}

/** The hits a reply actually cites, in the order first cited, each once. */
export function citedHits(reply: string, hits: Hit[]): Hit[] {
  const seen = new Set<number>();
  const out: Hit[] = [];
  for (const m of reply.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    const hit = hits.find((h) => h.n === n);
    if (hit && !seen.has(n)) {
      seen.add(n);
      out.push(hit);
    }
  }
  return out;
}
