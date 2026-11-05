/**
 * Coursewright's blocks for kit's block editor (@shivarajbakale/blocks):
 *
 * - **flow**: a Flowmovie movie or a Mermaid diagram (slash menu "Diagram"),
 *   markdown as a ```flow / ```mermaid fence.
 * - **quizCard**: a question with options (slash menu "Quiz card"), markdown
 *   as a ```quiz fence of JSON.
 * - **chapter mentions**: "@" finds chapters across the user's courses;
 *   markdown as `[3.2 Leader election](/courses/<id>/chapters/<id>)`, and any
 *   such link reads back as a mention. Clicking one opens the chapter.
 *
 * Both blocks are kit *widgets* (React drawn into the page through portals, so
 * Mantine's theme and the app's context reach them). Kit's widget block writes
 * markdown as an HTML comment; this module brings its own `widgets` extension
 * (same block, same node view) whose markdown is the fences above, which is
 * why the editor needs both the `extensions` and the `widgets` returned here.
 * Spread `coursewrightEditorOptions(…)` / `readOnlyEditorOptions(…)` into
 * `useBlockEditor` and both are given.
 *
 * Pure .ts (React through createElement) so the module exports no components
 * of its own and fast refresh stays happy.
 */
import { createElement } from 'react';
import {
  basicBlocks,
  defaultExtensions,
  defineExtension,
  defineWidget,
  escapeHtml,
  insertWidget,
  readWidget,
  widget,
  widgetMarkdown,
  type Block,
  type BlockEditorOptions,
  type BlockTypeSpec,
  type Extension,
  type InlineTypeSpec,
  type MarkdownBlockRule,
  type WidgetApi,
  type WidgetOptions,
} from '@shivarajbakale/blocks';
import { ListChecks, Workflow } from 'lucide-react';
import { DiagramWidget } from './DiagramWidget';
import { QuizCardWidget } from './QuizCardWidget';
import {
  EMPTY_QUIZ,
  SAMPLE_MERMAID,
  chapterLabel,
  chapterUrl,
  diagramMarkdown,
  isDiagramKind,
  parseChapterUrl,
  quizMarkdown,
  searchChapters,
  toDiagramProps,
  toQuizProps,
  type ChapterOption,
  type DiagramProps,
  type QuizCardProps,
} from './model';

/** Widget kind names, kept in every block: keep them stable. */
export const FLOW_KIND = 'flow';
export const QUIZ_KIND = 'quizCard';

export interface ChapterLink {
  courseId: string;
  chapterId: string;
  url: string;
}

export interface CoursewrightBlockOptions {
  /**
   * The chapters "@" can mention. A getter, because the editor is built once
   * and the courses arrive later; it is read on every keystroke after "@".
   */
  chapters?: () => ChapterOption[];
  /** Opens a chapter when its mention is clicked; `window.location.assign(url)` when left out. */
  onOpenChapter?: (link: ChapterLink) => void;
}

type EditorOptionsPart = Pick<BlockEditorOptions, 'extensions' | 'widgets' | 'mentions'>;

// ── Widgets: what each kind draws ────────────────────────────────────────────

const flowWidget = defineWidget<DiagramProps>({
  label: 'Diagram',
  icon: createElement(Workflow, { size: 18 }),
  keywords: ['mermaid', 'flow', 'flowmovie', 'chart', 'diagram', 'sequence'],
  description: 'A Mermaid diagram or a Flowmovie movie',
  group: 'Coursewright',
  create: () => ({ kind: 'mermaid', source: SAMPLE_MERMAID, editing: true }),
  render: (props, api) =>
    createElement(DiagramWidget, { props: toDiagramProps(props as unknown as Record<string, unknown>), api }),
  toHtml: (props) => {
    const d = toDiagramProps(props as unknown as Record<string, unknown>);
    return `<pre><code class="language-${d.kind}">${escapeHtml(d.source)}</code></pre>`;
  },
});

const quizWidget = defineWidget<QuizCardProps>({
  label: 'Quiz card',
  icon: createElement(ListChecks, { size: 18 }),
  keywords: ['quiz', 'question', 'test', 'multiple choice', 'card'],
  description: 'A question with options and an explanation',
  group: 'Coursewright',
  create: () => ({ ...EMPTY_QUIZ, editing: true }),
  render: (props, api) =>
    createElement(QuizCardWidget, {
      props: toQuizProps(props) ?? EMPTY_QUIZ,
      api: api as WidgetApi<QuizCardProps>,
    }),
  toHtml: (props) => {
    const q = toQuizProps(props) ?? EMPTY_QUIZ;
    const items = q.options
      .map((o, i) => `<li>${escapeHtml(o)}${i === q.answer ? ' ✓' : ''}</li>`)
      .join('');
    const why = q.explanation ? `<p>${escapeHtml(q.explanation)}</p>` : '';
    return `<p><strong>${escapeHtml(q.prompt)}</strong></p><ol>${items}</ol>${why}`;
  },
});

