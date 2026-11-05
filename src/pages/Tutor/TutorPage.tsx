import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, Grid, Select, Stack, Text } from '@mantine/core';
import { MessageSquarePlus, TriangleAlert } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { TutorChat } from '@/copilot/TutorCopilot';
import { useTutor } from '@/copilot/tutorStore';
import { useCourses, useHealth } from '@/hooks/useCoursewright';

const STARTERS = [
  'Quiz me on what I read this week',
  'What should I learn next, and why?',
  'Explain the hardest idea in this course with an analogy',
  'Show me the most important process as a movie',
];

/**
 * The full tutor: the same deep agent as the side panel, with room to think.
 * Pick a course to scope retrieval; answers cite the chapters they come from.
 */
export function TutorPage() {
  const courses = useCourses();
  const health = useHealth();
  const { courseId, setContext, ask, closePanel } = useTutor();
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    closePanel();
    setContext({ chapterId: null, noteId: null, selection: null });
  }, [closePanel, setContext]);

  const ready = (courses.data ?? []).filter((c) => c.status === 'ready');

  return (
    <PageShell
      title="Tutor"
      description="Ask anything. It answers from your courses and notes, and says when they don't cover it."
      // `detail`: one subject — the conversation — with its scope and starters
      // beside it. There is no collection here to be a list-detail master.
      archetype="detail"
      scroll={false}
      actions={
        <Button variant="default" leftSection={<MessageSquarePlus size={16} />} onClick={() => setThreadId(crypto.randomUUID())}>
          New conversation
        </Button>
      }
    >
      <Grid gap="lg" h="100%" styles={{ inner: { height: '100%' } }}>
        <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
          <Reveal>
          <Stack component="section" gap="md" data-section="scope" aria-label="Scope and starters">
            {health.data && !health.data.anthropic && (
              <Alert variant="light" color="yellow" icon={<TriangleAlert size={16} />}>
                The agent service has no <code>ANTHROPIC_API_KEY</code>, so the tutor can't answer yet.
              </Alert>
            )}
            <Select
              label="Scope"
              placeholder="All courses"
              clearable
              data={ready.map((c) => ({ value: c.id, label: c.title }))}
              value={courseId}
              onChange={(v) => setContext({ courseId: v })}
            />
            <Card withBorder radius="lg" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                Try asking
              </Text>
              <Stack gap={6}>
                {STARTERS.map((s) => (
                  <Button
                    key={s}
                    variant="subtle"
                    justify="flex-start"
                    size="sm"
                    h="auto"
                    py={6}
                    onClick={() => ask(s)}
                    styles={{ label: { whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.4 } }}
                  >
                    {s}
                  </Button>
                ))}
              </Stack>
            </Card>
          </Stack>
          </Reveal>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8, lg: 9 }} h="100%">
          <Card withBorder radius="lg" p={0} h="100%" style={{ overflow: 'hidden' }} data-section="conversation" aria-label="Conversation">
            <Box h="100%" style={{ minHeight: 480 }}>
              <TutorChat key={threadId} threadId={threadId} />
            </Box>
          </Card>
        </Grid.Col>
      </Grid>
    </PageShell>
  );
}
