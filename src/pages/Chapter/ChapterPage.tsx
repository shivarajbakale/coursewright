import { useEffect, useRef, useState } from 'react';
import {
  Affix,
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  Radio,
  Skeleton,
  Stack,
  Text,
  Title,
  Transition,
} from '@mantine/core';
import { useNavigate, useParams } from '@tanstack/react-router';
import { readOnlyEditorOptions } from '@/features/blocks';
import readonlyClasses from '@/components/readonly-blocks.module.css';
import { BlockEditorView, useBlockEditor } from '@shivarajbakale/blocks';
import { ArrowLeft, ArrowRight, Check, CircleCheck, CircleX, Clock, MessagesSquare, NotebookPen } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { AnchorLink, ButtonLink } from '@/components/links';
import { FlowPlayer } from '@/components/diagrams/FlowPlayer';
import { MermaidDiagram } from '@/components/diagrams/MermaidDiagram';
import { useAttempt, useChapter, useChapterProgress, useCreateNote } from '@/hooks/useCoursewright';
import { useTutor } from '@/copilot/tutorStore';
import { toast } from '@/lib/notify';
import type { Chapter, Question } from '@/api/types';

/**
 * Chapter reader. The chapter renders through kit's block editor in read-only
 * mode, so chapters and notes share one renderer. Select words to add them to
 * your notes or ask the tutor about them; the tutor panel (⌘J) already knows
 * which chapter you're on.
 */
export function ChapterPage() {
  const { courseId, chapterId } = useParams({ from: '/courses/$courseId/chapters/$chapterId' });
  const chapter = useChapter(chapterId);
  const progress = useChapterProgress(chapterId, courseId);
  const setContext = useTutor((s) => s.setContext);

  useEffect(() => {
    setContext({ courseId, chapterId, noteId: null, selection: null });
    return () => setContext({ chapterId: null, selection: null });
  }, [courseId, chapterId, setContext]);

  // Opening a chapter starts it.
  const started = chapter.data?.startedAt;
  useEffect(() => {
    if (chapter.data && !started) progress.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.data?.id, started]);

  if (chapter.isPending) {
    return (
      <PageShell title="Loading chapter…">
        <Stack maw={760} gap="md">
          <Skeleton h={24} w="60%" />
          <Skeleton h={14} />
          <Skeleton h={14} />
          <Skeleton h={14} w="80%" />
        </Stack>
      </PageShell>
    );
  }
  if (chapter.isError || !chapter.data) {
    return (
      <PageShell title="Chapter">
        <Alert color="red" title="Could not load this chapter">
          {(chapter.error as { message?: string } | null)?.message ?? 'Not found.'}
        </Alert>
      </PageShell>
    );
  }

  const ch = chapter.data;
  const finished = !!ch.finishedAt;

  return (
    <PageShell
      title={ch.title}
      archetype="detail"
      breadcrumb={
        <Breadcrumbs separator="›">
          <AnchorLink to="/courses/$courseId" params={{ courseId }} size="sm" c="dimmed">
            {ch.courseTitle}
          </AnchorLink>
          <Text size="sm" c="dimmed">
            {ch.moduleTitle}
          </Text>
        </Breadcrumbs>
      }
      actions={
        <Group gap="xs">
          <Badge variant="default" leftSection={<Clock size={12} />}>
            {ch.readingMinutes} min
          </Badge>
          <Button
            variant="default"
            leftSection={<MessagesSquare size={16} />}
            onClick={() => useTutor.getState().openPanel()}
          >
            Ask tutor
          </Button>
          <Button
            variant={finished ? 'light' : 'filled'}
            leftSection={finished ? <CircleCheck size={16} /> : <Check size={16} />}
            loading={progress.isPending}
            onClick={() => progress.mutate(!finished)}
          >
            {finished ? 'Finished' : 'Mark finished'}
          </Button>
        </Group>
      }
    >
      <Reveal>
      {/* Text and its outline sit side by side, the outline right after the
          text's measure rather than pinned to the far edge of a wide screen. */}
      <Group align="flex-start" gap={48} wrap="nowrap">
      <Stack maw={820} gap="xl" pb="xl" style={{ flex: 1, minWidth: 0 }}>
        <Box component="section" data-section="reading">
          <ChapterBody key={ch.id} chapter={ch} />
        </Box>

        {ch.diagrams.length > 0 && (
          <Stack component="section" gap="md" data-section="diagrams">
            {ch.diagrams.map((d) => (
              <Card key={d.id} withBorder radius="lg" p="lg">
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>{d.title}</Text>
                  <Badge variant="light">{d.kind === 'flow' ? 'Movie' : 'Diagram'}</Badge>
                </Group>
                {d.kind === 'flow' ? (
                  <FlowPlayer source={d.source} />
                ) : d.kind === 'mermaid' ? (
                  <MermaidDiagram source={d.source} />
                ) : (
                  <Box dangerouslySetInnerHTML={{ __html: d.source }} />
                )}
              </Card>
            ))}
          </Stack>
        )}

        {ch.questions.length > 0 && (
          <Stack component="section" gap="md" data-section="check-yourself">
            <Title order={2} size="h3">
              Check yourself
            </Title>
            {ch.questions.map((q, i) => (
              <QuestionCard key={q.id} question={q} index={i + 1} chapterId={ch.id} />
            ))}
          </Stack>
        )}

        <Divider />
        <Group justify="space-between">
          {ch.prev ? (
            <ButtonLink
              variant="default"
              leftSection={<ArrowLeft size={16} />}
              to="/courses/$courseId/chapters/$chapterId"
              params={{ courseId, chapterId: ch.prev.id }}
            >
              {ch.prev.title}
            </ButtonLink>
          ) : (
            <span />
          )}
          {ch.next ? (
            <ButtonLink
              rightSection={<ArrowRight size={16} />}
              to="/courses/$courseId/chapters/$chapterId"
              params={{ courseId, chapterId: ch.next.id }}
              onClick={() => !finished && progress.mutate(true)}
            >
              {ch.next.title}
            </ButtonLink>
          ) : (
            <ButtonLink to="/courses/$courseId" params={{ courseId }} rightSection={<ArrowRight size={16} />}>
              Back to the course
            </ButtonLink>
          )}
        </Group>
      </Stack>
      <Box w={240} visibleFrom="lg" style={{ flexShrink: 0, alignSelf: 'stretch' }}>
        <OnThisPage markdown={ch.markdown} diagramTitles={ch.diagrams.map((d) => d.title)} hasQuestions={ch.questions.length > 0} />
      </Box>
      </Group>
      </Reveal>
    </PageShell>
  );
}

