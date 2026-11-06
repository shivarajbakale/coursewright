/**
 * Chapter markdown to a small block tree the reader renders with React Native components.
 *
 * markdown-it does the parsing; this file only reshapes its flat token stream into nested blocks
 * and inline runs. HTML in the markdown is never rendered (html: false), so a chapter cannot inject
 * markup into the page.
 */
import MarkdownIt, { type Token } from 'markdown-it';

export type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
  /** A hard line break inside a paragraph. */
  br?: boolean;
  /** A tutor citation, `[n]`: the number of the search hit it points at. */
  cite?: number;
};

export type Block =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { kind: 'code'; lang: string; text: string }
  /** An Inkling explainer: an ```inkling fence, drawn where it sits. */
  | { kind: 'inkling'; source: string }
  | { kind: 'quote'; keyIdea: boolean; blocks: Block[] }
  | { kind: 'table'; header: Inline[][]; rows: Inline[][][] }
  | { kind: 'rule' };

const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

/** Parse a chapter. A leading `# Title` is dropped: the screen already shows the chapter title. */
export function parseChapter(markdown: string): Block[] {
  const blocks = parseBlocks(md.parse(markdown, {}));
  if (blocks[0]?.kind === 'heading' && blocks[0].level === 1) blocks.shift();
  return blocks;
}

/** A paragraph's words, the way the tutor receives it. */
export function plainText(inlines: Inline[]): string {
  return inlines.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
}

/** A tutor reply: markdown whose `[n]` markers become citation runs (never inside code). */
export function parseReply(markdown: string): Block[] {
  return mapInlines(parseBlocks(md.parse(markdown, {})), splitCites);
}

function splitCites(runs: Inline[]): Inline[] {
  return runs.flatMap((r) => {
    if (r.code || r.br || !/\[\d+\]/.test(r.text)) return [r];
    return r.text
      .split(/(\[\d+\])/)
      .filter(Boolean)
      .map((piece) => {
        const m = /^\[(\d+)\]$/.exec(piece);
        return m ? { ...r, text: m[1], cite: Number(m[1]) } : { ...r, text: piece };
      });
  });
}

function mapInlines(blocks: Block[], f: (runs: Inline[]) => Inline[]): Block[] {
  return blocks.map((b) => {
    switch (b.kind) {
      case 'heading':
      case 'paragraph':
        return { ...b, inlines: f(b.inlines) };
      case 'list':
        return { ...b, items: b.items.map((item) => mapInlines(item, f)) };
      case 'quote':
        return { ...b, blocks: mapInlines(b.blocks, f) };
      case 'table':
        return { ...b, header: b.header.map(f), rows: b.rows.map((row) => row.map(f)) };
      default:
        return b;
    }
  });
}

/** One line of inline markdown (a quiz prompt, an answer): `code`, **bold**, *italic*, links. */
export function parseInline(text: string): Inline[] {
  const block = md.parseInline(text, {})[0];
  return inlines(block);
}

function parseBlocks(tokens: Token[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    switch (t.type) {
      case 'heading_open': {
        out.push({ kind: 'heading', level: Number(t.tag.slice(1)), inlines: inlines(tokens[i + 1]) });
        i += 3;
        break;
      }
      case 'paragraph_open': {
        out.push({ kind: 'paragraph', inlines: inlines(tokens[i + 1]) });
        i += 3;
        break;
      }
      case 'fence':
      case 'code_block': {
        const lang = t.info.trim().split(/\s+/)[0] ?? '';
        const text = t.content.replace(/\n$/, '');
        out.push(t.type === 'fence' && lang.toLowerCase() === 'inkling' ? { kind: 'inkling', source: text } : { kind: 'code', lang, text });
        i += 1;
        break;
      }
      case 'hr': {
        out.push({ kind: 'rule' });
        i += 1;
        break;
      }
      case 'blockquote_open': {
        const end = closing(tokens, i, 'blockquote_open', 'blockquote_close');
        const blocks = parseBlocks(tokens.slice(i + 1, end));
        out.push({ kind: 'quote', keyIdea: isKeyIdea(blocks), blocks });
        i = end + 1;
        break;
      }
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const ordered = t.type === 'ordered_list_open';
        const end = closing(tokens, i, t.type, ordered ? 'ordered_list_close' : 'bullet_list_close');
        const items: Block[][] = [];
        let j = i + 1;
        while (j < end) {
          if (tokens[j].type === 'list_item_open') {
            const itemEnd = closing(tokens, j, 'list_item_open', 'list_item_close');
            items.push(parseBlocks(tokens.slice(j + 1, itemEnd)));
            j = itemEnd + 1;
          } else j += 1;
        }
        out.push({ kind: 'list', ordered, start: Number(t.attrGet('start') ?? 1), items });
        i = end + 1;
        break;
      }
      case 'table_open': {
        const end = closing(tokens, i, 'table_open', 'table_close');
        out.push(table(tokens.slice(i + 1, end)));
        i = end + 1;
        break;
      }
      default:
        i += 1;
    }
  }
  return out;
}

