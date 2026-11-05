/**
 * How the tutor's tool calls look inside the chat, and the frontend tools that
 * act on the page.
 *
 * Backend tools (run in the Python agent; we only draw their results):
 *   search_course -> { hits: [{ n, chunkId, title, chapterId, courseId, text }] }  the [n] citations
 *   make_flow     -> { kind: 'flow' | 'mermaid', title, source }                  a checked movie or diagram
 *   make_quiz     -> { questions: [{ prompt, options, answer, explanation, chapterId }] }
 * Frontend tools (run here): highlight_passage, start_quiz.
 */
import { useState } from 'react';
import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';
import { Alert, Anchor, Badge, Button, Card, Collapse, Group, Loader, Radio, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useRenderTool, useFrontendTool } from '@copilotkit/react-core/v2';
import { BookOpen, Clapperboard, ListChecks, NotebookPen } from 'lucide-react';
import { FlowPlayer } from '@/components/diagrams/FlowPlayer';
import { MermaidDiagram } from '@/components/diagrams/MermaidDiagram';
import { AnchorLink } from '@/components/links';
import { useCreateNote } from '@/hooks/useCoursewright';
import { toast } from '@/lib/notify';
import { useTutor } from './tutorStore';

interface Hit {
  n: number;
  chunkId: string;
  title: string;
  chapterId: string | null;
  courseId: string | null;
  text: string;
}
interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  chapterId?: string | null;
}
interface Diagram {
  kind: 'flow' | 'mermaid';
  title: string;
  source: string;
}

/** Tool results arrive as strings; the agent writes JSON. Anything else is shown as nothing. */
function parse<T>(result: unknown): T | null {
  if (result && typeof result === 'object') return result as T;
  if (typeof result !== 'string') return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    return null;
  }
}

const anyArgs = z.record(z.string(), z.unknown());

export function TutorToolRenderers() {
  useRenderTool({
    name: 'search_course',
    parameters: anyArgs,
    render: ({ status, parameters, result }) =>
      status !== 'complete' ? (
        <Working label={`Searching the course for “${String(parameters.query ?? '')}”`} />
      ) : (
        <Citations hits={parse<{ hits: Hit[] }>(result)?.hits ?? []} />
      ),
  });

  useRenderTool({
    name: 'make_flow',
    parameters: anyArgs,
    render: ({ status, result }) =>
      status !== 'complete' ? (
        <Working label="Drawing it as a movie" />
      ) : (
        <DiagramCard diagram={parse<Diagram>(result)} />
      ),
  });

  useRenderTool({
    name: 'make_quiz',
    parameters: anyArgs,
    render: ({ status, result }) =>
      status !== 'complete' ? (
        <Working label="Writing questions" />
      ) : (
        <Quiz questions={parse<{ questions: QuizQuestion[] }>(result)?.questions ?? []} />
      ),
  });

  return null;
}

/** Frontend tools: the tutor points at a passage, or hands the learner a quiz. */
export function TutorPageTools() {
  const navigate = useNavigate();
  const courseId = useTutor((s) => s.courseId);

  useFrontendTool(
    {
      name: 'highlight_passage',
      description:
        'Open a chapter and highlight a short passage in it (copy 3–12 words exactly from a search_course hit).',
      parameters: z.object({ chapterId: z.string(), text: z.string(), courseId: z.string().optional() }),
      handler: async ({ chapterId, text, courseId: c }) => {
        const course = c ?? courseId;
        if (!course) return 'No course in context; pass courseId.';
        useTutor.getState().setHighlight(text);
        await navigate({
          to: '/courses/$courseId/chapters/$chapterId',
          params: { courseId: course, chapterId },
        });
        return 'Opened and highlighted.';
      },
    },
    [navigate, courseId]
  );

  useFrontendTool({
    name: 'start_quiz',
    description: 'Show the learner a quiz in a dialog. Pass the questions from make_quiz.',
    parameters: z.object({
      questions: z.array(
        z.object({
          prompt: z.string(),
          options: z.array(z.string()),
          answer: z.number(),
          explanation: z.string(),
        })
      ),
    }),
    handler: async ({ questions }) => {
      modals.open({ title: 'Quick quiz', size: 'lg', children: <Quiz questions={questions} /> });
      return `Quiz with ${questions.length} questions shown.`;
    },
  });

  return null;
}

