import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Kbd,
  Loader,
  Progress,
  Radio,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { AnchorLink } from '@/components/links';
import { Reveal } from '@/components/reveal';
import { useCreateCourse, useInterviewNext } from '@/hooks/useCoursewright';
import type { InterviewQuestion } from '@/api/types';
import type { InterviewAnswer } from '@/api/services/coursewrightService';

const MAX_QUESTIONS = 6;
const SUGGESTIONS = ['Raft consensus', 'Rust ownership and borrowing', 'How Postgres executes a query', 'Transformers from scratch'];

type Phase = 'topic' | 'asking' | 'summary';
type Answered = InterviewAnswer & { header: string };

/**
 * New course: an interview, not a form, and keyboard-first like Claude Code's
 * questions. Name a topic, answer a few questions one at a time (number keys
 * pick, Enter continues), confirm, and the build starts. One column for the
 * step, a compact record of the brief beside it, one progress bar. No uploads
 * here, by design.
 */
export function NewCoursePage() {
  const navigate = useNavigate();
  const next = useInterviewNext();
  const create = useCreateCourse();

  const [phase, setPhase] = useState<Phase>('topic');
  // "Start again" on a failed course links here with ?topic=…
  const search = useSearch({ strict: false }) as { topic?: unknown };
  const [topic, setTopic] = useState(typeof search.topic === 'string' ? search.topic : '');
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  /** Every question asked so far, aligned with `answers`, so Back can return to one without losing it. */
  const [asked, setAsked] = useState<InterviewQuestion[]>([]);
  /** The answer to prefill when Back returns to a question. */
  const [prefill, setPrefill] = useState<string[] | null>(null);
  const [briefExtras, setBriefExtras] = useState<{ level?: string; goal?: string; pace?: string }>({});
  const [reviewOutline, setReviewOutline] = useState(true);

  async function ask(nextAnswers: Answered[]) {
    // The cap is enforced here too, so a misbehaving model can never run the interview long.
    const step = await next.mutateAsync({
      topic,
      answers: nextAnswers.map(({ question: q, answer, header }) => ({ question: q, answer, header })),
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
    if (!topic.trim() || next.isPending) return;
    setAnswers([]);
    setAsked([]);
    await ask([]);
  }

  async function answer(values: string[]) {
    if (!question || next.isPending) return;
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
      reviewOutline,
    });
    await navigate({ to: '/courses/$courseId/building', params: { courseId: res.course.id } });
  }

  const progress =
    phase === 'topic' ? 4 : phase === 'summary' ? 100 : Math.min(92, ((answers.length + 1) / (MAX_QUESTIONS + 1)) * 100);
  const stepLabel =
    phase === 'topic' ? 'Topic' : phase === 'summary' ? 'Confirm' : `Question ${answers.length + 1} of up to ${MAX_QUESTIONS}`;

  return (
    <PageShell
      title="New course"
      archetype="sequence"
      breadcrumb={
        <AnchorLink to="/" size="sm" data-back>
          ← Library
        </AnchorLink>
      }
    >
      <Group align="flex-start" gap={48} wrap="nowrap">
        <Stack gap="lg" style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
          <Stack gap={6} data-progress>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {stepLabel}
              </Text>
              {next.isPending && <Loader size="xs" />}
            </Group>
            <Progress value={progress} size="xs" aria-label="Interview progress" color="brand" />
          </Stack>

          <Reveal key={`${phase}-${question?.id ?? ''}-${answers.length}`} data-step={phase}>
            {phase === 'topic' && (
              <TopicStep topic={topic} setTopic={setTopic} onStart={start} loading={next.isPending} />
            )}
            {phase === 'asking' && question && (
              <QuestionStep
                question={question}
                initial={prefill}
                loading={next.isPending}
                onAnswer={answer}
                onBack={back}
              />
            )}
            {phase === 'summary' && (
              <SummaryStep
                topic={topic}
                summary={summary}
                onBack={back}
                onGenerate={generate}
                reviewOutline={reviewOutline}
                setReviewOutline={setReviewOutline}
                generating={create.isPending}
                error={(create.error as { message?: string } | null)?.message ?? null}
              />
            )}
          </Reveal>
        </Stack>

        <Brief topic={topic} answers={answers} current={phase === 'asking' ? question?.header : undefined} />
      </Group>
    </PageShell>
  );
}

/** The brief so far: a quiet record beside the step, one line per answer. */
function Brief({ topic, answers, current }: { topic: string; answers: Answered[]; current?: string }) {
  const rows = [{ header: 'Topic', value: topic.trim() || 'Not chosen yet', muted: !topic.trim() }].concat(
    answers.map((a) => ({ header: a.header, value: a.answer.length ? a.answer.join(', ') : 'Skipped', muted: !a.answer.length }))
  );
  return (
    <Box w={300} visibleFrom="md" style={{ flexShrink: 0 }} component="aside" aria-label="Your brief">
      <Text size="sm" fw={500} mb="xs">
        Your brief
      </Text>
      <Stack gap={0}>
        {rows.map((r, i) => (
          <Box key={i} py={8} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed">
              {r.header}
            </Text>
            <Text size="sm" c={r.muted ? 'dimmed' : undefined} lineClamp={2}>
              {r.value}
            </Text>
          </Box>
        ))}
        {current && (
          <Box py={8} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed">
              {current}
            </Text>
            <Text size="sm" c="dimmed">
              Answering
            </Text>
          </Box>
        )}
      </Stack>
    </Box>
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
    <Stack gap="md">
      <Title order={2} size="h2">
        What do you want to learn?
      </Title>
      <TextInput
        size="lg"
        placeholder="A concept, a paper, a tool, a whole field"
        value={topic}
        onChange={(e) => setTopic(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onStart();
        }}
        aria-label="Topic"
        data-autofocus
        autoFocus
      />
      <Group gap={6}>
        <Text size="sm" c="dimmed">
          Try
        </Text>
        {SUGGESTIONS.map((s) => (
          <Button key={s} variant="default" size="compact-sm" fw={400} onClick={() => setTopic(s)}>
            {s}
          </Button>
        ))}
      </Group>
      <Group justify="space-between" mt="xs">
        <Text size="xs" c="dimmed">
          <Kbd size="xs">Enter</Kbd> to continue
        </Text>
        <Button onClick={onStart} loading={loading} disabled={!topic.trim()} rightSection={<ArrowRight size={16} />}>
          Continue
        </Button>
      </Group>
    </Stack>
  );
}

