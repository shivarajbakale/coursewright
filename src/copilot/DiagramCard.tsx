/**
 * A diagram the tutor made, shown in the chat: an Inkling drawing (make_drawing), a Flowmovie or a Mermaid
 * fallback (make_flow). Kept apart from the CopilotKit wiring so it renders and tests on its own.
 */
import { Alert, Button, Card, Group, Text } from '@mantine/core';
import { Clapperboard, NotebookPen, PenLine } from 'lucide-react';
import { FlowPlayer } from '@/components/diagrams/FlowPlayer';
import { InklingDiagram } from '@/components/diagrams/InklingDiagram';
import { MermaidDiagram } from '@/components/diagrams/MermaidDiagram';
import { useCreateNote } from '@/hooks/useCoursewright';
import { toast } from '@/lib/notify';
import { useTutor } from './tutorStore';

export interface Diagram {
  kind: 'flow' | 'mermaid' | 'inkling' | 'none';
  title: string;
  source: string;
}

export function DiagramCard({ diagram }: { diagram: Diagram | null }) {
  const createNote = useCreateNote();
  const { courseId, chapterId } = useTutor();
  if (!diagram || diagram.kind === 'none' || !diagram.source)
    return (
      <Alert color="red" variant="light">
        The diagram couldn't be made.
      </Alert>
    );
  return (
    <Card withBorder radius="md" p="sm" my={4}>
      <Group justify="space-between" mb="xs">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          {diagram.kind === 'inkling' ? <PenLine size={14} /> : <Clapperboard size={14} />}
          <Text size="sm" fw={600} truncate>
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
      {diagram.kind === 'inkling' ? (
        <InklingDiagram source={diagram.source} />
      ) : diagram.kind === 'flow' ? (
        <FlowPlayer source={diagram.source} />
      ) : (
        <MermaidDiagram source={diagram.source} />
      )}
    </Card>
  );
}
