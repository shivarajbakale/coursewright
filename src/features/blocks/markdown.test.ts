import { describe, expect, it } from 'vitest';
import { BlockEditor, type Block, type InlineContent } from '@shivarajbakale/blocks';
import { FLOW_KIND, QUIZ_KIND, chapterMentions, coursewrightExtensions, coursewrightWidgets, readOnlyExtensions } from './extensions';
import { fence, parseChapterUrl, searchChapters, type ChapterOption } from './model';

const headless = (initial?: string) =>
  new BlockEditor({ initial, extensions: coursewrightExtensions(), widgets: coursewrightWidgets() });

/** markdown → the editor's blocks → markdown (no view: the headless BlockEditor). */
function roundTrip(md: string) {
  const editor = headless(md);
  const blocks = editor.getBlocks();
  const out = editor.toMarkdown();
  // And back in once more: what was written reads as the same blocks.
  const again = headless(out);
  expect(again.getBlocks().map(({ type, props, content }) => ({ type, props, content }))).toEqual(
    blocks.map(({ type, props, content }) => ({ type, props, content }))
  );
  editor.destroy();
  again.destroy();
  return { blocks, out };
}

const atoms = (b: Block) => b.content.filter((c: InlineContent) => c.type !== 'text');

describe('diagram blocks', () => {
  it('reads a ```mermaid fence as a flow widget and writes it back', () => {
    const md = '```mermaid\nflowchart LR\n  A --> B\n```';
    const { blocks, out } = roundTrip(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('widget');
    expect(blocks[0].props).toEqual({ kind: FLOW_KIND, props: { kind: 'mermaid', source: 'flowchart LR\n  A --> B' } });
    expect(out.trim()).toBe(md);
  });

  it('reads a ```flow fence as a Flowmovie diagram', () => {
    const md = '```flow\ntitle X\n\na "A"\nb "B"\na -> b\n```';
    const { blocks, out } = roundTrip(md);
    expect(blocks[0].props).toMatchObject({ kind: FLOW_KIND, props: { kind: 'flow' } });
    expect(out.trim()).toBe(md);
  });

  it('does not write the editing flag', () => {
    const editor = new BlockEditor({
      initial: [{ type: 'widget', props: { kind: FLOW_KIND, props: { kind: 'mermaid', source: 'graph TD', editing: true } } }],
      extensions: coursewrightExtensions(),
      widgets: coursewrightWidgets(),
    });
    const md = editor.toMarkdown();
    expect(md.trim()).toBe('```mermaid\ngraph TD\n```');
    editor.destroy();
  });

  it('leaves other fences as code blocks', () => {
    const { blocks, out } = roundTrip('```typescript\nconst a = 1;\n```');
    expect(blocks[0].type).toBe('code');
    expect(out.trim()).toBe('```typescript\nconst a = 1;\n```');
  });

  it('keeps text around the diagram', () => {
    const md = 'Before\n\n```mermaid\ngraph TD\n```\n\nAfter';
    const { blocks, out } = roundTrip(md);
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'widget', 'paragraph']);
    expect(out.trim()).toBe(md);
  });

  it('lengthens the fence when the source holds backticks', () => {
    expect(fence('mermaid', 'a ``` b')).toBe('````mermaid\na ``` b\n````');
    const { blocks } = roundTrip(fence('mermaid', 'a ``` b'));
    expect(blocks[0].props).toMatchObject({ props: { source: 'a ``` b' } });
  });
});

describe('quiz cards', () => {
  const quiz = { prompt: 'Who wins?', options: ['Anyone', 'A majority'], answer: 1, explanation: 'Votes need a majority.' };
  const md = `\`\`\`quiz\n${JSON.stringify(quiz, null, 2)}\n\`\`\``;

  it('reads a ```quiz fence of JSON as a quiz card and writes it back', () => {
    const { blocks, out } = roundTrip(md);
    expect(blocks[0].type).toBe('widget');
    expect(blocks[0].props).toEqual({ kind: QUIZ_KIND, props: quiz });
    expect(out.trim()).toBe(md);
  });

  it('keeps a ```quiz fence that is not valid JSON as code', () => {
    const { blocks } = roundTrip('```quiz\nnot json\n```');
    expect(blocks[0].type).toBe('code');
  });
});

describe('chapter mentions', () => {
  const link = '[3.2 Leader election](/courses/raft/chapters/ch-3-2)';

  it('reads a chapter link as a page mention and writes the same link', () => {
    const { blocks, out } = roundTrip(`See ${link} again.`);
    const [mention] = atoms(blocks[0]);
    expect(mention).toMatchObject({
      type: 'mention',
      attrs: { kind: 'page', id: 'ch-3-2', label: '3.2 Leader election', url: '/courses/raft/chapters/ch-3-2' },
    });
    expect(out.trim()).toBe(`See ${link} again.`);
  });

  it('leaves other links as links', () => {
    const { blocks, out } = roundTrip('[Docs](https://example.com)');
    expect(atoms(blocks[0])).toHaveLength(0);
    expect(out.trim()).toBe('[Docs](https://example.com)');
  });

  it('works in the read-only extension list too', () => {
    const editor = new BlockEditor({
      initial: `${link}\n\n\`\`\`mermaid\ngraph TD\n\`\`\``,
      extensions: readOnlyExtensions(),
      widgets: coursewrightWidgets(),
      editable: false,
    });
    const blocks = editor.getBlocks();
    expect(atoms(blocks[0])[0]).toMatchObject({ type: 'mention' });
    expect(blocks[1].type).toBe('widget');
    editor.destroy();
  });

  it('parses chapter urls and nothing else', () => {
    expect(parseChapterUrl('/courses/a/chapters/b')).toEqual({ courseId: 'a', chapterId: 'b' });
    expect(parseChapterUrl('/courses/a')).toBeNull();
    expect(parseChapterUrl('https://x.dev/courses/a/chapters/b')).toBeNull();
  });

  it('searches chapters by label and course', async () => {
    const chapters: ChapterOption[] = [
      { courseId: 'raft', courseTitle: 'Raft', chapterId: 'c1', number: '2.1', title: 'Leader election' },
      { courseId: 'raft', courseTitle: 'Raft', chapterId: 'c2', number: '3.1', title: 'Log replication' },
      { courseId: 'go', courseTitle: 'Go', chapterId: 'c3', number: '1.1', title: 'Goroutines' },
    ];
    expect(searchChapters(chapters, 'elect').map((c) => c.chapterId)).toEqual(['c1']);
    expect(searchChapters(chapters, 'raft').map((c) => c.chapterId)).toEqual(['c1', 'c2']);
    const found = await chapterMentions({ chapters: () => chapters }).search?.('log');
    expect(found).toEqual([{ kind: 'page', id: 'c2', label: '3.1 Log replication', url: '/courses/raft/chapters/c2' }]);
  });
});
