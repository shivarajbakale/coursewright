import { useEffect, useMemo } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Stepper,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowRight, CircleStop, PartyPopper, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { AnchorLink, ButtonLink } from '@/components/links';
import { ErrorState } from '@/components/state-panel';
import { Reveal } from '@/components/reveal';
import { StageScene, type SceneData, type SceneStage } from '@/illustrations';
import { cwKeys, useCancelJob, useCourse, useJob, useJobEvents, useResumeCourse } from '@/hooks/useCoursewright';
import { useQueryClient } from '@tanstack/react-query';
import { OutlineReview } from './OutlineReview';
import type { JobEvent } from '@/api/types';

const STAGES: { key: SceneStage; label: string; blurb: string }[] = [
  { key: 'research', label: 'Research', blurb: 'Reading what learners struggle with and the canonical references' },
  { key: 'concepts', label: 'Concept map', blurb: 'Concepts and what each one needs first' },
  { key: 'outline', label: 'Outline', blurb: 'Modules and chapters sized to your pace' },
  { key: 'chapters', label: 'Chapters', blurb: 'Explanations, worked examples, diagrams and questions' },
  { key: 'projects', label: 'Projects', blurb: 'One project per module, with milestones and hints' },
  { key: 'index', label: 'Index', blurb: 'Chunking and embedding everything for the tutor' },
];

/** Folds the event stream into what the illustrations draw. */
function sceneData(topic: string, events: JobEvent[]): SceneData {
  const data: SceneData = { topic, terms: [], concepts: [], modules: [], chapters: [], projects: [] };
  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    if (Array.isArray(p.terms)) data.terms = [...(data.terms ?? []), ...(p.terms as string[])];
    if (Array.isArray(p.concepts)) data.concepts = p.concepts as string[];
    if (Array.isArray(p.modules)) data.modules = p.modules as string[];
    if (typeof p.chapter === 'string') data.chapters = [...(data.chapters ?? []), p.chapter];
    if (typeof p.done === 'number') data.chapterDone = p.done;
    if (typeof p.total === 'number') data.chapterTotal = p.total;
    if (Array.isArray(p.projects)) data.projects = p.projects as string[];
    if (typeof p.chunks === 'number') data.chunks = p.chunks;
  }
  return data;
}

/**
 * Generating: the course being built, live. Six stages, each with its own
 * animated scene drawn from the real job events (your topic's words, your
 * concept names, your module titles). Events are stored, so leaving and
 * coming back replays them.
 */