/** Index of the token that closes the one at `start`, counting nested opens of the same type. */
function closing(tokens: Token[], start: number, open: string, close: string): number {
  let depth = 0;
  for (let k = start; k < tokens.length; k++) {
    if (tokens[k].type === open) depth += 1;
    else if (tokens[k].type === close) {
      depth -= 1;
      if (depth === 0) return k;
    }
  }
  return tokens.length;
}

/** The course format's `> **Key idea:** ...` line. */
function isKeyIdea(blocks: Block[]): boolean {
  const first = blocks[0];
  if (first?.kind !== 'paragraph') return false;
  const lead = first.inlines[0];
  return Boolean(lead?.bold && /^key idea:?$/i.test(lead.text.trim()));
}

function table(tokens: Token[]): Block {
  const header: Inline[][] = [];
  const rows: Inline[][][] = [];
  let row: Inline[][] | null = null;
  let inHead = false;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type === 'thead_open') inHead = true;
    else if (t.type === 'thead_close') inHead = false;
    else if (t.type === 'tr_open') row = [];
    else if (t.type === 'tr_close' && row) {
      if (inHead) header.push(...row);
      else rows.push(row);
      row = null;
    } else if (t.type === 'inline' && row) row.push(inlines(t));
  }
  return { kind: 'table', header, rows };
}

function inlines(token: Token | undefined): Inline[] {
  const out: Inline[] = [];
  let bold = false;
  let italic = false;
  let href: string | undefined;
  for (const c of token?.children ?? []) {
    switch (c.type) {
      case 'text':
        if (c.content) out.push({ text: c.content, bold, italic, href });
        break;
      case 'code_inline':
        out.push({ text: c.content, code: true, bold, italic, href });
        break;
      case 'strong_open':
        bold = true;
        break;
      case 'strong_close':
        bold = false;
        break;
      case 'em_open':
        italic = true;
        break;
      case 'em_close':
        italic = false;
        break;
      case 'link_open':
        href = safeHref(c.attrGet('href'));
        break;
      case 'link_close':
        href = undefined;
        break;
      case 'softbreak':
        out.push({ text: ' ', bold, italic, href });
        break;
      case 'hardbreak':
        out.push({ text: '\n', br: true });
        break;
      case 'image':
        // Lessons do not use images; show the alt text so nothing silently disappears.
        if (c.content) out.push({ text: c.content, italic: true });
        break;
      default:
        break;
    }
  }
  return merge(out);
}

/** Only web links open; anything else (javascript:, data:) renders as plain text. */
function safeHref(raw: string | null): string | undefined {
  return raw && /^https?:\/\//i.test(raw) ? raw : undefined;
}

/** Join neighbouring runs that look the same, so a paragraph renders as few text nodes as possible. */
function merge(runs: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const r of runs) {
    const prev = out[out.length - 1];
    if (prev && !prev.br && !r.br && prev.bold === r.bold && prev.italic === r.italic && prev.code === r.code && prev.href === r.href) {
      prev.text += r.text;
    } else out.push({ ...r });
  }
  return out;
}