/**
 * "On this page": the chapter's own headings, sticky beside the text, so a
 * long chapter is navigated rather than scrolled. Clicking scrolls the heading
 * into view inside the page's scroll area.
 */
function OnThisPage({ markdown, diagramTitles, hasQuestions }: { markdown: string; diagramTitles: string[]; hasQuestions: boolean }) {
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].replace(/[*_`]/g, '').trim());
  const extra = [...diagramTitles, ...(hasQuestions ? ['Check yourself'] : [])];
  // kit's editor draws headings as `div[data-line="heading"]`, not `h2`; diagram titles and
  // "Check yourself" are Mantine text and headings outside it.
  const go = (text: string) => {
    const root = document.querySelector('main') ?? document;
    const candidates = root.querySelectorAll('[data-line="heading"], h1, h2, h3, p');
    const el = [...candidates].find((h) => h.textContent?.replace(/\s+/g, ' ').trim() === text);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  if (headings.length + extra.length < 2) return null;
  return (
    <Stack gap={2} pos="sticky" top={0} pt={4} component="nav" aria-label="On this page">
      <Text size="sm" fw={600} mb={4}>
        On this page
      </Text>
      {[...headings, ...extra].map((h) => (
        <Anchor key={h} component="button" type="button" size="sm" c="dimmed" ta="left" py={3} onClick={() => go(h)}>
          {h}
        </Anchor>
      ))}
    </Stack>
  );
}

/** A Range over the first case-insensitive match of `needle` inside one text node of `root`. */
function findText(root: HTMLElement, needle: string): Range | null {
  const want = needle.trim().toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = (node.textContent ?? '').toLowerCase().indexOf(want);
    if (at >= 0) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + want.length);
      return range;
    }
  }
  return null;
}

function ChapterBody({ chapter }: { chapter: Chapter }) {
  const navigate = useNavigate();
  // The markdown's first heading repeats the page title, which PageShell already shows.
  const editor = useBlockEditor({
    initial: chapter.markdown.replace(/^#\s+[^\n]*\n+/, ''),
    label: chapter.title,
    ...readOnlyEditorOptions({
      onOpenChapter: ({ courseId, chapterId }) =>
        void navigate({ to: '/courses/$courseId/chapters/$chapterId', params: { courseId, chapterId } }),
    }),
  });
  const [selection, setSelection] = useState('');
  const createNote = useCreateNote();
  const highlight = useTutor((st) => st.highlight);
  const bodyRef = useRef<HTMLDivElement>(null);

  // The tutor's highlight_passage: select the passage and bring it into view.
  useEffect(() => {
    if (!highlight || !bodyRef.current) return;
    const t = setTimeout(() => {
      const range = findText(bodyRef.current!, highlight);
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      useTutor.getState().setHighlight(null);
    }, 300);
    return () => clearTimeout(t);
  }, [highlight]);

  useEffect(() => {
    const onUp = () => {
      const text = window.getSelection()?.toString().trim() ?? '';
      setSelection(text.length > 3 ? text : '');
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keyup', onUp);
    };
  }, []);

  return (
    <Box data-chapter-body ref={bodyRef} className={readonlyClasses.readonly}>
      <BlockEditorView editor={editor} menus={false} />
      <Affix position={{ bottom: 24, left: '50%' }} style={{ transform: 'translateX(-50%)' }}>
        <Transition mounted={!!selection} transition="slide-up">
          {(styles) => (
            <Paper style={styles} withBorder shadow="md" radius="xl" p={6}>
              <Group gap={4} wrap="nowrap">
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<NotebookPen size={14} />}
                  loading={createNote.isPending}
                  onClick={async () => {
                    const page = await createNote.mutateAsync({
                      title: `From ${chapter.title}`,
                      icon: '',
                      markdown: `> ${selection.replace(/\n+/g, '\n> ')}\n\nFrom [${chapter.title}](/courses/${chapter.courseId}/chapters/${chapter.id})\n`,
                      courseId: chapter.courseId,
                      chapterId: chapter.id,
                    });
                    toast.success(`Saved to “${page.title}”`);
                    setSelection('');
                  }}
                >
                  Add to notes
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<MessagesSquare size={14} />}
                  onClick={() => {
                    useTutor.getState().ask(`Explain this passage from “${chapter.title}”:\n\n> ${selection}`, {
                      selection,
                    });
                    setSelection('');
                  }}
                >
                  Ask tutor
                </Button>
              </Group>
            </Paper>
          )}
        </Transition>
      </Affix>
    </Box>
  );
}

function QuestionCard({ question, index, chapterId }: { question: Question; index: number; chapterId: string }) {
  const attempt = useAttempt(chapterId);
  const [chosen, setChosen] = useState<string>(
    question.lastAttempt ? String(question.lastAttempt.chosen) : ''
  );
  const result = attempt.data ?? (question.lastAttempt ? { correct: question.lastAttempt.correct, answer: question.answer, explanation: question.explanation } : null);

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <Badge variant="light" radius="sm" style={{ flexShrink: 0 }}>
            Q{index}
          </Badge>
          <Text fw={500}>{question.prompt}</Text>
        </Group>
        <Radio.Group value={chosen} onChange={setChosen}>
          <Stack gap="xs">
            {question.options.map((o, i) => (
              <Radio.Card
                key={i}
                value={String(i)}
                radius="md"
                p="sm"
                disabled={!!result}
                data-correct={result ? i === result.answer : undefined}
                style={
                  result && i === result.answer
                    ? { borderColor: 'var(--mantine-color-green-6)' }
                    : result && String(i) === chosen && !result.correct
                      ? { borderColor: 'var(--mantine-color-red-6)' }
                      : undefined
                }
              >
                <Group wrap="nowrap" gap="sm">
                  <Radio.Indicator />
                  <Text size="sm">{o}</Text>
                </Group>
              </Radio.Card>
            ))}
          </Stack>
        </Radio.Group>
        {result ? (
          <Alert
            variant="light"
            color={result.correct ? 'green' : 'red'}
            icon={result.correct ? <CircleCheck size={16} /> : <CircleX size={16} />}
            title={result.correct ? 'Right' : 'Not quite'}
          >
            <Stack gap="xs">
              <Text size="sm">{result.explanation}</Text>
              {!result.correct && (
                <Anchor
                  size="sm"
                  component="button"
                  type="button"
                  onClick={() =>
                    useTutor
                      .getState()
                      .ask(`I got this question wrong: “${question.prompt}”. I chose “${question.options[Number(chosen)]}”. Help me see why.`)
                  }
                >
                  Talk it through with the tutor
                </Anchor>
              )}
            </Stack>
          </Alert>
        ) : (
          <Group justify="flex-end">
            <Button
              size="sm"
              disabled={chosen === ''}
              loading={attempt.isPending}
              onClick={() => attempt.mutate({ questionId: question.id, chosen: Number(chosen) })}
            >
              Check
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
