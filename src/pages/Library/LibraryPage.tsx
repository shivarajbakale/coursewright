import {
  Alert,
  Badge,
  Card,
  Grid,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { AnchorLink, ButtonLink, CardLink } from '@/components/links';
import { ArrowRight, BookOpen, Hammer, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { useCourses, useHealth, useRecentNotes } from '@/hooks/useCoursewright';
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
      description="Courses built for you, from an interview, with projects and a tutor that knows them."
      archetype="dashboard-grid"
      actions={
        <ButtonLink to="/new" leftSection={<Plus size={16} />}>
          New course
        </ButtonLink>
      }
    >
      <Stack gap="lg">
        {health.data && !health.data.anthropic && (
          <Alert variant="light" color="yellow" icon={<TriangleAlert size={16} />} title="Running without Claude">
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
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} h={168} radius="lg" />
                  ))}
                </SimpleGrid>
              ) : courses.isError ? (
                <Alert color="red" title="Could not load your courses">
                  {(courses.error as { message?: string }).message}
                </Alert>
              ) : list.length === 0 ? (
                <EmptyLibrary />
              ) : (
                // Same gutter as the outer grid, so the two course columns and
                // the notes column are one three-column rhythm of equal widths.
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
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
              <Card withBorder radius="lg" p="xs">
                {recent.isPending ? (
                  <Stack gap="xs" p="xs">
                    <Skeleton h={18} />
                    <Skeleton h={18} />
                    <Skeleton h={18} />
                  </Stack>
                ) : (recent.data ?? []).length === 0 ? (
                  <Text size="sm" c="dimmed" p="sm">
                    No notes yet. Select text in a chapter and choose “Add to notes”.
                  </Text>
                ) : (
                  <Stack gap={2}>
                    {recent.data!.map((n) => (
                      <AnchorLink
                        key={n.id}
                        to="/notes/$pageId"
                        params={{ pageId: n.id }}
                        underline="never"
                        c="var(--mantine-color-text)"
                        p="xs"
                        style={{ borderRadius: 'var(--mantine-radius-md)' }}
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
                    ))}
                  </Stack>
                )}
              </Card>
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
    <Card withBorder radius="lg" p="lg">
      <Group justify="space-between" wrap="nowrap" gap="lg">
        <Group wrap="nowrap" gap="md" style={{ minWidth: 0 }}>
          <ThemeIcon size={48} radius="md" variant="light" color={course.colour}>
            <Text size="xl">{course.icon}</Text>
          </ThemeIcon>
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Continue where you left off
            </Text>
            <Text fw={600} truncate>
              {course.title}
            </Text>
            <Group gap="xs">
              <Progress value={pct} w={160} size="sm" aria-label="Course progress" />
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
        >
          Resume
        </ButtonLink>
      </Group>
    </Card>
  );
}

function CourseCard({ course }: { course: CourseSummary }) {
  const building = course.status === 'building' || course.status === 'planning';
  const failed = course.status === 'failed';
  const pct = Math.round((course.chaptersDone / Math.max(1, course.chapterCount)) * 100);
  const to = building ? '/courses/$courseId/building' : '/courses/$courseId';

  return (
    <CardLink
      withBorder
      radius="lg"
      p="lg"
      to={to}
      params={{ courseId: course.id }}
      data-status={course.status}
    >
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <ThemeIcon size={40} radius="md" variant="light" color={course.colour}>
            <Text size="lg">{course.icon}</Text>
          </ThemeIcon>
          {building ? (
            <Badge variant="light" color="blue" leftSection={<Loader size={10} color="blue" />}>
              Building
            </Badge>
          ) : failed ? (
            <Badge variant="light" color="red">
              Failed
            </Badge>
          ) : pct === 100 ? (
            <Badge variant="light" color="green">
              Finished
            </Badge>
          ) : null}
        </Group>
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={600} lineClamp={2}>
            {course.title}
          </Text>
          {building ? (
            <Text size="sm" c="dimmed">
              Agents are researching and writing. Watch it come together.
            </Text>
          ) : (
            <Group gap="md">
              <Group gap={4}>
                <BookOpen size={14} />
                <Text size="xs" c="dimmed">
                  {course.moduleCount} modules · {course.chapterCount} chapters
                </Text>
              </Group>
              <Group gap={4}>
                <Hammer size={14} />
                <Text size="xs" c="dimmed">
                  {course.projectCount} projects
                </Text>
              </Group>
            </Group>
          )}
        </Stack>
        {!building && !failed && (
          <Stack gap={4}>
            <Progress value={pct} size="sm" aria-label={`${course.title} progress`} />
            <Text size="xs" c="dimmed">
              {pct}% · started {timeAgo(course.createdAt)}
            </Text>
          </Stack>
        )}
      </Stack>
    </CardLink>
  );
}

function EmptyLibrary() {
  return (
    <Card withBorder radius="lg" p="xl">
      <Stack align="center" gap="sm" ta="center">
        <ThemeIcon size={48} radius="xl" variant="light">
          <Sparkles size={22} />
        </ThemeIcon>
        <Title order={3} size="h4">
          Learn something new
        </Title>
        <Text size="sm" c="dimmed" maw={420}>
          Name a topic. A short interview tailors it to you, then agents build modules, chapters, diagrams and
          projects.
        </Text>
        <ButtonLink to="/new" leftSection={<Plus size={16} />}>
          Plan a course
        </ButtonLink>
      </Stack>
    </Card>
  );
}