/** The widget kinds the editor draws; give them to `useBlockEditor` as `widgets`. */
export function coursewrightWidgets(): WidgetOptions {
  return { [FLOW_KIND]: flowWidget, [QUIZ_KIND]: quizWidget };
}

// ── Markdown: fences in and out ──────────────────────────────────────────────

/** A widget block's markdown: our kinds as fences, anything else as kit's HTML comment. */
export function widgetBlockMarkdown(b: Pick<Block, 'props'>): string {
  const kind = String(b.props.kind);
  const props = (b.props.props ?? {}) as Record<string, unknown>;
  if (kind === FLOW_KIND) return diagramMarkdown(toDiagramProps(props));
  if (kind === QUIZ_KIND) return quizMarkdown(toQuizProps(props) ?? EMPTY_QUIZ);
  return widgetMarkdown(kind, props);
}

/** ```mermaid / ```flow become a diagram; ```quiz with valid JSON a quiz card. Other fences stay code. */
export const readFences: MarkdownBlockRule = (tokens, i) => {
  const t = tokens[i];
  if (t.type !== 'fence') return null;
  const lang = t.info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const body = t.content.replace(/\n$/, '');
  if (isDiagramKind(lang)) {
    return { block: { type: 'widget', props: { kind: FLOW_KIND, props: { kind: lang, source: body } } }, next: i + 1 };
  }
  if (lang === 'quiz') {
    let quiz: QuizCardProps | null = null;
    try {
      quiz = toQuizProps(JSON.parse(body));
    } catch {
      return null;
    }
    if (!quiz) return null;
    return { block: { type: 'widget', props: { kind: QUIZ_KIND, props: quiz } }, next: i + 1 };
  }
  return null;
};

/**
 * Kit's widget block with Coursewright's markdown. Named `widgets` so the
 * editor uses it in place of the one its `widgets` option would add (kit adds
 * an option's extension only when the list has none of that name).
 */
function widgetsExtension(widgets: WidgetOptions): Extension {
  const block: BlockTypeSpec = {
    ...widget,
    markdown: { serialize: (b) => widgetBlockMarkdown(b) },
    html: {
      serialize: (b, ctx) => {
        const kind = widgets[String(b.props.kind)];
        const own = kind?.toHtml?.((b.props.props ?? {}) as Record<string, unknown>);
        const body = own ?? `<p class="placeholder">${escapeHtml(kind?.label ?? b.props.kind)}</p>`;
        return `<div${ctx.attrs} class="widget" data-kind="${escapeHtml(b.props.kind)}">${body}</div>`;
      },
    },
  };
  const slashActions: NonNullable<Extension['slashActions']> = Object.entries(widgets).map(([kind, w]) => ({
    title: w.label,
    group: w.group ?? 'Advanced blocks',
    keywords: w.keywords,
    description: w.description,
    icon: w.icon,
    run: (editor) => insertWidget(editor, kind),
  }));
  return defineExtension({ name: 'widgets', blocks: [block], slashActions, markdownRules: [readFences, readWidget] });
}

// ── Chapter mentions ─────────────────────────────────────────────────────────

const CHAPTER_TOKEN = 'chapter_mention';

const baseMention = (basicBlocks.inlines ?? []).find((i) => i.name === 'mention');

function openChapter(url: string, options: CoursewrightBlockOptions) {
  const ref = parseChapterUrl(url);
  if (!ref) return;
  if (options.onOpenChapter) options.onOpenChapter({ ...ref, url });
  else window.location.assign(url);
}

/**
 * Kit's own mention, with two additions: a chapter link in markdown reads back
 * as a page mention (so the mention survives a save), and a click on a chapter
 * mention opens the chapter. It replaces kit's spec of the same name.
 */