function QuestionStep({
  question,
  initial,
  loading,
  onAnswer,
  onBack,
}: {
  question: InterviewQuestion;
  initial?: string[] | null;
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

  const values = useMemo(() => {
    const chosen = question.multiSelect ? multi : single ? [single] : [];
    return other.trim() ? [...chosen, other.trim()] : chosen;
  }, [question.multiSelect, multi, single, other]);

  // Number keys pick an option, Enter continues — unless typing in "Something else".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing || e.metaKey || e.ctrlKey || e.altKey || loading) return;
      const n = Number(e.key);
      if (n >= 1 && n <= question.options.length) {
        const label = question.options[n - 1].label;
        if (question.multiSelect) setMulti((m) => (m.includes(label) ? m.filter((x) => x !== label) : [...m, label]));
        else setSingle(label);
        e.preventDefault();
      } else if (e.key === 'Enter' && values.length && !(e.target instanceof HTMLButtonElement)) {
        // A focused button (Next, Skip, an option card) handles Enter itself; answering here too would submit twice.
        onAnswer(values);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, values, loading, onAnswer]);

  const option = (o: InterviewQuestion['options'][number], i: number) => (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      <Kbd size="xs" mt={2} style={{ flexShrink: 0 }}>
        {i + 1}
      </Kbd>
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs">
          <Text fw={500} size="sm">
            {o.label}
          </Text>
          {o.recommended && (
            <Text size="xs" c="dimmed">
              Recommended
            </Text>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          {o.description}
        </Text>
      </Stack>
      {question.multiSelect ? <Checkbox.Indicator mt={2} /> : <Radio.Indicator mt={2} />}
    </Group>
  );

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          {question.header}
          {question.multiSelect ? ' · choose any that apply' : ''}
        </Text>
        <Title order={2} size="h2">
          {question.question}
        </Title>
      </Stack>

      {question.multiSelect ? (
        <Checkbox.Group value={multi} onChange={setMulti}>
          <Stack gap={8}>
            {question.options.map((o, i) => (
              <Checkbox.Card key={o.label} value={o.label} radius="md" px="md" py={12}>
                {option(o, i)}
              </Checkbox.Card>
            ))}
          </Stack>
        </Checkbox.Group>
      ) : (
        <Radio.Group value={single} onChange={setSingle}>
          <Stack gap={8}>
            {question.options.map((o, i) => (
              <Radio.Card key={o.label} value={o.label} radius="md" px="md" py={12}>
                {option(o, i)}
              </Radio.Card>
            ))}
          </Stack>
        </Radio.Group>
      )}

      <TextInput
        placeholder="Something else"
        value={other}
        onChange={(e) => setOther(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && values.length) onAnswer(values);
        }}
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
          <Button onClick={() => onAnswer(values)} loading={loading} disabled={values.length === 0} rightSection={<ArrowRight size={16} />}>
            Next
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

function SummaryStep({
  topic,
  summary,
  onBack,
  onGenerate,
  reviewOutline,
  setReviewOutline,
  generating,
  error,
}: {
  topic: string;
  summary: string | null;
  onBack: () => void;
  onGenerate: () => void;
  reviewOutline: boolean;
  setReviewOutline: (v: boolean) => void;
  generating: boolean;
  error: string | null;
}) {
  return (
    <Stack gap="md">
      <Title order={2} size="h2">
        Ready to build “{topic}”
      </Title>
      {summary && <Text>{summary}</Text>}
      <Divider />
      <Text size="sm" c="dimmed">
        Agents research the topic, map its concepts, write the chapters with diagrams, design a project per
        module and index everything for the tutor. It takes a few minutes, and you can leave and come back.
      </Text>
      <Checkbox
        checked={reviewOutline}
        onChange={(e) => setReviewOutline(e.currentTarget.checked)}
        label="Let me review the outline before it’s written"
        description="The build stops at the outline so you can add, remove or reorder chapters by asking."
      />
      {error && (
        <Alert color="red" variant="light" title="Could not start the build">
          {error}
        </Alert>
      )}
      <Group justify="space-between">
        <UnstyledButton onClick={onBack} data-back>
          <Group gap={6}>
            <ArrowLeft size={16} />
            <Text size="sm">Change an answer</Text>
          </Group>
        </UnstyledButton>
        <Button onClick={onGenerate} loading={generating} rightSection={<ArrowRight size={16} />}>
          Generate course
        </Button>
      </Group>
    </Stack>
  );
}
