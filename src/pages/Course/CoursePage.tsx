import { useEffect, useMemo } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Menu,
  ActionIcon,
  Progress,
  RingProgress,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowRight, Circle, CircleCheck, Hammer, MessagesSquare, MoreHorizontal, Target, Trash2 } from 'lucide-react';
import { modals } from '@mantine/modals';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { ButtonLink, NavLinkLink } from '@/components/links';
import { MermaidDiagram } from '@/components/diagrams/MermaidDiagram';
import { useCourse, useDeleteCourse } from '@/hooks/useCoursewright';
import { useTutor } from '@/copilot/tutorStore';
import type { CourseDetail } from '@/api/types';

/** Mermaid flowchart of the concept graph: prerequisites point at what they unlock. */
function conceptMermaid(course: CourseDetail): string {
  const safe = (s: string) => s.replace(/["[\]{}()]/g, ' ');
  const lines = ['flowchart LR'];
  course.concepts.forEach((c, i) => lines.push(`  c${i}["${safe(c.name)}"]`));
  const index = new Map(course.concepts.map((c, i) => [c.id, i]));
  course.edges.forEach((e) => {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a !== undefined && b !== undefined) lines.push(`  c${a} --> c${b}`);
  });
  const weak = new Set(course.weakSpots.map((w) => w.conceptId));
  course.concepts.forEach((c, i) => weak.has(c.id) && lines.push(`  style c${i} stroke-width:3px,stroke-dasharray:4`));
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
  const setContext = useTutor((s) => s.setContext);

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
        <Alert color="red" title="Could not load this course">
          {(course.error as { message?: string } | null)?.message ?? 'Not found.'}
        </Alert>
      </PageShell>
    );
  }

  const pct = Math.round((c.chaptersDone / Math.max(1, c.chapterCount)) * 100);
  const allChapters = c.modules.flatMap((m) => m.chapters);
  const nextChapter = allChapters.find((ch) => !ch.done) ?? allChapters[0];
  const openModule = c.modules.find((m) => m.chapters.some((ch) => !ch.done))?.id ?? c.modules[0]?.id;

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete “${c.title}”?`,
      children: (
        <Text size="sm">Its chapters, projects, progress and index are removed. Your notes stay.</Text>
      ),
      labels: { confirm: 'Delete course', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await remove.mutateAsync(c.id);
        await navigate({ to: '/' });
      },
    });

  return (
    <PageShell
      title={c.title}
      description={c.summary}
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
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label="Course options">
                <MoreHorizontal size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={confirmDelete}>
                Delete course
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      }
    >
      <Reveal>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" p="lg" data-section="progress">
              <Group gap="xl" wrap="nowrap">
                <RingProgress
                  size={96}
                  thickness={8}
                  roundCaps
                  sections={[{ value: pct, color: 'brand' }]}
                  label={
                    <Text ta="center" fw={700} size="lg">
                      {pct}%
                    </Text>
                  }
                />
                <Stack gap={6} style={{ flex: 1 }}>
                  <Text fw={600}>
                    {c.chaptersDone} of {c.chapterCount} chapters read
                  </Text>
                  <Group gap="xs">
                    {c.brief.level && <Badge variant="default">{c.brief.level}</Badge>}
                    {c.brief.goal && <Badge variant="default">{c.brief.goal}</Badge>}
                    {c.brief.pace && <Badge variant="default">{c.brief.pace}</Badge>}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {c.moduleCount} modules · {c.projectCount} projects · {c.concepts.length} concepts
                  </Text>
                </Stack>
              </Group>
            </Card>

            <Stack gap="sm" data-section="modules">
            <Title order={2} size="h4">
              Modules
            </Title>
            <Accordion variant="separated" radius="lg" defaultValue={openModule} chevronPosition="right">
              {c.modules.map((m) => {
                const done = m.chapters.filter((ch) => ch.done).length;
                return (
                  <Accordion.Item key={m.id} value={m.id}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap" pr="sm">
                        <Stack gap={2} style={{ minWidth: 0 }}>
                          <Text fw={600} truncate>
                            {m.position}. {m.title}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {m.summary}
                          </Text>
                        </Stack>
                        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                          <Text size="xs" c="dimmed">
                            {done}/{m.chapters.length}
                          </Text>
                          <Progress value={(done / Math.max(1, m.chapters.length)) * 100} w={64} size="sm" aria-label={`${m.title} progress`} />
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={2}>
                        {m.chapters.map((ch) => (
                          <NavLinkLink
                            key={ch.id}
                            to="/courses/$courseId/chapters/$chapterId"
                            params={{ courseId, chapterId: ch.id }}
                            label={`${m.position}.${ch.position} ${ch.title}`}
                            description={`${ch.readingMinutes} min`}
                            leftSection={
                              ch.done ? (
                                <CircleCheck size={16} color="var(--mantine-color-green-6)" />
                              ) : (
                                <Circle size={16} color="var(--mantine-color-dimmed)" />
                              )
                            }
                            style={{ borderRadius: 'var(--mantine-radius-md)' }}
                          />
                        ))}
                        {m.project && (
                          <NavLinkLink
                            to="/courses/$courseId/projects/$projectId"
                            params={{ courseId, projectId: m.project.id }}
                            label={m.project.title}
                            description={`Project · ${m.project.milestonesDone} of ${m.project.milestonesTotal} milestones`}
                            leftSection={
                              <ThemeIcon size={20} variant="light" radius="sm">
                                <Hammer size={12} />
                              </ThemeIcon>
                            }
                            style={{ borderRadius: 'var(--mantine-radius-md)' }}
                          />
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
            </Stack>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" p="lg" data-section="weak-spots">
              <Group gap="xs" mb="sm">
                <Target size={16} />
                <Text fw={600}>Weak spots</Text>
              </Group>
              {c.weakSpots.length === 0 ? (
                <Text size="sm" c="dimmed">
                  None yet. Answer the check-yourself questions and this fills in.
                </Text>
              ) : (
                <Stack gap="xs">
                  {c.weakSpots.map((w) => (
                    <Group key={w.conceptId} justify="space-between" wrap="nowrap">
                      <Text size="sm">{w.name}</Text>
                      <Badge color="red" variant="light">
                        {w.wrong} wrong
                      </Badge>
                    </Group>
                  ))}
                  <Button
                    mt="xs"
                    variant="light"
                    leftSection={<MessagesSquare size={16} />}
                    onClick={() =>
                      useTutor
                        .getState()
                        .ask(
                          `Drill me on my weak spots in this course: ${c.weakSpots.map((w) => w.name).join(', ')}. One question at a time, and explain my mistakes.`,
                          { courseId }
                        )
                    }
                  >
                    Drill with the tutor
                  </Button>
                </Stack>
              )}
            </Card>

            {graph && (
              <Card withBorder radius="lg" p="lg" data-section="concept-map">
                <Text fw={600} mb="xs">
                  Concept map
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Arrows point from what you need first to what it unlocks. Dashed: a weak spot.
                </Text>
                <MermaidDiagram source={graph} />
              </Card>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
      </Reveal>
    </PageShell>
  );
}
