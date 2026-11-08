import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Grid,
  Group,
  Menu,
  ActionIcon,
  Loader,
  Progress,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { cwKeys } from '@/hooks/useCoursewright';
import {
  ArrowRight,
  BookDown,
  Circle,
  CircleCheck,
  Hammer,
  Layers,
  Maximize2,
  MessagesSquare,
  MoreHorizontal,
  PlusSquare,
  Target,
  Trash2,
} from 'lucide-react';
import { modals } from '@mantine/modals';
import { PageShell } from '@/components/page-shell';
import { ChapterNumber } from '@/components/chapter-number';
import { Reveal } from '@/components/reveal';
import { ButtonLink, NavLinkLink } from '@/components/links';
import { ErrorState } from '@/components/state-panel';
import { MermaidDiagram } from '@/components/diagrams/MermaidDiagram';
import { useCourse, useDeleteCourse, useDownloadCourseEpub } from '@/hooks/useCoursewright';
import { useTutor } from '@/copilot/tutorStore';
import type { CourseDetail, CourseExtension } from '@/api/types';
import { ExtendCourseModal } from './ExtendCourseModal';

/** Mermaid flowchart of the concept graph: prerequisites point at what they unlock. */
function conceptMermaid(course: CourseDetail): string {
  const safe = (s: string) => s.replace(/["[\]{}()]/g, ' ');
  const lines = ['flowchart LR'];
  course.concepts.forEach((c, i) => lines.push(`  c${i}["${safe(c.name)}"]`));
  const index = new Map(course.concepts.map((c, i) => [c.id, i]));
  course.edges.forEach(e => {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a !== undefined && b !== undefined) lines.push(`  c${a} --> c${b}`);
  });
  const weak = new Set(course.weakSpots.map(w => w.conceptId));
  course.concepts.forEach(
    (c, i) => weak.has(c.id) && lines.push(`  style c${i} stroke-width:3px,stroke-dasharray:4`)
  );
  return lines.join('\n');
}

/**
 * Course overview: modules with their chapters and projects, how far you are,
 * the concept map, and the weak spots your answers have shown.
 */
export function CoursePage() {
  const { courseId } = useParams({ from: '/courses/$courseId' });
  const course = useCourse(courseId);
  const navigate = useNavigate();
  const remove = useDeleteCourse();
  const book = useDownloadCourseEpub();
  const [extending, setExtending] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const setContext = useTutor(s => s.setContext);

  useEffect(() => {
    setContext({ courseId, chapterId: null, noteId: null, selection: null });
  }, [courseId, setContext]);

  const c = course.data;
  const graph = useMemo(() => (c && c.concepts.length ? conceptMermaid(c) : null), [c]);

  useEffect(() => {
    if (c && (c.status === 'building' || c.status === 'planning')) {
      void navigate({ to: '/courses/$courseId/building', params: { courseId }, replace: true });
    }
  }, [c, courseId, navigate]);

  if (course.isPending) {
    return (
      <PageShell title="Loading course…">
        <Stack gap="md">
          <Skeleton h={120} radius="lg" />
          <Skeleton h={320} radius="lg" />
        </Stack>
      </PageShell>
    );
  }
  if (course.isError || !c) {
    return (
      <PageShell title="Course">
        <ErrorState
          size="page"
          error={course.error ?? { message: 'Not found', status: 404 }}
          title="This course didn’t load"
          missingTitle="This course doesn’t exist"
          onRetry={() => course.refetch()}
          retrying={course.isRefetching}
          actions={
            <ButtonLink to="/" variant="default">
              Back to the library
            </ButtonLink>
          }
        />
      </PageShell>
    );
  }

  const pct = Math.round((c.chaptersDone / Math.max(1, c.chapterCount)) * 100);
  const allChapters = c.modules.flatMap(m => m.chapters);
  const nextChapter = allChapters.find(ch => !ch.done) ?? allChapters[0];

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete “${c.title}”?`,
      children: (
        <Text size="sm">
          Its chapters, projects, progress and index are removed. Your notes stay.
        </Text>
      ),
      labels: { confirm: 'Delete course', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await remove.mutateAsync(c.id);
        await navigate({ to: '/' });
      },
    });

  const firstSentence = (c.summary.match(/^.+?[.!?](\s|$)/)?.[0] ?? c.summary).trim();

  return (
    <PageShell
      title={c.title}
      description={firstSentence}
      archetype="detail"
      actions={
        <Group gap="xs">
          {nextChapter && (
            <ButtonLink
              to="/courses/$courseId/chapters/$chapterId"
              params={{ courseId, chapterId: nextChapter.id }}
              rightSection={<ArrowRight size={16} />}
            >
              {c.chaptersDone === 0 ? 'Start' : 'Continue'}
            </ButtonLink>
          )}
          <Menu position="bottom-end" opened={optionsOpen} onChange={setOptionsOpen}>
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label="Course options">
                <MoreHorizontal size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {c.extendable && (
                <Menu.Item
                  leftSection={<PlusSquare size={14} />}
                  onClick={() => setExtending(true)}
                >
                  Extend this course
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={book.isPending ? <Loader size={14} /> : <BookDown size={14} />}
                disabled={c.status !== 'ready' || book.isPending}
                closeMenuOnClick={false}
                onClick={() => book.mutate(courseId, { onSettled: () => setOptionsOpen(false) })}
              >
                {book.isPending ? (
                  'Preparing book…'
                ) : c.status === 'ready' ? (
                  'Download as EPUB'
                ) : (
                  <Stack gap={0}>
                    <Text size="sm" inherit>
                      Download as EPUB
                    </Text>
                    <Text size="xs" c="dimmed">
                      Available when the course is ready
                    </Text>
                  </Stack>
                )}
              </Menu.Item>
              <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={confirmDelete}>
                Delete course
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      }
      toolbar={
        <Group gap="md" wrap="wrap">
          <Group gap="xs" wrap="nowrap">
            <Progress value={pct} w={140} size="sm" aria-label="Course progress" />
            <Text size="sm">
              {c.chaptersDone} of {c.chapterCount} chapters read
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {c.moduleCount} modules · {c.projectCount} projects
          </Text>
          {[c.brief.level, c.brief.goal, c.brief.pace].filter(Boolean).map(b => (
            <Badge key={b} variant="default" size="sm" tt="none" fw={500}>
              {b}
            </Badge>
          ))}
        </Group>
      }
    >
      <ExtendCourseModal
        courseId={courseId}
        title={c.title}
        opened={extending}
        onClose={() => setExtending(false)}
      />
      {c.extension && <ExtensionBanner courseId={courseId} extension={c.extension} />}
      <Reveal>
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="lg" component="section" data-section="modules" aria-label="Outline">
              <Title order={2} size="h4">
                Outline
              </Title>
              {c.modules.map(m => {
                const done = m.chapters.filter(ch => ch.done).length;
                return (
                  <Stack key={m.id} gap={4}>
                    <Group justify="space-between" wrap="nowrap" gap="md" px="xs">
                      <Stack gap={0} style={{ minWidth: 0 }}>
                        <Text fw={600}>
                          {m.position}. {m.title}
                        </Text>
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {m.summary}
                        </Text>
                      </Stack>
                      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                        {done}/{m.chapters.length}
                      </Text>
                    </Group>
                    <Stack gap={0}>
                      {m.chapters.map(ch => (
                        <NavLinkLink
                          key={ch.id}
                          to="/courses/$courseId/chapters/$chapterId"
                          params={{ courseId, chapterId: ch.id }}
                          label={
                            <Group gap={10} wrap="nowrap">
                              <ChapterNumber value={`${m.position}.${ch.position}`} />
                              <Text size="sm" truncate>
                                {ch.title}
                              </Text>
                            </Group>
                          }
                          py={6}
                          leftSection={
                            ch.done ? (
                              <CircleCheck size={16} color="var(--mantine-color-dimmed)" />
                            ) : (
                              <Circle size={16} color="var(--mantine-color-dimmed)" />
                            )
                          }
                          rightSection={
                            <Text size="xs" c="dimmed">
                              {ch.readingMinutes} min
                            </Text>
                          }
                          style={{ borderRadius: 'var(--mantine-radius-md)' }}
                        />
                      ))}
                      {m.project && (
                        <NavLinkLink
                          to="/courses/$courseId/projects/$projectId"
                          params={{ courseId, projectId: m.project.id }}
                          label={m.project.title}
                          py={6}
                          leftSection={<Hammer size={16} />}
                          rightSection={
                            <Text size="xs" c="dimmed">
                              Project · {m.project.milestonesDone}/{m.project.milestonesTotal}
                            </Text>
                          }
                          style={{ borderRadius: 'var(--mantine-radius-md)' }}
                        />
                      )}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="xl">
              <Stack gap="xs" component="section" data-section="weak-spots" aria-label="Weak spots">
                <Group gap="xs">
                  <Target size={16} />
                  <Title order={2} size="h5">
                    Weak spots
                  </Title>
                </Group>
                {c.weakSpots.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    None yet. Your wrong answers to check-yourself questions show up here.
                  </Text>
                ) : (
                  <>
                    {c.weakSpots.map(w => (
                      <Group key={w.conceptId} justify="space-between" wrap="nowrap">
                        <Text size="sm">{w.name}</Text>
                        <Text size="sm" c="red">
                          {w.wrong} wrong
                        </Text>
                      </Group>
                    ))}
                    <Button
                      mt={4}
                      variant="default"
                      leftSection={<MessagesSquare size={16} />}
                      onClick={() =>
                        useTutor
                          .getState()
                          .ask(
                            `Drill me on my weak spots in this course: ${c.weakSpots.map(w => w.name).join(', ')}. One question at a time, and explain my mistakes.`,
                            { courseId }
                          )
                      }
                    >
                      Drill with the tutor
                    </Button>
                  </>
                )}
              </Stack>

              {graph && (
                <Stack
                  gap="xs"
                  component="section"
                  data-section="concept-map"
                  aria-label="Concept map"
                >
                  <Group justify="space-between">
                    <Title order={2} size="h5">
                      Concept map
                    </Title>
                    <Button
                      size="compact-sm"
                      variant="subtle"
                      leftSection={<Maximize2 size={14} />}
                      onClick={() =>
                        modals.open({
                          title: 'Concept map',
                          size: '90%',
                          children: (
                            <Stack gap="xs">
                              <Text size="sm" c="dimmed">
                                Arrows point from what you need first to what it unlocks. Dashed
                                outline: a weak spot.
                              </Text>
                              <MermaidDiagram source={graph} />
                            </Stack>
                          ),
                        })
                      }
                    >
                      Expand
                    </Button>
                  </Group>
                  <MermaidDiagram source={graph} />
                </Stack>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Reveal>
    </PageShell>
  );
}

const EXTENSION_COPY: Record<
  CourseExtension['status'],
  { text: string; action: string; color: string }
> = {
  planning: {
    text: 'Planning new modules on top of this course…',
    action: 'See progress',
    color: 'blue',
  },
  review: {
    text: 'New modules are ready for you to review.',
    action: 'Review them',
    color: 'lime',
  },
  writing: {
    text: 'Writing the new modules. You can keep reading.',
    action: 'See progress',
    color: 'blue',
  },
  failed: {
    text: 'Extending this course stopped before it finished.',
    action: 'See what happened',
    color: 'red',
  },
};

/** Where this course's extension stands, while one is in progress; it refreshes until it is done. */
function ExtensionBanner({
  courseId,
  extension,
}: {
  courseId: string;
  extension: CourseExtension;
}) {
  const qc = useQueryClient();
  const moving = extension.status === 'planning' || extension.status === 'writing';
  useEffect(() => {
    if (!moving) return;
    const t = setInterval(
      () => void qc.invalidateQueries({ queryKey: cwKeys.course(courseId) }),
      15000
    );
    return () => clearInterval(t);
  }, [moving, courseId, qc]);
  const copy = EXTENSION_COPY[extension.status];
  return (
    <Alert color={copy.color} variant="light" icon={<Layers size={16} />} mb="lg" role="status">
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Text size="sm">{copy.text}</Text>
        <ButtonLink
          to="/courses/$courseId/building"
          params={{ courseId }}
          size="xs"
          variant="light"
          color={copy.color}
        >
          {copy.action}
        </ButtonLink>
      </Group>
    </Alert>
  );
}
