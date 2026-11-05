import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Grid,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { BookOpen, CircleAlert, Database, FileText, Globe, Info, Link2, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { Panel } from '@/components/panel';
import { StatCard } from '@/components/stat-card';
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

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function timeAgo(iso: string): string {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

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
          aria-label="Link to add"
          placeholder="https://raft.github.io/raft.pdf"
          leftSection={<Link2 size={14} />}
          value={uri}
          onChange={(e) => {
            setUri(e.currentTarget.value);
            setError(null);
          }}
          error={error}
          style={{ flex: 1 }}
        />
        <Button type="submit" loading={add.isPending} disabled={!uri.trim()}>
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
      <Table.ScrollContainer minWidth={720} scrollAreaProps={{ viewportProps: { 'data-scroll-x': 'allow' } as React.ComponentProps<'div'> }}>
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Source</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Course</Table.Th>
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
                    <Text size="sm" fw={500} truncate maw={220} title={s.title}>
                      {s.title}
                    </Text>
                    {s.uri && s.uri !== s.title && (
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
                  <Table.Td>
                    <Text size="sm" c={s.courseId ? undefined : 'dimmed'} truncate maw={150}>
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
    );
  }

  return (
    <Panel
      title="All sources"
      description={sources.data ? `${rows.length} of ${sources.data.length} shown` : undefined}
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
      <Box px="lg" pb="md">
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
    <Panel title="Test retrieval" description="What the tutor would find for a question, best match first.">
      <Stack gap="sm" px="lg" pb="lg">
        <Box component="form" onSubmit={run}>
          <Stack gap="xs">
            <TextInput
              label="Query"
              placeholder="split vote"
              leftSection={<Search size={14} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Select
                label="Course"
                placeholder="All courses"
                data={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))}
                value={course}
                onChange={setCourse}
                clearable
                style={{ flex: 1 }}
              />
              <Button type="submit" loading={search.isPending} disabled={!query.trim()}>
                Search
              </Button>
            </Group>
          </Stack>
        </Box>

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

        {search.isIdle && (
          <Text size="sm" c="dimmed">
            Ask something you’d ask the tutor to see which chunks it would read.
          </Text>
        )}

        {search.isSuccess && hits.length > 0 && (
          <Stack gap="xs" component="ol" p={0} m={0} style={{ listStyle: 'none' }} aria-label="Ranked results">
            {hits.map((h, i) => (
              <Paper key={h.chunkId} component="li" withBorder radius="md" p="sm">
                <Stack gap={4}>
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
                  <Text size="xs" c="dimmed">
                    {h.context}
                  </Text>
                  <Text size="sm" lineClamp={4}>
                    {plain(h.text)}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
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

  return (
    <PageShell
      title="Sources"
      description="Material the tutor searches. Each source is split into chunks, embedded and stored per course."
      archetype="dashboard-grid"
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
      <Reveal>
      <Stack gap="md">
        {stats.isError ? (
          <Alert color="red" variant="light" icon={<CircleAlert size={16} />} title="Index stats didn’t load">
            <Button size="xs" variant="default" mt={6} onClick={() => stats.refetch()}>
              Retry
            </Button>
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            <StatCard label="Sources" value={stats.data?.sources.toLocaleString() ?? '—'} loading={stats.isLoading} />
            <StatCard label="Chunks indexed" value={stats.data?.chunks.toLocaleString() ?? '—'} loading={stats.isLoading} />
            <StatCard label="Courses" value={stats.data?.courses.toLocaleString() ?? '—'} loading={stats.isLoading} />
            <StatCard
              label="Embed model"
              value={
                <Text component="span" fz="md" fw={600} ff="monospace">
                  {stats.data?.embedModel ?? '—'}
                </Text>
              }
              sub={stats.data ? `${stats.data.dims} dimensions · ${stats.data.embedder}` : undefined}
              loading={stats.isLoading}
            />
          </SimpleGrid>
        )}

        {stats.data?.embedder === 'local' && (
          <Alert color="yellow" variant="light" icon={<Info size={16} />} title="Using the local fallback embedder">
            <Text size="sm">
              Without a Voyage key, chunks are embedded with a hashed bag-of-words model, so retrieval matches words, not
              meaning. Set <Code>VOYAGE_API_KEY</Code> in the backend’s environment, restart it, then press Re-index.
            </Text>
          </Alert>
        )}

        <Grid gap="md" align="flex-start">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <SourcesTable courseTitle={courseTitle} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <TestRetrieval />
          </Grid.Col>
        </Grid>
      </Stack>
      </Reveal>
    </PageShell>
  );
}
