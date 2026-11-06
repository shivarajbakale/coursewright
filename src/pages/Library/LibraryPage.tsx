import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Paper,
  Grid,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useNavigate } from '@tanstack/react-router';
import { AnchorLink, ButtonLink, CardLink } from '@/components/links';
import { ErrorState, StatePanel } from '@/components/state-panel';
import { ArrowRight, BookOpen, Hammer, Play, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { useCourses, useDeleteCourse, useHealth, useJob, useRecentNotes, useResumeCourse } from '@/hooks/useCoursewright';
import { timeAgo } from '@/lib/time';
import type { CourseSummary } from '@/api/types';

/**
 * Library: every course you are taking, the ones still being built, and the
 * notes you touched last. The first screen, so it answers "where was I?".
 */
export function LibraryPage() {
  const courses = useCourses();
  const recent = useRecentNotes();
  const health = useHealth();

  const list = courses.data ?? [];
  const inProgress = list.find((c) => c.status === 'ready' && c.lastOpenedChapterId && c.chaptersDone < c.chapterCount);

  return (
    <PageShell
      title="Library"
      archetype="dashboard-grid"
      actions={
        // Lime goes to one action: Resume when there is a course to go back to, else this.
        <ButtonLink to="/new" leftSection={<Plus size={16} />} variant={inProgress ? 'default' : 'filled'}>
          New course
        </ButtonLink>
      }
    >
      <Stack gap="lg">
        {health.data && !health.data.anthropic && (
          <Alert variant="light" color="yellow" icon={<TriangleAlert size={16} />} title="No model connected">
            Set <code>ANTHROPIC_API_KEY</code> for the agent service to build new courses and talk to the tutor. Reading,
            notes and search work without it.
          </Alert>
        )}

        {inProgress && <ContinueCard course={inProgress} />}

        <Reveal>
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="sm">
              <Title order={2} size="h4">
                Courses
              </Title>
              {courses.isPending ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} h={112} radius="lg" />
                  ))}
                </SimpleGrid>
              ) : courses.isError ? (
                <Card withBorder radius="lg" p={0}>
                  <ErrorState
                    error={courses.error}
                    title="Your courses didn’t load"
                    onRetry={() => courses.refetch()}
                    retrying={courses.isRefetching}
                  />
                </Card>
              ) : list.length === 0 ? (
                <EmptyLibrary />
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {list.map((c) => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={2} size="h4">
                  Recent notes
                </Title>
                <AnchorLink to="/notes" size="sm">
                  All notes
                </AnchorLink>
              </Group>
              <Box>
                {recent.isPending ? (
                  <Stack gap="xs">
                    <Skeleton h={18} />
                    <Skeleton h={18} />
                    <Skeleton h={18} />
                  </Stack>
                ) : recent.isError ? (
                  <ErrorState
                    size="compact"
                    plain
                    error={recent.error}
                    title="Recent notes didn’t load"
                    onRetry={() => recent.refetch()}
                    retrying={recent.isRefetching}
                  />
                ) : (recent.data ?? []).length === 0 ? (
                  <StatePanel art="notebook" size="compact" title="No notes yet">
                    Select text in a chapter and choose “Add to notes”.
                  </StatePanel>
                ) : (
                  <Stack gap={0} component="ul" p={0} m={0} style={{ listStyle: 'none' }} aria-label="Recent notes">
                    {recent.data!.map((n) => (
                      <Box component="li" key={n.id}>
                      <AnchorLink
                        to="/notes/$pageId"
                        params={{ pageId: n.id }}
                        underline="never"
                        c="var(--mantine-color-text)"
                        display="block"
                        py={8}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" truncate>
                            {n.icon} {n.title || 'Untitled'}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                            {timeAgo(n.updatedAt)}
                          </Text>
                        </Group>
                      </AnchorLink>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Grid.Col>
        </Grid>
        </Reveal>
      </Stack>
    </PageShell>
  );
}

function ContinueCard({ course }: { course: CourseSummary }) {
  const pct = Math.round((course.chaptersDone / Math.max(1, course.chapterCount)) * 100);
  return (
    <Paper withBorder radius="lg" px="md" py="sm">
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Group wrap="nowrap" gap="sm" style={{ minWidth: 0 }}>
          <BookOpen size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} aria-hidden />
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" truncate>
              <Text span c="dimmed">
                Continue{' '}
              </Text>
              <Text span fw={600}>
                {course.title}
              </Text>
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Progress value={pct} w={120} size="xs" aria-label="Course progress" />
              <Text size="xs" c="dimmed">
                {course.chaptersDone} of {course.chapterCount} chapters
              </Text>
            </Group>
          </Stack>
        </Group>
        <ButtonLink
          to="/courses/$courseId/chapters/$chapterId"
          params={{ courseId: course.id, chapterId: course.lastOpenedChapterId! }}
          rightSection={<ArrowRight size={16} />}
          style={{ flexShrink: 0 }}
        >
          Resume
        </ButtonLink>
      </Group>
    </Paper>
  );
}

/** The title line every course card shares: a book mark, the title, a status badge. */
function CourseTitle({ course, badge }: { course: CourseSummary; badge?: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
        <BookOpen size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} aria-hidden />
        <Text fw={600} truncate title={course.title}>
          {course.title}
        </Text>
      </Group>
      {badge}
    </Group>
  );
}

function CourseCard({ course }: { course: CourseSummary }) {
  if (course.status === 'failed') return <FailedCourseCard course={course} />;
  const building = course.status === 'building' || course.status === 'planning';
  const pct = Math.round((course.chaptersDone / Math.max(1, course.chapterCount)) * 100);
  const to = building ? '/courses/$courseId/building' : '/courses/$courseId';

  return (
    <CardLink withBorder radius="lg" p="md" to={to} params={{ courseId: course.id }} data-status={course.status}>
      <Stack gap="xs" h="100%">
        <CourseTitle
          course={course}
          badge={
            course.outlineReady ? (
              <Badge variant="light" style={{ flexShrink: 0 }}>
                Outline ready
              </Badge>
            ) : building ? (
              <Badge variant="light" color="blue" leftSection={<Loader size={10} color="blue" />} style={{ flexShrink: 0 }}>
                Building
              </Badge>
            ) : pct === 100 ? (
              <Badge style={{ flexShrink: 0 }}>
                Finished
              </Badge>
            ) : null
          }
        />
        {course.outlineReady ? (
          <Text size="sm" c="dimmed">
            Waiting for you: review the outline, then start writing.
          </Text>
        ) : building ? (
          <Text size="sm" c="dimmed">
            Being researched and written. Open it to watch.
          </Text>
        ) : (
          <>
            <Group gap="md">
              <Group gap={4}>
                <BookOpen size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {course.moduleCount} modules · {course.chapterCount} chapters
                </Text>
              </Group>
              <Group gap={4}>
                <Hammer size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {course.projectCount} projects
                </Text>
              </Group>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Progress value={pct} size="xs" style={{ flex: 1 }} aria-label={`${course.title} progress`} />
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                {pct}% · started {timeAgo(course.createdAt)}
              </Text>
            </Group>
          </>
        )}
      </Stack>
    </CardLink>
  );
}

/**
 * A build that failed has nowhere to link to. It says why, briefly, and offers
 * what can happen next: continue the build where it stopped (the default),
 * start the interview again on the same topic, or remove the card.
 */
function FailedCourseCard({ course }: { course: CourseSummary }) {
  const job = useJob(course.jobId);
  const remove = useDeleteCourse();
  const resume = useResumeCourse();
  const navigate = useNavigate();
  const reason = job.data?.error;

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete “${course.title}”?`,
      children: <Text size="sm">The failed build and anything it wrote are removed. There is no undo.</Text>,
      labels: { confirm: 'Delete', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(course.id),
    });

  return (
    <Card withBorder radius="lg" p="md" data-status={course.status}>
      <Stack gap="xs" h="100%">
        <CourseTitle
          course={course}
          badge={
            <Badge variant="light" color="red" style={{ flexShrink: 0 }}>
              Failed
            </Badge>
          }
        />
        <Text size="sm" c="dimmed" truncate title={reason ?? undefined}>
          {reason ? `The build stopped: ${reason}` : 'The build stopped before the course was written.'}
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            leftSection={<Play size={14} />}
            loading={resume.isPending}
            onClick={() =>
              resume.mutate(course.id, {
                onSuccess: () => navigate({ to: '/courses/$courseId/building', params: { courseId: course.id } }),
              })
            }
          >
            Continue
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<RotateCcw size={14} />}
            onClick={() => navigate({ to: '/new', search: { topic: course.topic || course.title } })}
          >
            Start again
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            leftSection={<Trash2 size={14} />}
            loading={remove.isPending}
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function EmptyLibrary() {
  return (
    <Card withBorder radius="lg" p={0}>
      <StatePanel
        art="courses"
        title="Learn something new"
        actions={
          <ButtonLink to="/new" leftSection={<Plus size={16} />}>
            Plan a course
          </ButtonLink>
        }
      >
        Name a topic. A short interview tailors it to you, then agents build modules, chapters, diagrams and
        projects.
      </StatePanel>
    </Card>
  );
}
