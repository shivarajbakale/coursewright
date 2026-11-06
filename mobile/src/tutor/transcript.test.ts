import { describe, expect, it } from 'vitest';
import { parseReply } from '../markdown/parse';
import { buildTranscript, citedHits, sourcesByChapter, type LooseMessage } from './transcript';

const hitsA = [
  { n: 1, title: 'Reasoning block: the working-out', chapterId: 'c25', courseId: 'k', text: '…' },
  { n: 2, title: 'Model adapter: one interface', chapterId: 'c24', courseId: 'k', text: '…' },
];
const hitsB = [{ n: 1, title: 'Stream chunk: one piece', chapterId: 'c22', courseId: 'k', text: '…' }];

const call = (id: string, name: string, args: object) => ({ id, function: { name, arguments: JSON.stringify(args) } });

const messages: LooseMessage[] = [
  { id: 'u1', role: 'user', content: 'What is the margin?' },
  { id: 'a1', role: 'assistant', content: '', toolCalls: [call('t1', 'search_course', { query: 'margin' })] },
  { id: 'r1', role: 'tool', toolCallId: 't1', content: JSON.stringify({ query: 'margin', hits: hitsA }) },
  { id: 'a2', role: 'assistant', content: 'It is rough work [1], kept apart by the adapter [2] and again [1].' },
  { id: 'u2', role: 'user', content: 'And chunks?' },
  { id: 'a3', role: 'assistant', content: null, toolCalls: [call('t2', 'search_course', { query: 'chunk' })] },
  { id: 'r2', role: 'tool', toolCallId: 't2', content: JSON.stringify({ query: 'chunk', hits: hitsB }) },
  { id: 'a4', role: 'assistant', content: 'A chunk is one piece [1].', toolCalls: [call('t3', 'make_quiz', {})] },
];

describe('buildTranscript', () => {
  it('keeps questions, replies and tool cards in order, with the paragraph each question was about', () => {
    const items = buildTranscript(messages, { u1: 'Think of a maths exam…' }, true);
    expect(items.map((i) => i.kind)).toEqual(['user', 'tool', 'reply', 'user', 'tool', 'reply', 'tool']);
    expect(items[0]).toMatchObject({ kind: 'user', about: 'Think of a maths exam…' });
    expect(items[1]).toMatchObject({ kind: 'tool', pending: false, card: { kind: 'search', query: 'margin' } });
    expect(items[6]).toMatchObject({ kind: 'tool', pending: true, card: { kind: 'quiz', questions: null } });
  });

  it('points each reply at the most recent search before it', () => {
    const items = buildTranscript(messages, {}, false);
    const replies = items.filter((i) => i.kind === 'reply');
    expect(replies[0].kind === 'reply' && replies[0].hits.map((h) => h.chapterId)).toEqual(['c25', 'c24']);
    expect(replies[1].kind === 'reply' && replies[1].hits.map((h) => h.chapterId)).toEqual(['c22']);
    // Not running: an unanswered tool call is not shown as in progress.
    expect(items[items.length - 1]).toMatchObject({ pending: false });
  });

  it('lists the cited sources once each, in citation order', () => {
    expect(citedHits('rough work [2] and [1] and [2] and [9]', hitsA).map((h) => h.n)).toEqual([2, 1]);
  });

  it('groups passages from one chapter into one source', () => {
    const same = [...hitsA, { ...hitsA[0], n: 3 }];
    expect(sourcesByChapter(citedHits('[1] [2] [3]', same)).map((s) => [s.hit.chapterId, s.ns])).toEqual([
      ['c25', [1, 3]],
      ['c24', [2]],
    ]);
  });
});

describe('parseReply', () => {
  it('turns [n] into citation runs but leaves code alone', () => {
    const [p] = parseReply('Kept apart [1], see `arr[0]`.');
    if (p.kind !== 'paragraph') throw new Error('expected paragraph');
    expect(p.inlines.filter((r) => r.cite).map((r) => r.cite)).toEqual([1]);
    expect(p.inlines.find((r) => r.code)?.text).toBe('arr[0]');
  });
});