export function GeneratingPage() {
  const { courseId } = useParams({ from: '/courses/$courseId/building' });
  const navigate = useNavigate();
  const course = useCourse(courseId);
  const jobId = course.data?.jobId ?? null;
  const job = useJob(jobId);
  const failed = job.data?.status === 'failed' || job.data?.status === 'cancelled' || course.data?.status === 'failed';
  // Continue keeps the job id; flipping `live` back on reopens the event stream.
  const { events } = useJobEvents(jobId, !failed);
  const cancel = useCancelJob();
  const resume = useResumeCourse();

  const qc = useQueryClient();
  // A build that stops at its outline ends its job without finishing the course: refetch to learn which.
  const jobStatus = job.data?.status;
  useEffect(() => {
    if (jobStatus === 'done') void qc.invalidateQueries({ queryKey: cwKeys.course(courseId) });
  }, [jobStatus, courseId, qc]);

  const reviewing = !!course.data?.outlineReady;
  const last = events[events.length - 1];
  const done = !reviewing && (last?.stage === 'done' || (job.data?.status === 'done' && course.data?.status === 'ready'));
  const stageIndex = done
    ? STAGES.length
    : reviewing
      ? STAGES.findIndex((s) => s.key === 'outline')
      : Math.max(0, STAGES.findIndex((s) => s.key === last?.stage));
  const current = STAGES[Math.min(stageIndex, STAGES.length - 1)];
  const data = useMemo(() => sceneData(course.data?.topic ?? '', events), [course.data?.topic, events]);

  // The course is ready: take the learner there after a beat.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate({ to: '/courses/$courseId', params: { courseId } }), 2500);
    return () => clearTimeout(t);
  }, [done, courseId, navigate]);

  if (course.isPending) {
    return (
      <PageShell title="Building course">
        <Loader />
      </PageShell>
    );
  }

  if (course.isError || !course.data) {
    return (
      <PageShell title="Building course">
        <ErrorState
          size="page"
          error={course.error ?? { message: 'Not found', status: 404 }}
          title="This build didn’t load"
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

  const ready = course.data.status === 'ready' && !jobId;

  return (
    <PageShell
      title={course.data.title}
      description={
        done || ready
          ? 'Your course is ready'
          : reviewing
            ? 'Review the outline: change it by asking, then write the course'
            : failed
              ? 'The build stopped'
              : `Building: ${current.blurb.toLowerCase()}`
      }
      archetype="sequence"
      breadcrumb={
        // Leaving costs nothing: the build keeps running and the page replays
        // its events when you come back.
        <AnchorLink to="/" size="sm" c="dimmed" data-back>
          ← Library
        </AnchorLink>
      }
      actions={
        done || ready ? (
          <ButtonLink to="/courses/$courseId" params={{ courseId }} rightSection={<ArrowRight size={16} />}>
            Open course
          </ButtonLink>
        ) : !failed && !reviewing && jobId ? (
          <Button
            variant="default"
            color="red"
            leftSection={<CircleStop size={16} />}
            loading={cancel.isPending}
            onClick={() => cancel.mutate(jobId)}
          >
            Stop building
          </Button>
        ) : null
      }
    >
      <Stack gap="lg">
        <Stepper active={stageIndex} size="sm" allowNextStepsSelect={false} data-progress>
          {STAGES.map((s) => (
            <Stepper.Step
              key={s.key}
              label={s.label}
              description={reviewing && s.key === 'outline' ? 'Your review' : undefined}
              loading={!done && !failed && !reviewing && s.key === current.key}
            />
          ))}
        </Stepper>

        {failed && (
          <Alert color="red" variant="light" icon={<TriangleAlert size={16} />} title="The build stopped">
            <Stack gap="sm">
              <Text size="sm">
                {job.data?.error ??
                  (job.data?.status === 'cancelled' ? 'You stopped the build' : 'The build failed without a message')}
              </Text>
              <Text size="sm" c="dimmed">
                Continue picks up where it stopped and keeps everything already written.
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  leftSection={<Play size={14} />}
                  loading={resume.isPending}
                  onClick={() => resume.mutate(courseId)}
                >
                  Continue build
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<RotateCcw size={14} />}
                  onClick={() =>
                    navigate({ to: '/new', search: { topic: course.data?.topic || course.data?.title || '' } })
                  }
                >
                  Start again
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {reviewing ? (
          <Reveal key="review">
            <OutlineReview courseId={courseId} />
          </Reveal>
        ) : (
        <Reveal>
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card withBorder radius="lg" p="lg" data-step={done || ready ? 'ready' : current.key}>
              {done || ready ? (
                <Stack align="center" gap="sm" py="xl" ta="center">
                  <ThemeIcon size={56} radius="xl" variant="light">
                    <PartyPopper size={26} />
                  </ThemeIcon>
                  <Title order={2} size="h3">
                    Ready to learn
                  </Title>
                  <Text c="dimmed" size="sm">
                    {data.modules?.length ?? 0} modules, {data.chapterTotal ?? 0} chapters and{' '}
                    {data.projects?.length ?? 0} projects. Opening it now…
                  </Text>
                </Stack>
              ) : (
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={600}>{current.label}</Text>
                    <Badge variant="light" color={failed ? 'red' : undefined} leftSection={failed ? null : <Loader size={10} />}>
                      {last?.message ?? 'Starting…'}
                    </Badge>
                  </Group>
                  <StageScene stage={current.key} data={data} height={360} live={!failed} />
                  <Text size="sm" c="dimmed">
                    {current.blurb}.
                  </Text>
                </Stack>
              )}
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card withBorder radius="lg" p={0}>
              <Text size="sm" fw={600} px="md" pt="md" pb="xs">
                What the agents did
              </Text>
              <ScrollArea h={420} px="md" pb="md">
                <Stack gap="xs">
                  {events.length === 0 && (
                    <Text size="sm" c="dimmed">
                      Waiting for the first step…
                    </Text>
                  )}
                  {[...events].reverse().map((e) => (
                    <Group key={e.seq} gap="xs" wrap="nowrap" align="flex-start">
                      <Badge size="xs" variant="default" w={72} style={{ flexShrink: 0 }}>
                        {e.stage}
                      </Badge>
                      <Text size="sm">{e.message}</Text>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea>
            </Card>
          </Grid.Col>
        </Grid>
        </Reveal>
        )}
      </Stack>
    </PageShell>
  );
}
