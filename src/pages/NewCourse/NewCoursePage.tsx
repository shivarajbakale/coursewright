import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Kbd,
  Loader,
  Progress,
  Radio,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check, Sparkles, Wand2 } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { AnchorLink } from '@/components/links';
import { Reveal } from '@/components/reveal';
import { useCreateCourse, useInterviewNext } from '@/hooks/useCoursewright';
import type { InterviewQuestion } from '@/api/types';
import type { InterviewAnswer } from '@/api/services/coursewrightService';

const MAX_QUESTIONS = 6;
const SUGGESTIONS = ['Raft consensus', 'Rust ownership and borrowing', 'How Postgres executes a query', 'Transformers from scratch'];

type Phase = 'topic' | 'asking' | 'summary';
const PHASES: Phase[] = ['topic', 'asking', 'summary'];

/**
 * New course: an interview, not a form. You name a topic; the interviewer asks
 * a few questions one at a time (like Claude Code's AskUserQuestion), each
 * with described options and one recommended; then you confirm and the build
 * starts. No uploads here, by design.
 */
export function NewCoursePage() {
  const navigate = useNavigate();
  const next = useInterviewNext();
  const create = useCreateCourse();

  const [phase, setPhase] = useState<Phase>('topic');
  const [topic, setTopic] = useState('');
  const [answers, setAnswers] = useState<(InterviewAnswer & { header: string })[]>([]);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  /** Every question asked so far, aligned with `answers`, so Back can return to one without losing it. */
  const [asked, setAsked] = useState<InterviewQuestion[]>([]);
  /** The answer to prefill when Back returns to a question. */
  const [prefill, setPrefill] = useState<string[] | null>(null);
  const [briefExtras, setBriefExtras] = useState<{ level?: string; goal?: string; pace?: string }>({});

  async function ask(nextAnswers: (InterviewAnswer & { header: string })[]) {
    const step = await next.mutateAsync({
      topic,
      answers: nextAnswers.map(({ question: q, answer }) => ({ question: q, answer })),
    });
    if (step.done || !step.question || nextAnswers.length >= MAX_QUESTIONS) {
      setQuestion(null);
      setSummary(step.summary);
      setBriefExtras({ level: step.level, goal: step.goal, pace: step.pace });
      setPhase('summary');
    } else {
      setQuestion(step.question);
      setAsked((prev) => [...prev.slice(0, nextAnswers.length), step.question!]);
      setPrefill(null);
      setPhase('asking');
    }
  }

  async function start() {
    if (!topic.trim()) return;
    setAnswers([]);
    setAsked([]);
    await ask([]);
  }

  async function answer(values: string[]) {
    if (!question) return;
    const nextAnswers = [...answers, { question: question.question, header: question.header, answer: values }];
    setAnswers(nextAnswers);
    await ask(nextAnswers);
  }

  /** Back returns to the previous question with its answer still chosen; nothing is re-asked or lost. */
  function back() {
    if (answers.length === 0) {
      setPhase('topic');
      setQuestion(null);
      return;
    }
    const last = answers[answers.length - 1];
    setAnswers(answers.slice(0, -1));
    setQuestion(asked[answers.length - 1] ?? null);
    setPrefill(last.answer);
    setPhase('asking');
  }

  async function generate() {
    const res = await create.mutateAsync({
      topic: topic.trim(),
      answers: answers.map(({ question: q, answer: a }) => ({ question: q, answer: a })),
      ...briefExtras,
    });
    await navigate({ to: '/courses/$courseId/building', params: { courseId: res.course.id } });
  }

  return (
    <PageShell
      title="New course"
      description="A few questions first, so the course fits you."
      archetype="sequence"
      breadcrumb={
        <AnchorLink to="/" size="sm" c="dimmed" data-back>
          ← Library
        </AnchorLink>
      }
    >
      <Stack gap="lg" maw={1100}>
      {/* Three phases, always: the interview's own length is shown inside the
          question step ("Question 2 of up to 6"). */}
      <Stepper active={PHASES.indexOf(phase)} size="sm" allowNextStepsSelect={false} data-progress>
        <Stepper.Step label="Topic" />
        <Stepper.Step label="Questions" />
        <Stepper.Step label="Confirm" />
      </Stepper>
      <Grid gap="xl">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Reveal key={phase} data-step={phase}>
          {phase === 'topic' && (
            <TopicStep topic={topic} setTopic={setTopic} onStart={start} loading={next.isPending} />
          )}
          {phase === 'asking' && question && (
            <QuestionCard
              key={question.id + answers.length}
              question={question}
              initial={prefill}
              index={answers.length + 1}
              loading={next.isPending}
              onAnswer={answer}
              onBack={back}
            />
          )}
          {phase === 'asking' && !question && <Loader />}
          {phase === 'summary' && (
            <SummaryCard
              topic={topic}
              summary={summary}
              answers={answers}
              onBack={back}
              onGenerate={generate}
              generating={create.isPending}
              error={(create.error as { message?: string } | null)?.message ?? null}
            />
          )}
          </Reveal>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="lg" p="lg">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
              Your brief
            </Text>
            <Timeline active={answers.length + (topic && phase !== 'topic' ? 0 : -1)} bulletSize={20} lineWidth={2}>
              <Timeline.Item title="Topic" bullet={<Check size={12} />}>
                <Text size="sm" c={topic ? undefined : 'dimmed'}>
                  {topic || 'Not chosen yet'}
                </Text>
              </Timeline.Item>
              {answers.map((a) => (
                <Timeline.Item key={a.question} title={a.header} bullet={<Check size={12} />}>
                  <Text size="sm">{a.answer.length ? a.answer.join(', ') : 'Skipped'}</Text>
                </Timeline.Item>
              ))}
              {phase === 'asking' && question && (
                <Timeline.Item title={question.header} lineVariant="dashed">
                  <Text size="sm" c="dimmed">
                    Answering…
                  </Text>
                </Timeline.Item>
              )}
            </Timeline>
          </Card>
        </Grid.Col>
      </Grid>
      </Stack>
    </PageShell>
  );
}

