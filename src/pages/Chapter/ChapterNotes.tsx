import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ActionIcon, Box, Group, ScrollArea, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { BlockEditorView, useBlockEditor } from '@shivarajbakale/blocks';
import { ExternalLink, X } from 'lucide-react';

import type { NotePage } from '@/api/types';
import { ResizeHandle } from '@/components/resize-handle';
import { AnchorLink } from '@/components/links';
import { ErrorState } from '@/components/state-panel';
import { useTutor } from '@/copilot/tutorStore';
import { coursewrightEditorOptions, useChapterOptions } from '@/features/blocks';
import { useChapterNote, useEnsureChapterNote } from '@/hooks/useCoursewright';
import { useResizableWidth } from '@/hooks/use-resizable-width';
import { SaveIndicator } from '@/pages/Notes/SaveIndicator';
import { useDebouncedSave } from '@/pages/Notes/useDebouncedSave';
import notesClasses from '@/pages/Notes/notes.module.css';
import classes from './chapter-notes.module.css';

/** What the chapter page can ask of the panel. */
export interface ChapterNotesHandle {
  /** Quote a passage into this chapter's notes (creating the page if needed). */
  quote: (markdown: string) => Promise<void>;
}

interface Props {
  chapterId: string;
  onClose: () => void;
}

/**
 * Notes beside a chapter: the chapter's own notes page in the same block
 * editor as the Notes page, in a resizable column next to the text. The page
 * is created on the first keystroke (opening the panel writes nothing), lives
 * under the course in Notes, and the tutor can read it.
 */
export const ChapterNotes = forwardRef<ChapterNotesHandle, Props>(function ChapterNotes({ chapterId, onClose }, ref) {
  const note = useChapterNote(chapterId);
  const ensure = useEnsureChapterNote(chapterId);
  const width = useResizableWidth({ storageKey: 'cw.chapter-notes-width', initial: 400, min: 320, max: 640 });
  // Bumped when the page changes underneath the editor (a quote was appended), so it reloads from the server.
  const [version, setVersion] = useState(0);
  const editorRef = useRef<{ flush: () => void } | null>(null);

  useImperativeHandle(ref, () => ({
    quote: async (markdown: string) => {
      editorRef.current?.flush();
      await ensure.mutateAsync(markdown);
      setVersion((v) => v + 1);
    },
  }));

  const page = note.data ?? null;

  // The tutor reads the chapter's notes while the panel is open.
  useEffect(() => {
    if (!page) return;
    useTutor.getState().setContext({ noteId: page.id });
    return () => useTutor.getState().setContext({ noteId: null });
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      component="aside"
      aria-label="Your notes"
      data-section="notes"
      pos="sticky"
      top={0}
      w={width.width}
      h="calc(100svh - 32px)"
      style={{
        flexShrink: 0,
        borderInlineStart: '1px solid var(--app-line, var(--mantine-color-default-border))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ResizeHandle label="Resize notes" edge="start" state={width} />
      {note.isPending ? (
        <Stack gap="xs" p="md">
          <Skeleton h={18} w="50%" />
          <Skeleton h={12} />
          <Skeleton h={12} w="80%" />
        </Stack>
      ) : note.isError ? (
        <>
          <PanelHeader title="Your notes" onClose={onClose} />
          <ErrorState
            size="compact"
            error={note.error}
            title="Your notes didn’t load"
            onRetry={() => note.refetch()}
            retrying={note.isRefetching}
          />
        </>
      ) : (
        <NotesEditor
          // Not keyed by page id: creating the page on the first keystroke must not rebuild the editor.
          key={version}
          page={page}
          create={() => ensure.mutateAsync(undefined)}
          onClose={onClose}
          handleRef={editorRef}
        />
      )}
    </Box>
  );
});

function PanelHeader({ title, onClose, children }: { title: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="xs"
      px="md"
      h={44}
      className={notesClasses.toolbar}
      style={{ flexShrink: 0 }}
    >
      <Text size="sm" fw={500} truncate>
        {title}
      </Text>
      <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
        {children}
        <Tooltip label="Close notes">
          <ActionIcon variant="subtle" color="gray" aria-label="Close notes" onClick={onClose}>
            <X size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}

/**
 * The editor. With no page yet it starts empty, and the first edit creates the
 * page, then saves into it; the editor is not rebuilt, so the cursor stays put.
 */
function NotesEditor({
  page,
  create,
  onClose,
  handleRef,
}: {
  page: NotePage | null;
  create: () => Promise<NotePage>;
  onClose: () => void;
  handleRef: React.MutableRefObject<{ flush: () => void } | null>;
}) {
  const navigate = useNavigate();
  const [pageId, setPageId] = useState(page?.id ?? '');
  const { schedule, state, flush } = useDebouncedSave(pageId);
  const latest = useRef<string | null>(null);
  const creating = useRef(false);
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;

  handleRef.current = { flush };

  const chapters = useChapterOptions();
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Once the page exists, anything typed while it was being created is saved into it.
  useEffect(() => {
    if (pageId && latest.current !== null) schedule({ markdown: latest.current });
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useBlockEditor(
    {
      ...coursewrightEditorOptions({
        chapters: () => chaptersRef.current,
        onOpenChapter: ({ courseId, chapterId }) =>
          navigateRef.current({ to: '/courses/$courseId/chapters/$chapterId', params: { courseId, chapterId } }),
      }),
      initial: page?.markdown ?? '',
      label: 'Your notes on this chapter',
      onChange: (e) => {
        const markdown = e.toMarkdown();
        latest.current = markdown;
        if (pageIdRef.current) {
          schedule({ markdown });
        } else if (!creating.current) {
          creating.current = true;
          void create()
            .then((p) => setPageId(p.id))
            .finally(() => (creating.current = false));
        }
      },
    },
    []
  );

  return (
    <>
      <PanelHeader title={page?.title ?? 'Your notes'} onClose={onClose}>
        {pageId && <SaveIndicator state={state} />}
        {pageId && (
          <Tooltip label="Open in Notes">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Open in Notes"
              onClick={() => navigate({ to: '/notes/$pageId', params: { pageId } })}
            >
              <ExternalLink size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </PanelHeader>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <Box px="md" pt="sm" pb="md" className={`${notesClasses.body} ${classes.body}`}>
          {!page && (
            <Text size="sm" c="dimmed" pb="xs">
              Write about this chapter in your own words. Select text in the chapter and choose Add to notes to quote
              it here. Notes live under this course in{' '}
              <AnchorLink to="/notes" size="sm">
                Notes
              </AnchorLink>
              .
            </Text>
          )}
          <BlockEditorView editor={editor} />
        </Box>
      </ScrollArea>
    </>
  );
}
