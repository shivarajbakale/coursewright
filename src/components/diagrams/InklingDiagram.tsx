import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Code,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ChevronLeft, ChevronRight, Maximize, Maximize2, Minimize, Pause, Play, RotateCcw } from 'lucide-react';
import { inklingTitle, mountExplainer, paperFor, type Explainer, type ExplainerState } from '@/lib/inkling';

/**
 * A lesson's Inkling explainer: a hand-drawn diagram that draws itself step by step, inline where the
 * lesson's ```inkling fence sits. It draws itself the first time it scrolls into view (not under reduced
 * motion); the bar under it steps through, with the step's caption. Paper follows the colour scheme.
 *
 * "Open large" shows it in a big window that can fill the screen, drawn as large as the screen allows;
 * there the arrow keys step through it. `fill` is that large drawing, used inside the window.
 */
export function InklingDiagram({ source, fill = false }: { source: string; fill?: boolean }) {
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
    mountExplainer(el, source, paperFor(scheme === 'dark' ? 'dark' : 'light'), (s) => !cancelled && setState(s), { fill })
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
  }, [source, scheme, fill]);

  // In the large window the arrow keys step through the drawing.
  useEffect(() => {
    if (!fill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') control.current?.next();
      else if (e.key === 'ArrowLeft') control.current?.prev();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fill]);

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
      {state && (
        <Group gap="xs" wrap="nowrap" justify="space-between">
          <Text size={fill ? 'md' : 'sm'} c="dimmed" aria-live="polite" style={{ flex: 1, minWidth: 0 }}>
            {steps > 1 ? (caption ? `${state.step + 1}. ${caption}` : `Step ${state.step + 1} of ${steps}`) : ''}
          </Text>
          <Group gap={2} wrap="nowrap">
            {steps > 1 && (
              <>
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
              </>
            )}
            {!fill && <OpenLarge source={source} title={title} />}
          </Group>
        </Group>
      )}
    </Stack>
  );
}

/** The expand button and the large window it opens; the window can fill the screen, and does on a phone. */
function OpenLarge({ source, title }: { source: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(false);
  const phone = useMediaQuery('(max-width: 48em)') ?? false;
  const full = whole || phone;
  return (
    <>
      <Tooltip label="Open large">
        <ActionIcon variant="subtle" color="gray" aria-label="Open large" onClick={() => setOpen(true)}>
          <Maximize2 size={16} />
        </ActionIcon>
      </Tooltip>
      <Modal
        opened={open}
        onClose={() => {
          setOpen(false);
          setWhole(false);
        }}
        title={
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} truncate>
              {title || 'Drawing'}
            </Text>
            {!phone && (
              <Tooltip label={whole ? 'Back to a window' : 'Fill the screen'}>
                <ActionIcon variant="subtle" color="gray" aria-label={whole ? 'Back to a window' : 'Fill the screen'} onClick={() => setWhole((w) => !w)}>
                  {whole ? <Minimize size={16} /> : <Maximize size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        }
        fullScreen={full}
        size="90%"
        centered
        closeButtonProps={{ 'aria-label': 'Close' }}
      >
        {open && <InklingDiagram source={source} fill />}
      </Modal>
    </>
  );
}