function TopicStep({
  topic,
  setTopic,
  onStart,
  loading,
}: {
  topic: string;
  setTopic: (t: string) => void;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="lg">
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" variant="light">
            <Sparkles size={18} />
          </ThemeIcon>
          <Title order={2} size="h3">
            What do you want to learn?
          </Title>
        </Group>
        <Textarea
          autosize
          minRows={2}
          size="md"
          placeholder="A concept, a paper, a tool, a whole field…"
          value={topic}
          onChange={(e) => setTopic(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onStart();
          }}
          aria-label="Topic"
          data-autofocus
        />
        <Group gap="xs">
          {SUGGESTIONS.map((s) => (
            <Button key={s} variant="default" size="xs" radius="xl" fw={500} onClick={() => setTopic(s)}>
              {s}
            </Button>
          ))}
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            <Kbd size="xs">⌘</Kbd> <Kbd size="xs">Enter</Kbd> to continue
          </Text>
          <Button onClick={onStart} loading={loading} disabled={!topic.trim()} rightSection={<ArrowRight size={16} />}>
            Continue
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function QuestionCard({
  question,
  index,
  loading,
  onAnswer,
  onBack,
  initial,
}: {
  question: InterviewQuestion;
  initial?: string[] | null;
  index: number;
  loading: boolean;
  onAnswer: (values: string[]) => void;
  onBack: () => void;
}) {
  const recommended = question.options.filter((o) => o.recommended).map((o) => o.label);
  const labels = new Set(question.options.map((o) => o.label));
  // Returning via Back: restore what was chosen, including a typed "other".
  const start = initial ?? recommended;
  const [single, setSingle] = useState<string>(start.find((v) => labels.has(v)) ?? '');
  const [multi, setMulti] = useState<string[]>(start.filter((v) => labels.has(v)));
  const [other, setOther] = useState(initial?.find((v) => !labels.has(v)) ?? '');

  const chosen = question.multiSelect ? multi : single ? [single] : [];
  const values = other.trim() ? [...chosen.filter((v) => v !== '__other'), other.trim()] : chosen.filter((v) => v !== '__other');

  const option = (o: InterviewQuestion['options'][number]) => (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      {question.multiSelect ? <Checkbox.Indicator mt={2} /> : <Radio.Indicator mt={2} />}
      <Stack gap={2} style={{ flex: 1 }}>
        <Group gap="xs">
          <Text fw={600} size="sm">
            {o.label}
          </Text>
          {o.recommended && (
            <Badge size="xs" variant="light">
              Recommended
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          {o.description}
        </Text>
      </Stack>
    </Group>
  );

  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="lg">
        <Stack gap={6}>
          <Group justify="space-between">
            <Badge variant="light" radius="sm">
              {question.header}
            </Badge>
            <Text size="xs" c="dimmed">
              Question {index} of up to {MAX_QUESTIONS}
            </Text>
          </Group>
          <Progress value={(index / MAX_QUESTIONS) * 100} size="xs" aria-label="Interview progress" />
        </Stack>
        <Title order={2} size="h3">
          {question.question}
        </Title>
        {question.multiSelect && (
          <Text size="sm" c="dimmed">
            Choose any that apply.
          </Text>
        )}

        {question.multiSelect ? (
          <Checkbox.Group value={multi} onChange={setMulti}>
            <Stack gap="xs">
              {question.options.map((o) => (
                <Checkbox.Card key={o.label} value={o.label} radius="md" p="md">
                  {option(o)}
                </Checkbox.Card>
              ))}
            </Stack>
          </Checkbox.Group>
        ) : (
          <Radio.Group value={single} onChange={setSingle}>
            <Stack gap="xs">
              {question.options.map((o) => (
                <Radio.Card key={o.label} value={o.label} radius="md" p="md">
                  {option(o)}
                </Radio.Card>
              ))}
            </Stack>
          </Radio.Group>
        )}

        <TextInput
          placeholder="Something else? Type it here"
          value={other}
          onChange={(e) => setOther(e.currentTarget.value)}
          aria-label="Other answer"
        />

        <Group justify="space-between">
          <Button variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />} onClick={onBack} disabled={loading} data-back>
            Back
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={() => onAnswer([])} disabled={loading}>
              Skip
            </Button>
            <Button
              onClick={() => onAnswer(values)}
              loading={loading}
              disabled={values.length === 0}
              rightSection={<ArrowRight size={16} />}
            >
              Next
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}

function SummaryCard({
  topic,
  summary,
  answers,
  onBack,
  onGenerate,
  generating,
  error,
}: {
  topic: string;
  summary: string | null;
  answers: (InterviewAnswer & { header: string })[];
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
}) {
  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="lg">
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" variant="light">
            <Wand2 size={18} />
          </ThemeIcon>
          <Title order={2} size="h3">
            Ready to build “{topic}”
          </Title>
        </Group>
        {summary && <Text>{summary}</Text>}
        <Stack gap="xs">
          {answers.map((a) => (
            <Group key={a.question} gap="sm" wrap="nowrap" align="flex-start">
              <Badge variant="default" radius="sm" w={84} style={{ flexShrink: 0 }}>
                {a.header}
              </Badge>
              <Text size="sm">{a.answer.length ? a.answer.join(', ') : 'Skipped: the agents will choose'}</Text>
            </Group>
          ))}
        </Stack>
        <Text size="sm" c="dimmed">
          Agents will research the topic, map its concepts, write the chapters with diagrams, design a project per
          module and index everything for the tutor. It takes a few minutes; you can leave and come back.
        </Text>
        {error && (
          <Alert color="red" variant="light" title="Could not start the build">
            {error}
          </Alert>
        )}
        <Group justify="space-between">
          <Button variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />} onClick={onBack} data-back>
            Change an answer
          </Button>
          <Button onClick={onGenerate} loading={generating} leftSection={<Sparkles size={16} />}>
            Generate course
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
