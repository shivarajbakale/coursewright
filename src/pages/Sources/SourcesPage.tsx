import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Flex,
  Group,
  Loader,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { BookOpen, CircleAlert, Database, FileText, Globe, Info, Link2, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { timeAgo } from '@/lib/time';
import { Reveal } from '@/components/reveal';
import { Panel } from '@/components/panel';
import { AnchorLink } from '@/components/links';
import type { Source, SourceKind } from '@/api/types';
import { useAddSource, useCourses, useIndexStats, useReindex, useSearchTest, useSources } from '@/hooks/useCoursewright';

const KIND: Record<SourceKind, { label: string; color: string; icon: React.ReactNode }> = {
  chapter: { label: 'Chapter', color: 'lime', icon: <BookOpen size={12} /> },
  note: { label: 'Note', color: 'gray', icon: <FileText size={12} /> },
  url: { label: 'URL', color: 'cyan', icon: <Globe size={12} /> },
  tutor: { label: 'Tutor', color: 'violet', icon: <MessageCircle size={12} /> },
};

const STATUS: Record<Source['status'], { label: string; color: string }> = {
  indexed: { label: 'Indexed', color: 'lime' },
  pending: { label: 'Indexing', color: 'yellow' },
  failed: { label: 'Failed', color: 'red' },
};

const NOWRAP: React.CSSProperties = { whiteSpace: 'nowrap' };

/** Chunk text is markdown; show it as prose. */
function plain(md: string): string {
  return md.replace(/^\s*>\s?/gm, '').replace(/[*_`#]+/g, '').trim();
}

function isUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A ScrollArea that shrinks inside a flex column whose height is only capped
 * (max-height), not set: the viewport flexes instead of reading `height: 100%`
 * of a parent that has no definite height.
 */
const FLEX_SCROLL = {
  root: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 },
  viewport: { flex: '1 1 auto', minHeight: 0, height: 'auto' },
} as const;

/** A panel that is as tall as its content, up to the height of its row, laid out as a column. */
const FLEX_PANEL: React.CSSProperties = { display: 'flex', flexDirection: 'column', maxHeight: '100%', minHeight: 0 };
const FLEX_CONTENT: React.CSSProperties = { display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' };

// ── Add a URL ────────────────────────────────────────────────────────────────

function AddUrl() {
  const add = useAddSource();
  const [uri, setUri] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = uri.trim();
    if (!isUrl(value)) {
      setError('Paste a full link, starting with https://');
      return;
    }
    add.mutate(value, { onSuccess: () => setUri('') });
  };

  return (
    <Box component="form" onSubmit={submit}>
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <TextInput
          size="xs"
          aria-label="Link to add"
          placeholder="Add a link to index, e.g. https://raft.github.io/raft.pdf"
          leftSection={<Link2 size={14} />}
          value={uri}
          onChange={(e) => {
            setUri(e.currentTarget.value);
            setError(null);
          }}
          error={error}
          style={{ flex: 1 }}
        />
        <Button size="xs" type="submit" loading={add.isPending} disabled={!uri.trim()}>
          Add URL
        </Button>
      </Group>
    </Box>
  );
}

// ── The sources table ────────────────────────────────────────────────────────

function SourcesTable({ courseTitle }: { courseTitle: (id: string | null) => string }) {
  const sources = useSources();
  const [course, setCourse] = useState<string | null>(null);
  const courses = useCourses();

  const rows = useMemo(() => {
    const all = sources.data ?? [];
    return course ? all.filter((s) => s.courseId === course) : all;
  }, [sources.data, course]);

  const courseOptions = (courses.data ?? []).map((c) => ({ value: c.id, label: c.title }));

  let body: React.ReactNode;
  if (sources.isLoading) {
    body = (
      <Stack gap="xs" p="lg">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} h={28} />
        ))}
      </Stack>
    );
  } else if (sources.isError) {
    body = (
      <Box p="lg">
        <Alert color="red" variant="light" icon={<CircleAlert size={16} />} title="Sources didn’t load">
          <Group gap="sm" mt={4}>
            <Text size="sm">The index service didn’t answer.</Text>
            <Button size="xs" variant="default" onClick={() => sources.refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      </Box>
    );
  } else if (!rows.length) {
    body = (
      <Center p="xl">
        <Stack align="center" gap={6} maw={360} ta="center">
          <Database size={28} color="var(--mantine-color-dimmed)" />
          <Text fw={600}>{course ? 'Nothing indexed for this course' : 'Nothing indexed yet'}</Text>
          <Text size="sm" c="dimmed">
            Chapters and notes are indexed as they are written. Paste a link above to add your own reading.
          </Text>
        </Stack>
      </Center>
    );
  } else {
    body = (
      // A six-column table keeps its columns and scrolls sideways in a narrow
      // column rather than crushing them; the scroll is declared, not accidental.
      <ScrollArea styles={FLEX_SCROLL}>
      <Table.ScrollContainer minWidth={560} scrollAreaProps={{ viewportProps: { 'data-scroll-x': 'allow' } as React.ComponentProps<'div'> }}>
        <Table verticalSpacing={6} highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Source</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th visibleFrom="xl">Course</Table.Th>
              <Table.Th ta="right">Chunks</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Updated</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((s) => {
              const kind = KIND[s.kind];
              const status = STATUS[s.status];
              return (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Text size="sm" fw={500} truncate maw={240} title={s.title}>
                      {s.title}
                    </Text>
                    {s.kind === 'url' && s.uri && s.uri !== s.title && (
                      <Text size="xs" c="dimmed" truncate maw={220} title={s.uri}>
                        {s.uri}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={NOWRAP}>
                    <Badge size="sm" variant="light" color={kind.color} leftSection={kind.icon} miw="max-content">
                      {kind.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td visibleFrom="xl">
                    <Text size="sm" c={s.courseId ? undefined : 'dimmed'} truncate maw={140}>
                      {courseTitle(s.courseId)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" style={NOWRAP}>
                    <Text size="sm" ff="monospace">
                      {s.status === 'indexed' ? s.chunkCount.toLocaleString() : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={NOWRAP}>
                    {s.status === 'failed' && s.error ? (
                      <Tooltip label={s.error} multiline w={260}>
                        <Badge size="sm" variant="light" color={status.color} miw="max-content">
                          {status.label}
                        </Badge>
                      </Tooltip>
                    ) : (
                      <Badge
                        size="sm"
                        variant="light"
                        color={status.color}
                        miw="max-content"
                        leftSection={s.status === 'pending' ? <Loader size={8} color="yellow" /> : undefined}
                      >
                        {status.label}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td style={NOWRAP}>
                    <Text size="sm" c="dimmed">
                      {timeAgo(s.updatedAt)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      </ScrollArea>
    );
  }

  return (
    <Panel
      title="All sources"
      description={
        sources.data ? (course ? `${rows.length} of ${sources.data.length} shown` : `${rows.length} sources`) : undefined
      }
      style={FLEX_PANEL}
      contentProps={{ p: 0, style: FLEX_CONTENT }}
      flex={1}
      miw={0}
      actions={
        <Select
          aria-label="Filter by course"
          placeholder="All courses"
          data={courseOptions}
          value={course}
          onChange={setCourse}
          clearable
          size="xs"
          w={200}
        />
      }
    >
      <Box px="lg" py="sm" style={{ flexShrink: 0 }}>
        <AddUrl />
      </Box>
      {body}
    </Panel>
  );
}

// ── Test retrieval ───────────────────────────────────────────────────────────

function TestRetrieval() {
  const courses = useCourses();
  const search = useSearchTest();
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setAsked(q);
    search.mutate({ query: q, courseId: course });
  };

  const hits = search.data ?? [];

  return (
    <Panel
      title="Test retrieval"
      description="What the tutor would read, best match first."
      style={FLEX_PANEL}
      contentProps={{ p: 0, style: FLEX_CONTENT }}
      w={{ base: '100%', lg: 320, xl: 380 }}
    >
      <Box component="form" onSubmit={run} px="lg" py="sm" style={{ flexShrink: 0 }}>
        <Stack gap="xs">
          <TextInput
            size="xs"
            aria-label="Question"
            placeholder="Ask what you’d ask the tutor, e.g. split vote"
            leftSection={<Search size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Group gap="xs" wrap="nowrap">
            <Select
              size="xs"
              aria-label="Course to search"
              placeholder="All courses"
              data={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))}
              value={course}
              onChange={setCourse}
              clearable
              style={{ flex: 1 }}
            />
            <Button size="xs" variant="default" type="submit" loading={search.isPending} disabled={!query.trim()}>
              Search
            </Button>
          </Group>
        </Stack>
      </Box>
      {!search.isIdle && (
      <ScrollArea styles={FLEX_SCROLL}>
      <Stack gap="sm" px="lg" pb="md">

        {search.isError && (
          <Alert color="red" variant="light" icon={<CircleAlert size={16} />}>
            The search failed. Check the index service and try again.
          </Alert>
        )}

        {search.isPending && (
          <Stack gap="xs">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={72} radius="md" />
            ))}
          </Stack>
        )}

        {search.isSuccess && !hits.length && (
          <Text size="sm" c="dimmed">
            Nothing matched “{asked}”. Try the words a chapter would use.
          </Text>
        )}


        {search.isSuccess && hits.length > 0 && (
          <Stack gap={0} component="ol" p={0} m={0} style={{ listStyle: 'none' }} aria-label="Ranked results">
            {hits.map((h, i) => (
              <Box key={h.chunkId} component="li" py="xs" style={i ? { borderTop: '1px solid var(--app-line, var(--mantine-color-default-border))' } : undefined}>
                <Stack gap={2}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {i + 1}
                      </Text>
                      {h.chapterId && h.courseId ? (
                        <AnchorLink
                          to="/courses/$courseId/chapters/$chapterId"
                          params={{ courseId: h.courseId, chapterId: h.chapterId }}
                          size="sm"
                          fw={600}
                          truncate
                        >
                          {h.title}
                        </AnchorLink>
                      ) : (
                        <Text size="sm" fw={600} truncate>
                          {h.title}
                        </Text>
                      )}
                    </Group>
                    <Badge size="sm" variant="light" color={h.score >= 0.75 ? 'lime' : h.score >= 0.4 ? 'yellow' : 'gray'}>
                      {h.score.toFixed(2)}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {h.context}
                  </Text>
                  <Text size="sm" lineClamp={3}>
                    {plain(h.text)}
                  </Text>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
      </ScrollArea>
      )}
    </Panel>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────

/** The tutor's library: what is indexed, adding a link, re-indexing, and a retrieval check. */
export function SourcesPage() {
  const stats = useIndexStats();
  const courses = useCourses();
  const reindex = useReindex();

  const courseTitle = (id: string | null) => {
    if (!id) return 'No course';
    return courses.data?.find((c) => c.id === id)?.title ?? 'Unknown course';
  };

  const facts = stats.data
    ? [
        plural(stats.data.sources, 'source'),
        plural(stats.data.chunks, 'chunk'),
        plural(stats.data.courses, 'course'),
        `${stats.data.embedModel}, ${stats.data.dims} dims`,
      ].join(' · ')
    : stats.isLoading
      ? 'Reading the index…'
      : 'Material the tutor searches, split into chunks and embedded per course.';

  return (
    <PageShell
      title="Sources"
      description={facts}
      // A collection with a filter and a side tool: `list`, not a dashboard —
      // there is no KPI row on this page any more, the counts are one line.
      archetype="list"
      scroll={false}
      actions={
        <Button
          variant="default"
          leftSection={<RefreshCw size={16} />}
          loading={reindex.isPending}
          onClick={() => reindex.mutate()}
        >
          Re-index
        </Button>
      }
    >
      <Stack gap="sm" h="100%" style={{ minHeight: 0 }}>
        {stats.isError && (
          <Alert color="red" variant="light" icon={<CircleAlert size={16} />} py="xs" style={{ flexShrink: 0 }}>
            <Group gap="sm">
              <Text size="sm">The index stats didn’t load.</Text>
              <Button size="xs" variant="default" onClick={() => stats.refetch()}>
                Retry
              </Button>
            </Group>
          </Alert>
        )}

        {stats.data?.embedder === 'local' && (
          <Alert color="yellow" variant="light" icon={<Info size={16} />} py="xs" style={{ flexShrink: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm">
                Local fallback embedder: retrieval matches words, not meaning. Set <Code>VOYAGE_API_KEY</Code>, restart
                the backend, then re-index.
              </Text>
              <Tooltip
                multiline
                w={300}
                label="Without a Voyage key, chunks are embedded with a hashed bag-of-words model. A question has to share words with a chunk to find it."
              >
                <Text size="sm" c="dimmed" td="underline" style={{ flexShrink: 0, cursor: 'help' }} tabIndex={0}>
                  Why
                </Text>
              </Tooltip>
            </Group>
          </Alert>
        )}

        <Reveal style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            gap="md"
            align={{ base: 'stretch', lg: 'flex-start' }}
            style={{ flex: 1, minHeight: 0, minWidth: 0 }}
          >
            <SourcesTable courseTitle={courseTitle} />
            <TestRetrieval />
          </Flex>
        </Reveal>
      </Stack>
    </PageShell>
  );
}

function plural(n: number, noun: string): string {
  return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`;
}