function Working({ label }: { label: string }) {
  return (
    <Group gap="xs" py={4}>
      <Loader size="xs" />
      <Text size="sm" c="dimmed">
        {label}…
      </Text>
    </Group>
  );
}

function Citations({ hits }: { hits: Hit[] }) {
  const [open, setOpen] = useState(false);
  if (hits.length === 0)
    return (
      <Text size="xs" c="dimmed">
        Searched the course: nothing relevant.
      </Text>
    );
  return (
    <Card withBorder radius="md" p="xs" my={4}>
      <Anchor component="button" type="button" size="xs" onClick={() => setOpen((o) => !o)}>
        <Group gap={6}>
          <BookOpen size={12} />
          {hits.length} passages from your course {open ? '▴' : '▾'}
        </Group>
      </Anchor>
      <Collapse expanded={open}>
        <Stack gap={6} mt="xs">
          {hits.map((h) => (
            <Stack key={h.chunkId} gap={0}>
              <Group gap={6} wrap="nowrap">
                <Badge size="xs" variant="light" style={{ flexShrink: 0 }}>
                  {h.n}
                </Badge>
                {h.courseId && h.chapterId ? (
                  <AnchorLink
                    size="xs"
                    to="/courses/$courseId/chapters/$chapterId"
                    params={{ courseId: h.courseId, chapterId: h.chapterId }}
                    truncate
                  >
                    {h.title}
                  </AnchorLink>
                ) : (
                  <Text size="xs" truncate>
                    {h.title}
                  </Text>
                )}
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {h.text}
              </Text>
            </Stack>
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}

function DiagramCard({ diagram }: { diagram: Diagram | null }) {
  const createNote = useCreateNote();
  const { courseId, chapterId } = useTutor();
  if (!diagram)
    return (
      <Alert color="red" variant="light">
        The diagram couldn't be made.
      </Alert>
    );
  return (
    <Card withBorder radius="md" p="sm" my={4}>
      <Group justify="space-between" mb="xs">
        <Group gap={6}>
          <Clapperboard size={14} />
          <Text size="sm" fw={600}>
            {diagram.title}
          </Text>
        </Group>
        <Button
          size="compact-xs"
          variant="subtle"
          leftSection={<NotebookPen size={12} />}
          loading={createNote.isPending}
          onClick={async () => {
            await createNote.mutateAsync({
              title: diagram.title,
              icon: '',
              markdown: `\`\`\`${diagram.kind}\n${diagram.source.trim()}\n\`\`\`\n`,
              courseId,
              chapterId,
            });
            toast.success('Saved to notes');
          }}
        >
          Save to notes
        </Button>
      </Group>
      {diagram.kind === 'flow' ? <FlowPlayer source={diagram.source} /> : <MermaidDiagram source={diagram.source} />}
    </Card>
  );
}

function Quiz({ questions }: { questions: QuizQuestion[] }) {
  if (questions.length === 0)
    return (
      <Text size="xs" c="dimmed">
        No questions came back.
      </Text>
    );
  return (
    <Stack gap="sm" my={4}>
      <Group gap={6}>
        <ListChecks size={14} />
        <Text size="sm" fw={600}>
          {questions.length} questions
        </Text>
      </Group>
      {questions.map((q, i) => (
        <QuizItem key={i} q={q} index={i + 1} />
      ))}
    </Stack>
  );
}

function QuizItem({ q, index }: { q: QuizQuestion; index: number }) {
  const [chosen, setChosen] = useState<string>('');
  const answered = chosen !== '';
  const right = answered && Number(chosen) === q.answer;
  return (
    <Card withBorder radius="md" p="sm">
      <Text size="sm" fw={500} mb="xs">
        {index}. {q.prompt}
      </Text>
      <Radio.Group value={chosen} onChange={setChosen}>
        <Stack gap={4}>
          {q.options.map((o, i) => (
            <Radio key={i} value={String(i)} label={o} size="xs" disabled={answered} />
          ))}
        </Stack>
      </Radio.Group>
      {answered && (
        <Alert mt="xs" variant="light" color={right ? 'green' : 'red'} title={right ? 'Right' : 'Not quite'} p="xs">
          <Text size="xs">{q.explanation}</Text>
        </Alert>
      )}
    </Card>
  );
}
