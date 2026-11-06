import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Alert, Box, Code, Group, Skeleton, Stack, Text, useComputedColorScheme } from '@mantine/core';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { inklingTitle, mountExplainer, paperFor, type Explainer, type ExplainerState } from '@/lib/inkling';

/**
 * A lesson's Inkling explainer: a hand-drawn diagram that draws itself step by step, inline where the
 * lesson's ```inkling fence sits. It draws itself the first time it scrolls into view (not under reduced
 * motion); the bar under it steps through, with the step's caption. Paper follows the colour scheme.
 */
export function InklingDiagram({ source }: { source: string }) {
  const scheme = useComputedColorScheme('dark');
  const host = useRef<HTMLDivElement>(null);
  const control = useRef<Explainer | null>(null);
  const [state, setState] = useState<ExplainerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = inklingTitle(source);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let mounted: Explainer | null = null;
    setError(null);
    setState(null);
    mountExplainer(el, source, paperFor(scheme === 'dark' ? 'dark' : 'light'), (s) => !cancelled && setState(s))
      .then((c) => {
        if (cancelled) c.destroy();
        else control.current = mounted = c;
      })
      .catch((e: Error) => !cancelled && setError(e.message || 'could not draw it'));
    return () => {
      cancelled = true;
      mounted?.destroy();
      control.current = null;
    };
  }, [source, scheme]);

  if (error)
    return (
      <Alert color="yellow" variant="light" title={`${title || 'This drawing'} has a mistake, so here is its text`}>
        <Code block mah={240} style={{ overflow: 'auto' }}>
          {source}
        </Code>
      </Alert>
    );

  const steps = state?.steps.length ?? 0;
  const caption = state && steps ? state.steps[state.step]?.caption : '';
  return (
    <Stack gap={6} data-coursewright-block="inkling">
      {!state && (
        <Skeleton h={260} radius="md" aria-label={title ? `Loading “${title}”` : 'Loading the drawing'} />
      )}
      <Box ref={host} style={{ display: state ? 'block' : 'none', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }} />
      {state && steps > 1 && (
        <Group gap="xs" wrap="nowrap" justify="space-between">
          <Text size="sm" c="dimmed" aria-live="polite" style={{ flex: 1, minWidth: 0 }}>
            {caption ? `${state.step + 1}. ${caption}` : `Step ${state.step + 1} of ${steps}`}
          </Text>
          <Group gap={2} wrap="nowrap">
            <ActionIcon variant="subtle" color="gray" aria-label="Previous step" onClick={() => control.current?.prev()} disabled={state.step === 0 && !state.playing}>
              <ChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={state.playing ? 'Pause' : state.done ? 'Draw it again' : 'Play'}
              onClick={() => (state.playing ? control.current?.pause() : control.current?.play())}
            >
              {state.playing ? <Pause size={16} /> : state.done ? <RotateCcw size={16} /> : <Play size={16} />}
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" aria-label="Next step" onClick={() => control.current?.next()} disabled={state.done && !state.playing}>
              <ChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
      )}
    </Stack>
  );
}
