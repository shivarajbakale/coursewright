import { useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { Button, Group, Paper, SegmentedControl, Stack, Text, Textarea } from '@mantine/core';
import { Code2, Trash2 } from 'lucide-react';
import type { WidgetApi } from '@shivarajbakale/blocks';
import { FlowPlayer } from '@/components/diagrams/FlowPlayer';
import { InklingDiagram } from '@/components/diagrams/InklingDiagram';
import { MermaidDiagram } from '@/components/diagrams/MermaidDiagram';
import { SAMPLE_FLOW, SAMPLE_INKLING, SAMPLE_MERMAID, type DiagramKind, type DiagramProps } from './model';

function Diagram({ kind, source }: { kind: DiagramKind; source: string }) {
  if (!source.trim()) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="lg">
        Empty diagram
      </Text>
    );
  }
  if (kind === 'flow') return <FlowPlayer source={source} />;
  if (kind === 'inkling') return <InklingDiagram source={source} />;
  return <MermaidDiagram source={source} />;
}

/**
 * A Flowmovie movie, a Mermaid diagram or an Inkling drawing inside a note or a chapter. Read-only pages only
 * show it; an editable page adds "Edit source", which opens the source under a
 * live preview. The preview follows the textarea after a pause, so a diagram
 * half-typed does not flash an error on every key.
 */
export function DiagramWidget({ props, api }: { props: DiagramProps; api: WidgetApi<DiagramProps> }) {
  const editing = api.editable && !!props.editing;
  const [draft, setDraft] = useState(props.source);
  const [preview] = useDebouncedValue(draft, 500);

  const setKind = (kind: string) => {
    const next = kind as DiagramKind;
    // A sample is only swapped in when the source is still the other sample (or empty).
    const samples: Record<DiagramKind, string> = { flow: SAMPLE_FLOW, mermaid: SAMPLE_MERMAID, inkling: SAMPLE_INKLING };
    const pristine = !draft.trim() || Object.values(samples).includes(draft);
    const source = pristine ? samples[next] : draft;
    setDraft(source);
    api.update({ kind: next, source });
  };

  return (
    <Paper withBorder radius="md" p="sm" data-coursewright-block="diagram" data-kind={props.kind}>
      <Stack gap="sm">
        {editing && (
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <SegmentedControl
              size="xs"
              value={props.kind}
              onChange={setKind}
              data={[
                { value: 'mermaid', label: 'Mermaid' },
                { value: 'flow', label: 'Flowmovie' },
                { value: 'inkling', label: 'Inkling' },
              ]}
              aria-label="Diagram type"
            />
            <Group gap="xs" wrap="nowrap">
              <Button size="xs" variant="subtle" color="red" leftSection={<Trash2 size={14} />} onClick={api.remove}>
                Remove
              </Button>
              <Button
                size="xs"
                onClick={() => api.update({ source: draft, editing: false })}
              >
                Done
              </Button>
            </Group>
          </Group>
        )}

        <Diagram kind={props.kind} source={editing ? preview : props.source} />

        {editing ? (
          <Textarea
            aria-label={{ flow: 'Flowmovie source', mermaid: 'Mermaid source', inkling: 'Inkling source' }[props.kind]}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={() => draft !== props.source && api.update({ source: draft })}
            autosize
            minRows={4}
            maxRows={16}
            ff="monospace"
            size="xs"
            spellCheck={false}
          />
        ) : (
          api.editable && (
            <Group justify="flex-end">
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<Code2 size={14} />}
                onClick={() => {
                  setDraft(props.source);
                  api.update({ editing: true });
                }}
              >
                Edit source
              </Button>
            </Group>
          )
        )}
      </Stack>
    </Paper>
  );
}
