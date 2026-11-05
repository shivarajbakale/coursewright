import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Badge, Box, Button, Divider, Group, Loader, Stack, Text, Tooltip } from '@mantine/core';
import { BookOpen, Check, CircleAlert, Link2, MessageCircleQuestion } from 'lucide-react';
import { PageHeader, PageIcon } from '@shivarajbakale/ui';
import { BlockEditorView, useBlockEditor } from '@shivarajbakale/blocks';
import type { CourseSummary, NotePage } from '@/api/types';
import type { NotePatch } from '@/api/services/coursewrightService';
import { useUpdateNote } from '@/hooks/useCoursewright';
import { useTutor } from '@/copilot/tutorStore';
import { coursewrightEditorOptions, useChapterOptions } from '@/features/blocks';
import { AnchorLink } from '@/components/links';
import { parseCover, parseIcon, serializeCover, serializeIcon, timeAgo } from './noteModel';

const SAVE_DELAY = 800;

type SaveState = 'saved' | 'saving' | 'error';

/**
 * Saves patches after a pause in typing. Each field keeps its own latest value,
 * so a title edit and a body edit inside one pause go out as one PATCH. Leaving
 * the page (unmount) sends whatever is still waiting.
 */
function useDebouncedSave(id: string) {
  const update = useUpdateNote();
  const mutate = useRef(update.mutate);
  mutate.current = update.mutate;
  const pending = useRef<NotePatch>({});
  const timer = useRef<number | null>(null);
  const inFlight = useRef(0);
  const [state, setState] = useState<SaveState>('saved');

  const flush = useRef(() => {});
  flush.current = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    inFlight.current += 1;
    mutate.current(
      { id, patch },
      {
        onSuccess: () => {
          inFlight.current -= 1;
          if (!inFlight.current && !timer.current) setState('saved');
        },
        onError: () => {
          inFlight.current -= 1;
          setState('error');
        },
      }
    );
  };

  const schedule = (patch: NotePatch, immediate = false) => {
    pending.current = { ...pending.current, ...patch };
    setState('saving');
    if (timer.current) window.clearTimeout(timer.current);
    if (immediate) flush.current();
    else timer.current = window.setTimeout(() => flush.current(), SAVE_DELAY);
  };

  useEffect(() => () => flush.current(), []);

  return { schedule, state };
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <Group gap={6} wrap="nowrap" aria-live="polite">
        <Loader size={12} />
        <Text size="xs" c="dimmed">
          Saving…
        </Text>
      </Group>
    );
  }
  if (state === 'error') {
    return (
      <Group gap={6} wrap="nowrap" aria-live="polite">
        <CircleAlert size={14} color="var(--mantine-color-red-6)" />
        <Text size="xs" c="red">
          Couldn’t save. Keep typing to retry
        </Text>
      </Group>
    );
  }
  return (
    <Group gap={6} wrap="nowrap" aria-live="polite">
      <Check size={14} color="var(--mantine-color-dimmed)" />
      <Text size="xs" c="dimmed">
        Saved
      </Text>
    </Group>
  );
}

function PropertyRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Group gap="sm" wrap="nowrap" mih={32} align="center">
      <Group gap={8} w={{ base: 96, sm: 140 }} wrap="nowrap" style={{ flexShrink: 0 }}>
        {icon}
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Group>
      <Box style={{ minWidth: 0 }}>{children}</Box>
    </Group>
  );
}

/**
 * One note page: kit's PageHeader (title, icon, cover) over kit's block
 * editor, both saving through `useUpdateNote` after a pause. Mount it keyed by
 * the page id so a new page gets a new editor.
 */
