import { useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Center,
  CloseButton,
  Drawer,
  Flex,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { CircleAlert, FileQuestion, FilePlus2, ListTree, NotebookPen, Plus, Search } from 'lucide-react';
import { PageIcon, PageTree, type PageMove } from '@shivarajbakale/ui';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { AnchorLink, CardLink } from '@/components/links';
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
      <Text size="sm" c="red" p="xs">
        Search failed. Try again in a moment.
      </Text>
    );
  }
  const hits = search.data ?? [];
  if (!hits.length) {
    return (
      <Text size="sm" c="dimmed" p="xs">
        No page mentions “{query}”.
      </Text>
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
        size="sm"
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
          <Stack gap="xs" p="xs" align="flex-start">
            <Text size="sm" c="red">
              The pages didn’t load.
            </Text>
            <Button size="xs" variant="default" onClick={onRetry}>
              Retry
            </Button>
          </Stack>
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
      <Button
        variant="subtle"
        color="gray"
        justify="flex-start"
        leftSection={<Plus size={14} />}
        onClick={() => onAdd(null)}
        style={{ flexShrink: 0 }}
      >
        New page
      </Button>
    </Stack>
  );
}

// ── The right column with no page open: recent pages ─────────────────────────

function RecentPages({ onNew, creating }: { onNew: () => void; creating: boolean }) {
  const recent = useRecentNotes();

  if (recent.isLoading) {
    return (
      <Stack gap="md" p="xl">
        <Skeleton h={22} w={160} />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} h={88} radius="md" />
          ))}
        </SimpleGrid>
      </Stack>
    );
  }
  if (recent.isError) {
    return (
      <Box p="xl">
        <Alert color="red" variant="light" icon={<CircleAlert size={16} />} title="Recent pages didn’t load">
          <Group gap="sm" mt={4}>
            <Text size="sm">The notes service didn’t answer.</Text>
            <Button size="xs" variant="default" onClick={() => recent.refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      </Box>
    );
  }
  const pages = recent.data ?? [];
  if (!pages.length) {
    return (
      <Center h="100%" p="xl">
        <Stack align="center" gap="sm" maw={380} ta="center">
          <ThemeIcon size={48} radius="xl" variant="light">
            <NotebookPen size={24} />
          </ThemeIcon>
          <Title order={2} size="h3">
            Your notebook is empty
          </Title>
          <Text size="sm" c="dimmed">
            Write things down in your own words as you read. Pages nest inside pages, link to chapters, and the tutor can
            read them.
          </Text>
          <Button leftSection={<FilePlus2 size={16} />} onClick={onNew} loading={creating}>
            Write your first page
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md" p="xl">
      <Group justify="space-between">
        <Title order={2} size="h4">
          Recently edited
        </Title>
        <Button size="xs" variant="default" leftSection={<Plus size={14} />} onClick={onNew} loading={creating}>
          New page
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {pages.map((p) => (
          <CardLink
            key={p.id}
            to="/notes/$pageId"
            params={{ pageId: p.id }}
            withBorder
            radius="md"
            p="md"
          >
            <Stack gap={8}>
              <PageIcon icon={parseIcon(p.icon)} size={24} />
              <Text fw={600} size="sm" lineClamp={1}>
                {p.title || 'Untitled'}
              </Text>
              <Text size="xs" c="dimmed">
                Edited {timeAgo(p.updatedAt)}
              </Text>
            </Stack>
          </CardLink>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

// ── The right column with a page open ────────────────────────────────────────

function OpenPage({ pageId, notes }: { pageId: string; notes: NoteSummary[] }) {
  const note = useNote(pageId);
  const courses = useCourses();
  const navigate = useNavigate();

  if (note.isLoading) {
    return (
      <Stack gap="md" px="xl" py="lg" maw={760} mx="auto">
        <Skeleton h={120} radius="md" />
        <Skeleton h={48} w={48} radius="md" />
        <Skeleton h={36} w="60%" />
        <Skeleton h={16} />
        <Skeleton h={16} w="90%" />
        <Skeleton h={16} w="70%" />
      </Stack>
    );
  }
  if (note.isError || !note.data) {
    const missing = (note.error as { status?: number } | null)?.status === 404 || !notes.some((n) => n.id === pageId);
    return (
      <Center h="100%" p="xl">
        <Stack align="center" gap="sm" maw={380} ta="center">
          <ThemeIcon size={48} radius="xl" variant="light" color={missing ? 'gray' : 'red'}>
            {missing ? <FileQuestion size={24} /> : <CircleAlert size={24} />}
          </ThemeIcon>
          <Title order={2} size="h3">
            {missing ? 'This page doesn’t exist' : 'The page didn’t load'}
          </Title>
          <Text size="sm" c="dimmed">
            {missing ? 'It may have been deleted, or the link is wrong.' : 'The notes service didn’t answer. Try again.'}
          </Text>
          <Group gap="xs">
            {!missing && (
              <Button variant="default" onClick={() => note.refetch()}>
                Retry
              </Button>
            )}
            <Button variant={missing ? 'filled' : 'subtle'} onClick={() => navigate({ to: '/notes' })}>
              All notes
            </Button>
          </Group>
        </Stack>
      </Center>
    );
  }

  const path = ancestry(notes, pageId);
  const breadcrumb = (
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
    </Breadcrumbs>
  );

  return (
    <Box maw={900} mx="auto">
      <NoteEditor key={note.data.id} page={note.data} courses={courses.data ?? []} breadcrumb={breadcrumb} />
    </Box>
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

  const sidebar = (
    <NotesSidebar
      notes={notes}
      loading={tree.isLoading}
      error={tree.isError}
      onRetry={() => tree.refetch()}
      selectedId={pageId ?? null}
      onOpen={open}
      onAdd={add}
      onRename={rename}
      onDelete={confirmDelete}
      onMove={move}
    />
  );

  return (
    <PageShell
      title="Notes"
      // `detail`, not `list-detail`: the page tree is the notebook's navigation
      // (narrow, like a rail) and the open page is the subject that gets the
      // width. list-detail's master is the wider pane, which a page tree is not.
      archetype="detail"
      scroll={false}
      actions={
        <>
          <Button
            hiddenFrom="sm"
            variant="default"
            leftSection={<ListTree size={16} />}
            onClick={drawer.open}
          >
            Pages
          </Button>
          <Button leftSection={<Plus size={16} />} onClick={() => add(null)} loading={create.isPending}>
            New page
          </Button>
        </>
      }
    >
      <Flex gap="md" h="100%" style={{ minHeight: 0 }}>
        <Paper withBorder radius="md" p="xs" w={272} visibleFrom="sm" style={{ flexShrink: 0, minHeight: 0 }} data-section="pages">
          {sidebar}
        </Paper>
        <Paper withBorder radius="md" style={{ flex: 1, minWidth: 0, minHeight: 0 }} data-section={pageId ? 'page' : 'recent'}>
          <ScrollArea h="100%">
            <Reveal key={pageId ?? 'recent'}>
            {pageId ? (
              <OpenPage pageId={pageId} notes={notes} />
            ) : (
              <RecentPages onNew={() => add(null)} creating={create.isPending} />
            )}
            </Reveal>
          </ScrollArea>
        </Paper>
      </Flex>
      <Drawer opened={drawerOpen} onClose={drawer.close} title="Pages" size="xs">
        <Box h="calc(100dvh - 90px)">{sidebar}</Box>
      </Drawer>
    </PageShell>
  );
}
