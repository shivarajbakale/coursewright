import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Box, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { BookOpen, Link2, MessageCircleQuestion } from 'lucide-react';
import { PageHeader, PageIcon } from '@shivarajbakale/ui';
import { BlockEditorView, useBlockEditor } from '@shivarajbakale/blocks';
import type { CourseSummary, NotePage } from '@/api/types';
import { useTutor } from '@/copilot/tutorStore';
import { coursewrightEditorOptions, useChapterOptions } from '@/features/blocks';
import { AnchorLink } from '@/components/links';
import { NotesColumn, NotesPane } from './NotesPane';
import { SaveIndicator } from './SaveIndicator';
import { useDebouncedSave } from './useDebouncedSave';
import classes from './notes.module.css';
import { parseCover, parseIcon, serializeCover, serializeIcon, timeAgo } from './noteModel';

/**
 * One note page: kit's PageHeader (title, icon, cover) over kit's block
 * editor, both saving through `useUpdateNote` after a pause. Mount it keyed by
 * the page id so a new page gets a new editor.
 */
export function NoteEditor({
  page,
  courses,
  breadcrumb,
  leading,
}: {
  page: NotePage;
  courses: CourseSummary[];
  /** The page's path, ending in its live title. */
  breadcrumb?: (title: string) => React.ReactNode;
  /** Controls at the toolbar's start — the narrow-screen "Pages" button. */
  leading?: React.ReactNode;
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
    <NotesPane
      toolbar={
        <>
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            {leading}
            {breadcrumb?.(title)}
          </Group>
          <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label={`Edited ${timeAgo(page.updatedAt)}`} openDelay={400}>
              <Box>
                <SaveIndicator state={state} />
              </Box>
            </Tooltip>
            <Button size="xs" variant="default" leftSection={<MessageCircleQuestion size={14} />} onClick={askTutor}>
              Ask tutor
            </Button>
          </Group>
        </>
      }
    >
      <NotesColumn>
        <Box className={classes.header}>
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
            {(course || (page.chapterId && page.courseId)) && (
              <Group gap="xs" mt={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <BookOpen size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                {course && (
                  <AnchorLink to="/courses/$courseId" params={{ courseId: course.id }} size="sm" c="dimmed" truncate>
                    {course.title}
                  </AnchorLink>
                )}
                {page.chapterId && page.courseId && (
                  <>
                    {course && (
                      <Text size="sm" c="dimmed" aria-hidden>
                        ·
                      </Text>
                    )}
                    <AnchorLink
                      to="/courses/$courseId/chapters/$chapterId"
                      params={{ courseId: page.courseId, chapterId: page.chapterId }}
                      size="sm"
                      c="dimmed"
                      style={{ flexShrink: 0 }}
                    >
                      <Group gap={4} wrap="nowrap" component="span">
                        <Link2 size={14} />
                        Linked chapter
                      </Group>
                    </AnchorLink>
                  </>
                )}
              </Group>
            )}
          </PageHeader>
        </Box>

        <Box mt="sm" className={classes.body}>
          <BlockEditorView editor={editor} />
        </Box>

        <Stack gap={6} mt="xl" pt="md" component="section" aria-labelledby={`backlinks-${page.id}`} className={classes.backlinks}>
          <Text id={`backlinks-${page.id}`} size="sm" c="dimmed">
            {page.backlinks.length === 0
              ? 'No backlinks yet. Link to this page from another note and it shows up here.'
              : `Linked from ${page.backlinks.length} page${page.backlinks.length === 1 ? '' : 's'}`}
          </Text>
          {page.backlinks.length > 0 && (
            <Group gap="xs">
              {page.backlinks.map((b) => (
                <Button
                  key={b.id}
                  size="xs"
                  variant="default"
                  leftSection={<PageIcon icon={parseIcon(b.icon)} size={14} />}
                  onClick={() => navigate({ to: '/notes/$pageId', params: { pageId: b.id } })}
                >
                  {b.title || 'Untitled'}
                </Button>
              ))}
            </Group>
          )}
        </Stack>
      </NotesColumn>
    </NotesPane>
  );
}
