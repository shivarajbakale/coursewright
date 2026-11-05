import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, Group, Select, Stack, Text } from '@mantine/core';
import { MessageSquarePlus, TriangleAlert } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Reveal } from '@/components/reveal';
import { TutorChat } from '@/copilot/TutorCopilot';
import { useTutor } from '@/copilot/tutorStore';
import { useCourses, useHealth } from '@/hooks/useCoursewright';

/**
 * The full tutor: the same deep agent as the side panel, with room to think.
 * One wide conversation; the scope sits in the header, and the starter
 * questions live in the empty conversation itself.
 */
export function TutorPage() {
  const courses = useCourses();
  const health = useHealth();
  const { courseId, setContext, closePanel } = useTutor();
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
      // `detail`: one subject, the conversation. There is no collection here
      // to be a list-detail master.
      archetype="detail"
      scroll={false}
      actions={
        <Button variant="default" leftSection={<MessageSquarePlus size={16} />} onClick={() => setThreadId(crypto.randomUUID())}>
          New conversation
        </Button>
      }
    >
      <Reveal style={{ height: '100%', minHeight: 0 }}>
      <Stack gap="md" h="100%" style={{ minHeight: 0 }}>
        {health.data && !health.data.anthropic && (
          <Alert variant="light" color="yellow" icon={<TriangleAlert size={16} />} style={{ flexShrink: 0 }}>
            The agent service has no <code>ANTHROPIC_API_KEY</code>, so the tutor can't answer yet.
          </Alert>
        )}
        <Card
          withBorder
          radius="lg"
          p={0}
          style={{ flex: 1, minHeight: 480, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <Group
            component="section"
            data-section="scope"
            aria-label="Scope"
            gap="sm"
            px="md"
            py="xs"
            wrap="nowrap"
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}
          >
            <Select
              aria-label="Scope"
              placeholder="All courses"
              clearable
              size="xs"
              w={240}
              data={ready.map((c) => ({ value: c.id, label: c.title }))}
              value={courseId}
              onChange={(v) => setContext({ courseId: v })}
            />
            <Text size="xs" c="dimmed" truncate>
              {courseId ? 'Answers come from this course and your notes' : 'Answers come from every course and your notes'}
            </Text>
          </Group>
          <Box component="section" data-section="conversation" aria-label="Conversation" style={{ flex: 1, minHeight: 0 }}>
            <TutorChat key={threadId} threadId={threadId} />
          </Box>
        </Card>
      </Stack>
      </Reveal>
    </PageShell>
  );
}