export function NoteEditor({
  page,
  courses,
  breadcrumb,
}: {
  page: NotePage;
  courses: CourseSummary[];
  breadcrumb?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { schedule, state } = useDebouncedSave(page.id);
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState(() => parseIcon(page.icon));
  const [cover, setCover] = useState(() => parseCover(page.cover));

  // The editor is built once per page; "@" and a mention's click read these refs, so they see later data.
  const chapters = useChapterOptions();
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const editor = useBlockEditor(
    {
      ...coursewrightEditorOptions({
        chapters: () => chaptersRef.current,
        onOpenChapter: ({ courseId, chapterId }) =>
          navigateRef.current({ to: '/courses/$courseId/chapters/$chapterId', params: { courseId, chapterId } }),
      }),
      initial: page.markdown,
      label: page.title || 'Untitled',
      onChange: (e) => schedule({ markdown: e.toMarkdown() }),
    },
    [page.id]
  );

  // Tell the tutor which page is open while it is.
  useEffect(() => {
    useTutor.getState().setContext({ noteId: page.id });
    return () => useTutor.getState().setContext({ noteId: null });
  }, [page.id]);

  const course = page.courseId ? courses.find((c) => c.id === page.courseId) : undefined;

  const askTutor = () =>
    useTutor.getState().ask(`Help me with my notes page “${title || 'Untitled'}”. What am I missing or getting wrong?`, {
      noteId: page.id,
      courseId: page.courseId,
      chapterId: page.chapterId,
    });

  return (
    <Stack gap={0}>
      <Group justify="space-between" wrap="nowrap" gap="sm" px={{ base: "sm", sm: "xl" }} py="xs" mih={44}>
        <Box style={{ minWidth: 0 }}>{breadcrumb}</Box>
        <Group gap="md" wrap="nowrap" style={{ flexShrink: 0 }}>
          <SaveIndicator state={state} />
          <Text size="xs" c="dimmed" visibleFrom="md">
            Edited {timeAgo(page.updatedAt)}
          </Text>
          <Button size="xs" variant="light" leftSection={<MessageCircleQuestion size={14} />} onClick={askTutor}>
            Ask tutor about this page
          </Button>
        </Group>
      </Group>

      <PageHeader
        title={title}
        onTitleChange={(t) => {
          setTitle(t);
          schedule({ title: t });
        }}
        onTitleEnter={() => editor.focus()}
        icon={icon}
        onIconChange={(next) => {
          setIcon(next);
          schedule({ icon: serializeIcon(next) }, true);
        }}
        cover={cover}
        onCoverChange={(next) => {
          setCover(next);
          schedule({ cover: serializeCover(next) }, true);
        }}
      >
        {(course || page.chapterId) && (
          <Stack gap={0} mt="xs">
            {course && (
              <PropertyRow icon={<BookOpen size={15} color="var(--mantine-color-dimmed)" />} label="Course">
                <AnchorLink to="/courses/$courseId" params={{ courseId: course.id }} size="sm" fw={500}>
                  {course.icon} {course.title}
                </AnchorLink>
              </PropertyRow>
            )}
            {page.chapterId && page.courseId && (
              <PropertyRow icon={<Link2 size={15} color="var(--mantine-color-dimmed)" />} label="Chapter">
                <AnchorLink
                  to="/courses/$courseId/chapters/$chapterId"
                  params={{ courseId: page.courseId, chapterId: page.chapterId }}
                  size="sm"
                  fw={500}
                >
                  ↗ Open the linked chapter
                </AnchorLink>
              </PropertyRow>
            )}
          </Stack>
        )}
      </PageHeader>

      <Box px={{ base: "xs", sm: "xl" }} pb="xl">
        <BlockEditorView editor={editor} />

        <Divider my="xl" />
        <Stack gap="xs" component="section" aria-labelledby={`backlinks-${page.id}`}>
          <Group gap="xs">
            <Text id={`backlinks-${page.id}`} size="sm" fw={600}>
              Backlinks
            </Text>
            <Badge size="sm" variant="light" color="gray">
              {page.backlinks.length}
            </Badge>
          </Group>
          {page.backlinks.length === 0 ? (
            <Text size="sm" c="dimmed">
              No other page links here yet. Link to this page from another note and it shows up here.
            </Text>
          ) : (
            <Group gap="xs">
              {page.backlinks.map((b) => (
                <Tooltip key={b.id} label="Open page" openDelay={400}>
                  <Button
                    size="xs"
                    variant="default"
                    leftSection={<PageIcon icon={parseIcon(b.icon)} size={14} />}
                    onClick={() => navigate({ to: '/notes/$pageId', params: { pageId: b.id } })}
                  >
                    {b.title || 'Untitled'}
                  </Button>
                </Tooltip>
              ))}
            </Group>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
