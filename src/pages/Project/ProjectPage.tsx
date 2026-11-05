import { useEffect, useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Code,
  CopyButton,
  ActionIcon,
  Grid,
  Group,
  Loader,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useParams } from '@tanstack/react-router';
import { Check, Copy, FileCode2, Github, Lightbulb, Send, Wrench, CircleCheck } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { AnchorLink } from '@/components/links';
import { MarkdownView } from '@/components/MarkdownView';
import { useProject, useSubmission, useSubmitProject, useToggleMilestone } from '@/hooks/useCoursewright';
import { useTutor } from '@/copilot/tutorStore';
import type { Finding, Project, Submission } from '@/api/types';

const FINDING = {
  pass: { color: 'green', label: 'Pass', icon: CircleCheck },
  fix: { color: 'red', label: 'Fix', icon: Wrench },
  idea: { color: 'blue', label: 'Idea', icon: Lightbulb },
} as const;

/**
 * Project: the brief, milestones you tick off (each with the command that says
 * you're done), hints revealed one at a time, the rubric, and code review of
 * your repo against it, with every finding linked back to a chapter.
 */
export function ProjectPage() {
  const { courseId, projectId } = useParams({ from: '/courses/$courseId/projects/$projectId' });
  const project = useProject(projectId);
  const setContext = useTutor((s) => s.setContext);

  useEffect(() => {
    setContext({ courseId, chapterId: null, noteId: null, selection: null });
  }, [courseId, setContext]);

  if (project.isPending) {
    return (
      <PageShell title="Loading project…">
        <Skeleton h={300} radius="lg" />
      </PageShell>
    );
  }
  if (project.isError || !project.data) {
    return (
      <PageShell title="Project">
        <Alert color="red" title="Could not load this project">
          {(project.error as { message?: string } | null)?.message ?? 'Not found.'}
        </Alert>
      </PageShell>
    );
  }
  const p = project.data;
  const done = p.milestones.filter((m) => m.doneAt).length;

  return (
    <PageShell
      title={p.title}
      archetype="detail"
      breadcrumb={
        <Breadcrumbs separator="›">
          <AnchorLink to="/courses/$courseId" params={{ courseId }} size="sm" c="dimmed">
            {p.courseTitle}
          </AnchorLink>
          <Text size="sm" c="dimmed">
            {p.moduleTitle}
          </Text>
        </Breadcrumbs>
      }
      actions={
        <Badge size="lg" variant="light">
          {done} of {p.milestones.length} milestones
        </Badge>
      }
    >
      <Reveal>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" p="lg" data-section="brief">
              <MarkdownView key={p.id} markdown={p.brief} label="Project brief" />
            </Card>
            <Milestones project={p} />
            <Hints project={p} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" p="lg" data-section="starter">
              <Text fw={600} mb="sm">
                Starter layout
              </Text>
              <Stack gap="xs">
                {p.starter.map((f) => (
                  <Group key={f.path} gap="sm" wrap="nowrap" align="flex-start">
                    <FileCode2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <Stack gap={0}>
                      <Code>{f.path}</Code>
                      <Text size="xs" c="dimmed">
                        {f.note}
                      </Text>
                    </Stack>
                  </Group>
                ))}
              </Stack>
            </Card>
            <Card withBorder radius="lg" p="lg" data-section="rubric">
              <Text fw={600} mb="sm">
                Rubric
              </Text>
              <Stack gap="xs">
                {p.rubric.map((r) => (
                  <Group key={r.criterion} justify="space-between" wrap="nowrap" align="flex-start">
                    <Text size="sm">{r.criterion}</Text>
                    {r.chapterId && (
                      <AnchorLink
                        size="xs"
                        to="/courses/$courseId/chapters/$chapterId"
                        params={{ courseId, chapterId: r.chapterId }}
                        style={{ flexShrink: 0 }}
                      >
                        Chapter
                      </AnchorLink>
                    )}
                  </Group>
                ))}
              </Stack>
            </Card>
            <Review project={p} courseId={courseId} />
          </Stack>
        </Grid.Col>
      </Grid>
      </Reveal>
    </PageShell>
  );
}

