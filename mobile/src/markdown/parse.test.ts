import { describe, expect, it } from 'vitest';
import { parseChapter, parseInline } from './parse';

const chapter = `# Reasoning block: the model's working-out kept apart

Every request so far has sent \`thinking\`. **Bold** and *soft*
line.

## Working in the margin

\`\`\`ts
// src/types.ts
export type X = 1
\`\`\`

> **Key idea:** A reasoning block is the model's working-out.

> Just a quote.

- one
- two with [a link](https://example.com) and [a bad one](javascript:alert(1))

3. third
4. fourth

| Mode | Writes |
| --- | --- |
| read-only | none |

<script>alert(1)</script>
`;

describe('parseChapter', () => {
  const blocks = parseChapter(chapter);

  it('drops the leading title and keeps the rest in order', () => {
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'heading', 'code', 'quote', 'quote', 'list', 'list', 'table', 'paragraph']);
  });

  it('keeps inline code, bold and italic as separate runs, and joins soft breaks', () => {
    const p = blocks[0];
    if (p.kind !== 'paragraph') throw new Error('expected paragraph');
    expect(p.inlines).toEqual([
      { text: 'Every request so far has sent ', bold: false, italic: false, href: undefined },
      { text: 'thinking', code: true, bold: false, italic: false, href: undefined },
      { text: '. ', bold: false, italic: false, href: undefined },
      { text: 'Bold', bold: true, italic: false, href: undefined },
      { text: ' and ', bold: false, italic: false, href: undefined },
      { text: 'soft', bold: false, italic: true, href: undefined },
      { text: ' line.', bold: false, italic: false, href: undefined },
    ]);
  });

  it('keeps fenced code verbatim with its language', () => {
    expect(blocks[2]).toEqual({ kind: 'code', lang: 'ts', text: '// src/types.ts\nexport type X = 1' });
  });

  it('marks the Key idea quote and only that one', () => {
    expect(blocks[3]).toMatchObject({ kind: 'quote', keyIdea: true });
    expect(blocks[4]).toMatchObject({ kind: 'quote', keyIdea: false });
  });

  it('links only web addresses and keeps an ordered list start', () => {
    const list = blocks[5];
    if (list.kind !== 'list') throw new Error('expected list');
    const runs = list.items[1][0];
    if (runs.kind !== 'paragraph') throw new Error('expected paragraph');
    expect(runs.inlines.find((r) => r.text === 'a link')?.href).toBe('https://example.com');
    expect(runs.inlines.find((r) => r.text.includes('a bad one'))?.href).toBeUndefined();
    expect(blocks[6]).toMatchObject({ kind: 'list', ordered: true, start: 3 });
  });

  it('reads tables into header and rows, and renders HTML as text', () => {
    const t = blocks[7];
    if (t.kind !== 'table') throw new Error('expected table');
    expect(t.header.map((c) => c[0].text)).toEqual(['Mode', 'Writes']);
    expect(t.rows[0].map((c) => c[0].text)).toEqual(['read-only', 'none']);
    const last = blocks[8];
    expect(last.kind === 'paragraph' && last.inlines[0].text).toBe('<script>alert(1)</script>');
  });
});

describe('parseInline', () => {
  it('turns a quiz line into runs without the markdown marks', () => {
    const runs = parseInline('When does `runAgent` stop, **exactly**?');
    expect(runs.map((r) => r.text).join('')).toBe('When does runAgent stop, exactly?');
    expect(runs.find((r) => r.text === 'runAgent')?.code).toBe(true);
    expect(runs.find((r) => r.text === 'exactly')?.bold).toBe(true);
  });
});