function chapterMentionInline(options: CoursewrightBlockOptions): InlineTypeSpec | null {
  if (!baseMention) return null;
  type Ctor = ReturnType<NonNullable<InlineTypeSpec['nodeView']>>;
  return {
    ...baseMention,
    markdownToken: {
      token: CHAPTER_TOKEN,
      attrs: (t) => {
        const url = t.attrGet('href') ?? '';
        return { kind: 'page', id: parseChapterUrl(url)?.chapterId ?? null, label: t.content, url, date: null };
      },
    },
    nodeView: (ctx) => {
      const base = baseMention.nodeView?.(ctx);
      const ctor: Ctor = (node, ...rest) => {
        const nv = base
          ? base(node, ...rest)
          : { dom: Object.assign(document.createElement('span'), { textContent: String(node.attrs.label ?? '') }) };
        const url = node.attrs.url as string | null;
        const dom = nv.dom as HTMLElement;
        if (node.attrs.kind === 'page' && parseChapterUrl(url)) {
          dom.dataset.chapterMention = 'true';
          dom.setAttribute('role', 'link');
          dom.setAttribute('title', 'Open chapter');
          dom.style.cursor = 'pointer';
          dom.addEventListener('click', (e) => {
            e.preventDefault();
            openChapter(url as string, options);
          });
        }
        return nv;
      };
      return ctor;
    },
  };
}

/**
 * Turns `[label](/courses/x/chapters/y)` (a link whose only content is plain
 * text) into one `chapter_mention` token, which the mention spec reads.
 */
function chapterLinksPlugin(md: Parameters<NonNullable<Extension['markdownIt']>>[0]) {
  md.core.ruler.after('inline', 'coursewright_chapter_mentions', (state) => {
    for (const block of state.tokens) {
      const kids = block.type === 'inline' ? block.children : null;
      if (!kids) continue;
      for (let i = 0; i + 2 < kids.length; i++) {
        const [open, text, close] = [kids[i], kids[i + 1], kids[i + 2]];
        if (open.type !== 'link_open' || text.type !== 'text' || close.type !== 'link_close') continue;
        const href = open.attrGet('href');
        if (!parseChapterUrl(href) || !text.content.trim()) continue;
        const token = new state.Token(CHAPTER_TOKEN, '', 0);
        token.attrSet('href', href as string);
        token.content = text.content;
        kids.splice(i, 3, token);
      }
    }
  });
}

function chapterMentionsExtension(options: CoursewrightBlockOptions): Extension {
  const inline = chapterMentionInline(options);
  return defineExtension({
    name: 'coursewright-chapter-mentions',
    inlines: inline ? [inline] : [],
    markdownIt: chapterLinksPlugin,
  });
}

/** What "@" finds: the chapters matching the query, as kit page mentions linking to the chapter. */
export function chapterMentions(options: CoursewrightBlockOptions): NonNullable<BlockEditorOptions['mentions']> {
  return {
    search: (query) =>
      searchChapters(options.chapters?.() ?? [], query).map((c) => ({
        kind: 'page' as const,
        id: c.chapterId,
        label: chapterLabel(c),
        url: chapterUrl(c.courseId, c.chapterId),
      })),
  };
}

// ── What a page gives the editor ─────────────────────────────────────────────

/**
 * The editor's whole extension list: kit's defaults, then the diagram and quiz
 * blocks and chapter mentions. Pass as `extensions`, with
 * `coursewrightWidgets()` as `widgets` (or spread `coursewrightEditorOptions`).
 */
export function coursewrightExtensions(options: CoursewrightBlockOptions = {}): Extension[] {
  return [...defaultExtensions(), widgetsExtension(coursewrightWidgets()), chapterMentionsExtension(options)];
}

/** For a read-only page (the chapter reader, MarkdownView): renders diagrams, quiz cards and chapter mentions. */
export function readOnlyExtensions(options: Pick<CoursewrightBlockOptions, 'onOpenChapter'> = {}): Extension[] {
  return coursewrightExtensions(options);
}

/** Spread into `useBlockEditor` for an editable page: extensions, widgets and the "@" chapter search. */
export function coursewrightEditorOptions(options: CoursewrightBlockOptions = {}): EditorOptionsPart {
  return { extensions: coursewrightExtensions(options), widgets: coursewrightWidgets(), mentions: chapterMentions(options) };
}

/** Spread into `useBlockEditor` for a read-only page: extensions and widgets (widgets only draw when both are given). */
export function readOnlyEditorOptions(
  options: Pick<CoursewrightBlockOptions, 'onOpenChapter'> = {}
): Pick<BlockEditorOptions, 'extensions' | 'widgets' | 'editable'> {
  return { extensions: readOnlyExtensions(options), widgets: coursewrightWidgets(), editable: false };
}