function Milestones({ project }: { project: Project }) {
  const toggle = useToggleMilestone(project.id);
  return (
    <Card withBorder radius="lg" p="lg" data-section="milestones">
      <Title order={2} size="h4" mb="md">
        Milestones
      </Title>
      <Stack gap="md">
        {project.milestones.map((m) => (
          <Group key={m.id} wrap="nowrap" align="flex-start" gap="md">
            <Checkbox
              mt={2}
              checked={!!m.doneAt}
              onChange={(e) => toggle.mutate({ id: m.id, done: e.currentTarget.checked })}
              aria-label={`Mark “${m.title}” done`}
            />
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} td={m.doneAt ? 'line-through' : undefined} c={m.doneAt ? 'dimmed' : undefined}>
                {m.position}. {m.title}
              </Text>
              <Text size="sm" c="dimmed">
                {m.body}
              </Text>
              {m.checkCmd && (
                <Group gap={4} wrap="nowrap">
                  <Code>{m.checkCmd}</Code>
                  <CopyButton value={m.checkCmd}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy command'}>
                        <ActionIcon size="sm" variant="subtle" onClick={copy} aria-label="Copy command">
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              )}
            </Stack>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

function Hints({ project }: { project: Project }) {
  const [shown, setShown] = useState(0);
  if (project.hints.length === 0) return null;
  return (
    <Card withBorder radius="lg" p="lg" data-section="hints">
      <Group justify="space-between" mb="sm">
        <Title order={2} size="h4">
          Hints
        </Title>
        <Text size="xs" c="dimmed">
          {shown} of {project.hints.length} shown
        </Text>
      </Group>
      <Stack gap="sm">
        {project.hints.slice(0, shown).map((h, i) => (
          <Alert key={i} variant="light" icon={<Lightbulb size={16} />} title={`Hint ${i + 1}`}>
            {h}
          </Alert>
        ))}
        {shown < project.hints.length && (
          <Button variant="default" onClick={() => setShown(shown + 1)} leftSection={<Lightbulb size={16} />}>
            {shown === 0 ? 'Stuck? Show the first hint' : 'Show the next hint'}
          </Button>
        )}
      </Stack>
    </Card>
  );
}

function Review({ project, courseId }: { project: Project; courseId: string }) {
  const submit = useSubmitProject(project.id);
  const [repoUrl, setRepoUrl] = useState(project.submissions[0]?.repoUrl ?? '');
  const [milestoneId, setMilestoneId] = useState<string | null>(
    project.milestones.find((m) => !m.doneAt)?.id ?? project.milestones[0]?.id ?? null
  );
  const [focus, setFocus] = useState('');
  const [latestId, setLatestId] = useState<string | null>(null);
  const valid = /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(repoUrl.trim());

  return (
    <Card withBorder radius="lg" p="lg" data-section="review">
      <Group gap="xs" mb="sm">
        <Github size={16} />
        <Text fw={600}>Review my code</Text>
      </Group>
      <Stack gap="sm">
        <TextInput
          label="Public GitHub repo"
          placeholder="https://github.com/you/raft"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.currentTarget.value)}
          error={repoUrl && !valid ? 'A github.com repository URL' : undefined}
        />
        <Select
          label="Milestone"
          data={project.milestones.map((m) => ({ value: m.id, label: `${m.position}. ${m.title}` }))}
          value={milestoneId}
          onChange={setMilestoneId}
        />
        <TextInput
          label="Anything to focus on?"
          placeholder="e.g. my election timer"
          value={focus}
          onChange={(e) => setFocus(e.currentTarget.value)}
        />
        <Button
          leftSection={<Send size={16} />}
          disabled={!valid}
          loading={submit.isPending}
          onClick={async () => {
            const s = await submit.mutateAsync({ repoUrl: repoUrl.trim(), milestoneId, focus });
            setLatestId(s.id);
          }}
        >
          Request review
        </Button>
        <Text size="xs" c="dimmed">
          The reviewer reads your code through the GitHub API against the rubric. It doesn't run anything.
        </Text>
      </Stack>

      {(latestId || project.submissions.length > 0) && (
        <Accordion mt="md" variant="contained" radius="md" defaultValue={latestId ?? project.submissions[0]?.id}>
          {latestId && !project.submissions.some((s) => s.id === latestId) && (
            <LiveSubmission id={latestId} courseId={courseId} />
          )}
          {project.submissions.map((s) => (
            <SubmissionItem key={s.id} submission={s} courseId={courseId} />
          ))}
        </Accordion>
      )}
    </Card>
  );
}

function LiveSubmission({ id, courseId }: { id: string; courseId: string }) {
  const sub = useSubmission(id);
  if (!sub.data) return null;
  return <SubmissionItem submission={sub.data} courseId={courseId} />;
}

function SubmissionItem({ submission, courseId }: { submission: Submission; courseId: string }) {
  const live = useSubmission(submission.status === 'done' || submission.status === 'failed' ? null : submission.id);
  const s = live.data ?? submission;
  return (
    <Accordion.Item value={s.id}>
      <Accordion.Control>
        <Group justify="space-between" wrap="nowrap" pr="xs">
          <Text size="sm" truncate>
            {s.repoUrl.replace('https://github.com/', '')}
          </Text>
          {s.status === 'done' ? (
            <Badge size="sm" variant="light" color="green">
              Reviewed
            </Badge>
          ) : s.status === 'failed' ? (
            <Badge size="sm" variant="light" color="red">
              Failed
            </Badge>
          ) : (
            <Badge size="sm" variant="light" leftSection={<Loader size={8} />}>
              Reviewing
            </Badge>
          )}
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        {s.error && (
          <Alert color="red" variant="light" mb="sm">
            {s.error}
          </Alert>
        )}
        <Stack gap="sm">
          {s.findings.map((f, i) => (
            <FindingRow key={i} finding={f} courseId={courseId} />
          ))}
          {s.status !== 'done' && s.status !== 'failed' && (
            <Text size="sm" c="dimmed">
              Reading your repository…
            </Text>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function FindingRow({ finding, courseId }: { finding: Finding; courseId: string }) {
  const kind = FINDING[finding.kind];
  const Icon = kind.icon;
  return (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      <Badge color={kind.color} variant="light" leftSection={<Icon size={12} />} w={72} style={{ flexShrink: 0 }}>
        {kind.label}
      </Badge>
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          {finding.title}
        </Text>
        <Text size="sm" c="dimmed">
          {finding.body}
        </Text>
        {finding.chapterId && (
          <AnchorLink
            size="xs"
            to="/courses/$courseId/chapters/$chapterId"
            params={{ courseId, chapterId: finding.chapterId }}
          >
            Read the chapter
          </AnchorLink>
        )}
      </Stack>
    </Group>
  );
}
