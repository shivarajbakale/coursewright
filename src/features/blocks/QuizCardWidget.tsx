import { useState } from 'react';
import { ActionIcon, Alert, Button, Group, Paper, Radio, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { Check, CircleHelp, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { WidgetApi } from '@shivarajbakale/blocks';
import type { QuizCardProps } from './model';

/** The card's editor: prompt, options (one marked right), explanation. */
function QuizEditor({ props, api }: { props: QuizCardProps; api: WidgetApi<QuizCardProps> }) {
  const [draft, setDraft] = useState<QuizCardProps>(() => ({
    ...props,
    options: props.options.length ? props.options : ['', ''],
  }));
  const set = (patch: Partial<QuizCardProps>) => setDraft((d) => ({ ...d, ...patch }));
  const setOption = (i: number, text: string) => set({ options: draft.options.map((o, j) => (j === i ? text : o)) });
  const removeOption = (i: number) => {
    const options = draft.options.filter((_, j) => j !== i);
    const answer = draft.answer === i ? 0 : draft.answer > i ? draft.answer - 1 : draft.answer;
    set({ options, answer });
  };
  const save = () => {
    const options = draft.options.map((o) => o.trim()).filter(Boolean);
    const kept = draft.options[draft.answer]?.trim();
    const answer = Math.max(0, kept ? options.indexOf(kept) : 0);
    api.update({ prompt: draft.prompt.trim(), options, answer, explanation: draft.explanation.trim(), editing: false });
  };

  return (
    <Stack gap="sm">
      <TextInput
        label="Question"
        placeholder="What does a candidate need to win an election?"
        value={draft.prompt}
        onChange={(e) => set({ prompt: e.currentTarget.value })}
      />
      <Radio.Group
        label="Options"
        description="Pick the right one"
        value={String(draft.answer)}
        onChange={(v) => set({ answer: Number(v) })}
      >
        <Stack gap={6} mt={6}>
          {draft.options.map((o, i) => (
            <Group key={i} gap="xs" wrap="nowrap">
              <Radio value={String(i)} aria-label={`Option ${i + 1} is the answer`} />
              <TextInput
                flex={1}
                size="xs"
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                value={o}
                onChange={(e) => setOption(i, e.currentTarget.value)}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Remove option ${i + 1}`}
                disabled={draft.options.length <= 2}
                onClick={() => removeOption(i)}
              >
                <X size={14} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      </Radio.Group>
      <Group>
        <Button
          size="xs"
          variant="subtle"
          leftSection={<Plus size={14} />}
          onClick={() => set({ options: [...draft.options, ''] })}
        >
          Add option
        </Button>
      </Group>
      <Textarea
        label="Explanation"
        description="Shown once an answer is checked"
        autosize
        minRows={2}
        value={draft.explanation}
        onChange={(e) => set({ explanation: e.currentTarget.value })}
      />
      <Group justify="space-between">
        <Button size="xs" variant="subtle" color="red" leftSection={<Trash2 size={14} />} onClick={api.remove}>
          Remove
        </Button>
        <Button size="xs" onClick={save} disabled={!draft.prompt.trim() || draft.options.filter((o) => o.trim()).length < 2}>
          Done
        </Button>
      </Group>
    </Stack>
  );
}

/** The card as a reader takes it: pick an option, check it, see why. */
function QuizView({ props, api }: { props: QuizCardProps; api: WidgetApi<QuizCardProps> }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const right = checked && Number(chosen) === props.answer;

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <CircleHelp size={18} color="var(--mantine-color-dimmed)" />
          <Text fw={600} size="sm">
            {props.prompt || 'Untitled question'}
          </Text>
        </Group>
        {api.editable && (
          <ActionIcon variant="subtle" color="gray" aria-label="Edit quiz card" onClick={() => api.update({ editing: true })}>
            <Pencil size={14} />
          </ActionIcon>
        )}
      </Group>
      <Radio.Group
        value={chosen}
        onChange={(v) => {
          setChosen(v);
          setChecked(false);
        }}
        aria-label={props.prompt || 'Quiz'}
      >
        <Stack gap={8}>
          {props.options.map((o, i) => (
            <Radio
              key={i}
              value={String(i)}
              label={o}
              color={checked && i === props.answer ? 'green' : undefined}
              disabled={checked && right}
            />
          ))}
        </Stack>
      </Radio.Group>
      <Group gap="xs">
        <Button size="xs" variant="light" disabled={chosen == null || checked} onClick={() => setChecked(true)}>
          Check answer
        </Button>
        {checked && (
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => {
              setChosen(null);
              setChecked(false);
            }}
          >
            Try again
          </Button>
        )}
      </Group>
      {checked && (
        <Alert
          variant="light"
          color={right ? 'green' : 'red'}
          icon={right ? <Check size={16} /> : <X size={16} />}
          title={right ? 'Right' : `Not quite. The answer is “${props.options[props.answer] ?? ''}”.`}
        >
          {props.explanation || null}
        </Alert>
      )}
    </Stack>
  );
}

/** A question with options inside a note: a Radio quiz that reveals its explanation once checked. */
export function QuizCardWidget({ props, api }: { props: QuizCardProps; api: WidgetApi<QuizCardProps> }) {
  return (
    <Paper withBorder radius="md" p="md" data-coursewright-block="quiz">
      {api.editable && props.editing ? <QuizEditor props={props} api={api} /> : <QuizView props={props} api={api} />}
    </Paper>
  );
}
