import { useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ActionIcon,
  Box,
  Breadcrumbs,
  Button,
  Center,
  CloseButton,
  Drawer,
  Flex,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { FilePlus2, ListTree, Search } from 'lucide-react';
import { PageIcon, PageTree, type PageMove } from '@shivarajbakale/ui';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { AnchorLink, NavLinkLink } from '@/components/links';
import { ErrorState, StatePanel } from '@/components/state-panel';
import { ResizeHandle } from '@/components/resize-handle';
import { useResizableWidth } from '@/hooks/use-resizable-width';
import type { NoteSummary } from '@/api/types';
import {
  useCourses,
  useCreateNote,
  useDeleteNote,
  useNote,
  useNoteSearch,
  useNoteTree,
  useRecentNotes,
  useUpdateNote,
} from '@/hooks/useCoursewright';
import { NoteEditor } from './NoteEditor';
import { NotesColumn, NotesPane } from './NotesPane';
import classes from './notes.module.css';
import {
  ancestry,
  buildTree,
  childrenByParent,
  descendants,
  parseIcon,
  readFavourites,
  timeAgo,
  writeFavourites,
} from './noteModel';

// ── The left column: search over the notes, and the page tree ────────────────

function SearchResults({ query, onOpen }: { query: string; onOpen: (id: string) => void }) {
  const search = useNoteSearch(query);
  if (search.isLoading) {
    return (
      <Stack gap={6} p="xs">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} h={36} radius="sm" />
        ))}
      </Stack>
    );
  }
  if (search.isError) {
    return (
      <ErrorState
        size="compact"
        error={search.error}
        title="Search didn’t run"
        onRetry={() => search.refetch()}
        retrying={search.isRefetching}
      />
    );
  }
  const hits = search.data ?? [];
  if (!hits.length) {
    return (
      <StatePanel art="search" size="compact" title="No matches">
        No page mentions “{query}”.
      </StatePanel>
    );
  }
  return (
    <Stack gap={2} role="list" aria-label="Search results">
      {hits.map((h) => (
        <UnstyledButton key={h.id} role="listitem" onClick={() => onOpen(h.id)} px="xs" py={6}>
          <Group gap={8} wrap="nowrap" align="flex-start">
            <Box pt={2}>
              <PageIcon icon={parseIcon(h.icon)} size={16} />
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                {h.title || 'Untitled'}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {h.snippet.replace(/[#>*_`[\]-]/g, '').trim()}
              </Text>
            </Box>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}

function NotesSidebar({
  notes,
  loading,
  error,
  treeError,
  onRetry,
  selectedId,
  onOpen,
  onAdd,
  onRename,
  onDelete,
  onMove,
}: {
  notes: NoteSummary[];
  loading: boolean;
  error: boolean;
  /** The failed request, so the state can say whether the service is down or broke. */
  treeError?: unknown;
  onRetry: () => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onAdd: (parentId: string | null) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMove: (move: PageMove) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query.trim(), 250);
  const [favourites, setFavourites] = useState(readFavourites);
  const tree = useMemo(() => buildTree(notes), [notes]);
  // Open the path to the selected page so it is visible on arrival.
  const defaultExpanded = useMemo(
    () => (selectedId ? ancestry(notes, selectedId).map((n) => n.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, notes.length > 0]
  );
  const knownFavourites = favourites.filter((id) => notes.some((n) => n.id === id));

  const toggleFavourite = (id: string, favourite: boolean) => {
    const next = favourite ? [...favourites.filter((f) => f !== id), id] : favourites.filter((f) => f !== id);
    setFavourites(next);
    writeFavourites(next);
  };

  return (
    <Stack gap="xs" h="100%" style={{ minHeight: 0 }}>
      <TextInput
        size="xs"
        placeholder="Search notes"
        aria-label="Search notes"
        leftSection={<Search size={14} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        rightSection={query ? <CloseButton size="sm" aria-label="Clear search" onClick={() => setQuery('')} /> : null}
      />
      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        {debounced.length > 1 ? (
          <SearchResults query={debounced} onOpen={onOpen} />
        ) : loading ? (
          <Stack gap={6} p="xs">
            {[70, 85, 60, 75, 50].map((w, i) => (
              <Skeleton key={i} h={24} w={`${w}%`} radius="sm" />
            ))}
          </Stack>
        ) : error ? (
          <ErrorState size="compact" plain error={treeError} title="Pages didn’t load" onRetry={onRetry} />
        ) : (
          <PageTree
            key={selectedId ?? 'none'}
            pages={tree}
            label="Pages"
            selectedId={selectedId}
            defaultExpanded={defaultExpanded}
            onSelect={onOpen}
            onAdd={onAdd}
            onRename={onRename}
            onDelete={onDelete}
            onMove={onMove}
            favorites={knownFavourites}
            onFavoriteChange={toggleFavourite}
          />
        )}
      </ScrollArea>
    </Stack>
  );
}

// ── The right column with no page open: recent pages ─────────────────────────

function RecentPages({
  notes,
  onNew,
  creating,
  leading,
}: {
  notes: NoteSummary[];
  onNew: () => void;
  creating: boolean;
  leading?: React.ReactNode;
}) {
  const recent = useRecentNotes();
  const toolbar = (
    <Group gap="xs" wrap="nowrap">
      {leading}
      <Text size="sm">Notes</Text>
    </Group>
  );

  if (recent.isLoading) {
    return (
      <NotesPane toolbar={toolbar}>
        <NotesColumn inset="xl">
          <Stack gap="xs" pt="lg">
            <Skeleton h={20} w={140} mb="xs" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} h={36} radius="sm" />
            ))}
          </Stack>
        </NotesColumn>
      </NotesPane>
    );
  }
  if (recent.isError) {
    return (
      <NotesPane toolbar={toolbar}>
        <Center h="100%" mih={360} p="xl">
          <ErrorState
            error={recent.error}
            title="Recent pages didn’t load"
            onRetry={() => recent.refetch()}
            retrying={recent.isRefetching}
          />
        </Center>
      </NotesPane>
    );
  }
  const pages = recent.data ?? [];
  if (!pages.length) {
    return (
      <NotesPane toolbar={toolbar}>
        <Center h="100%" mih={360} p="xl">
          <StatePanel
            art="notebook"
            title="Your notebook is empty"
            actions={
              <Button leftSection={<FilePlus2 size={16} />} onClick={onNew} loading={creating}>
                Write your first page
              </Button>
            }
          >
            Write things down in your own words as you read. Pages nest inside pages, link to chapters, and the tutor
            can read them.
          </StatePanel>
        </Center>
      </NotesPane>
    );
  }

  const byId = new Map(notes.map((n) => [n.id, n]));

  return (
    <NotesPane toolbar={toolbar}>
      <NotesColumn inset="xl">
        <Stack gap="xs" pt="lg">
          <Title order={2} size="h4">
            Recently edited
          </Title>
          <Stack gap={0} component="ul" p={0} m={0} style={{ listStyle: 'none' }} aria-label="Recently edited pages">
            {pages.map((p) => {
              const parent = p.parentId ? byId.get(p.parentId) : undefined;
              return (
                <Box component="li" key={p.id}>
                  <NavLinkLink
                    to="/notes/$pageId"
                    params={{ pageId: p.id }}
                    leftSection={<PageIcon icon={parseIcon(p.icon)} size={18} />}
                    label={
                      <Group gap="xs" wrap="nowrap" justify="space-between">
                        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                          <Text size="sm" fw={500} truncate>
                            {p.title || 'Untitled'}
                          </Text>
                          {parent && (
                            <Text size="sm" c="dimmed" truncate>
                              in {parent.title || 'Untitled'}
                            </Text>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                          {timeAgo(p.updatedAt)}
                        </Text>
                      </Group>
                    }
                  />
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </NotesColumn>
    </NotesPane>
  );
}

// ── The right column with a page open ────────────────────────────────────────

function OpenPage({ pageId, notes, leading }: { pageId: string; notes: NoteSummary[]; leading?: React.ReactNode }) {
  const note = useNote(pageId);
  const courses = useCourses();
  const navigate = useNavigate();

  if (note.isLoading) {
    return (
      <NotesPane toolbar={<Skeleton h={14} w={180} />}>
        <NotesColumn inset="calc(var(--mantine-spacing-sm) + var(--blocks-gutter, 3.25rem))">
          <Stack gap="md" pt="lg">
            <Skeleton h={56} w={56} radius="md" />
            <Skeleton h={36} w="60%" />
            <Skeleton h={16} />
            <Skeleton h={16} w="90%" />
            <Skeleton h={16} w="70%" />
          </Stack>
        </NotesColumn>
      </NotesPane>
    );
  }
  if (note.isError || !note.data) {
    const missing = (note.error as { status?: number } | null)?.status === 404 || !notes.some((n) => n.id === pageId);
    return (
      <NotesPane toolbar={leading ? <Group gap="xs">{leading}</Group> : undefined}>
      <Center h="100%" mih={360} p="xl">
        <ErrorState
          error={missing ? { message: 'Not found', status: 404 } : note.error}
          title="This page didn’t load"
          missingTitle="This page doesn’t exist"
          onRetry={() => note.refetch()}
          retrying={note.isRefetching}
          actions={
            <Button variant={missing ? 'filled' : 'subtle'} color={missing ? undefined : 'gray'} onClick={() => navigate({ to: '/notes' })}>
              All notes
            </Button>
          }
        />
      </Center>
      </NotesPane>
    );
  }

  const path = ancestry(notes, pageId);
  const breadcrumb = (current: string) => (
    <Breadcrumbs separatorMargin={6} styles={{ root: { flexWrap: 'nowrap', minWidth: 0 } }}>
      <AnchorLink to="/notes" size="sm" c="dimmed">
        Notes
      </AnchorLink>
      {path.slice(0, -1).map((p) => (
        <AnchorLink
          key={p.id}
          to="/notes/$pageId"
          params={{ pageId: p.id }}
          size="sm"
          c="dimmed"
          truncate
          maw={180}
        >
          {p.title || 'Untitled'}
        </AnchorLink>
      ))}
      <Text size="sm" truncate maw={240}>
        {current || 'Untitled'}
      </Text>
    </Breadcrumbs>
  );

  return (
    <NoteEditor
      key={note.data.id}
      page={note.data}
      courses={courses.data ?? []}
      breadcrumb={breadcrumb}
      leading={leading}
    />
  );
}

// ── The screen ────────────────────────────────────────────────────────────────

/**
 * Notes, Notion-style: kit's PageTree on the left, kit's PageHeader and block
 * editor on the right. `/notes` shows recent pages; `/notes/$pageId` opens one.
 */
export function NotesPage() {
  const { pageId } = useParams({ strict: false }) as { pageId?: string };
  const navigate = useNavigate();
  const tree = useNoteTree();
  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [drawerOpen, drawer] = useDisclosure(false);
  const notes = useMemo(() => tree.data ?? [], [tree.data]);

  const open = (id: string) => {
    drawer.close();
    navigate({ to: '/notes/$pageId', params: { pageId: id } });
  };

  const add = (parentId: string | null) => {
    const parent = parentId ? notes.find((n) => n.id === parentId) : undefined;
    create.mutate(
      { parentId, title: '', courseId: parent?.courseId ?? null },
      { onSuccess: (page) => open(page.id) }
    );
  };

  const rename = (id: string, title: string) => update.mutate({ id, patch: { title } });

  const confirmDelete = (id: string) => {
    const page = notes.find((n) => n.id === id);
    const doomed = descendants(notes, id);
    const inside = doomed.size - 1;
    modals.openConfirmModal({
      title: `Delete “${page?.title || 'Untitled'}”?`,
      children: (
        <Text size="sm">
          {inside > 0
            ? `This also deletes the ${inside} page${inside === 1 ? '' : 's'} inside it. There is no undo.`
            : 'There is no undo.'}
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(id, {
          onSuccess: () => {
            if (pageId && doomed.has(pageId)) navigate({ to: '/notes' });
          },
        }),
    });
  };

  /** Reorders the destination's children so positions stay 0..n-1, patching only what changed. */
  const move = ({ id, parentId, index }: PageMove) => {
    const siblings = (childrenByParent(notes).get(parentId) ?? []).filter((n) => n.id !== id);
    const moved = notes.find((n) => n.id === id);
    if (!moved) return;
    const order = [...siblings];
    order.splice(Math.max(0, Math.min(index, order.length)), 0, moved);
    order.forEach((n, position) => {
      if (n.id === id) {
        if (n.parentId !== parentId || n.position !== position) update.mutate({ id, patch: { parentId, position } });
      } else if (n.position !== position) {
        update.mutate({ id: n.id, patch: { position } });
      }
    });
  };

  const treeWidth = useResizableWidth({ storageKey: 'cw.notes-tree-width', initial: 248, min: 180, max: 480 });

  const sidebar = (
    <NotesSidebar
      notes={notes}
      loading={tree.isLoading}
      error={tree.isError}
      treeError={tree.error}
      onRetry={() => tree.refetch()}
      selectedId={pageId ?? null}
      onOpen={open}
      onAdd={add}
      onRename={rename}
      onDelete={confirmDelete}
      onMove={move}
    />
  );

  const openTitle = pageId ? notes.find((n) => n.id === pageId)?.title || 'Untitled' : 'Notes';
  // Narrow screens have no tree pane; the toolbar's first control opens it in a drawer.
  const pagesButton = (
    <ActionIcon hiddenFrom="sm" variant="subtle" color="gray" aria-label="Pages" onClick={drawer.open}>
      <ListTree size={16} />
    </ActionIcon>
  );

  return (
    <Box className={classes.root}>
      <PageShell
        // The band is visually hidden (notes.module.css): the open page's own
        // header is the title the eye reads, and this h1 names it for the outline.
        title={openTitle}
        // `detail`, not `list-detail`: the page tree is the notebook's navigation
        // (narrow, like a rail) and the open page is the subject that gets the
        // width. list-detail's master is the wider pane, which a page tree is not.
        archetype="detail"
        scroll={false}
        bodyProps={{ px: 0, pb: 0 }}
      >
        <Flex h="100%" style={{ minHeight: 0 }}>
          <Box
            className={classes.tree}
            w={treeWidth.width}
            px="xs"
            pt="sm"
            pb="xs"
            visibleFrom="sm"
            pos="relative"
            style={{ flexShrink: 0, minHeight: 0 }}
            data-section="pages"
          >
            {sidebar}
            <ResizeHandle label="Resize page list" edge="end" state={treeWidth} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0, minHeight: 0 }} data-section={pageId ? 'page' : 'recent'}>
            <Reveal key={pageId ?? 'recent'} style={{ height: '100%' }}>
              {pageId ? (
                <OpenPage pageId={pageId} notes={notes} leading={pagesButton} />
              ) : (
                <RecentPages notes={notes} onNew={() => add(null)} creating={create.isPending} leading={pagesButton} />
              )}
            </Reveal>
          </Box>
        </Flex>
        <Drawer opened={drawerOpen} onClose={drawer.close} title="Pages" size="xs">
          <Box h="calc(100dvh - 90px)">{sidebar}</Box>
        </Drawer>
      </PageShell>
    </Box>
  );
}
