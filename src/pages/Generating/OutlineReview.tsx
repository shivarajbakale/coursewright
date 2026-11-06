import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { ArrowRight, Send, TriangleAlert, X } from 'lucide-react';
import { ChapterNumber } from '@/components/chapter-number';
import { ErrorState } from '@/components/state-panel';
import { useApprovePlan, usePlan, usePlanChat, useRemovePlanChapter } from '@/hooks/useCoursewright';
import type { CoursePlan, PlanChapter } from '@/api/types';

const EXAMPLES = ['add a chapter on chunking before 1.3', 'merge 2.1 and 2.2', 'drop the deployment module'];

function tokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.max(1, Math.round(n / 1000))}k`;
}

/**
 * The outline review: the build stopped after its outline, before any chapter
 * is written. The outline on the left, changed in place; a chat on the right
 * for anything bigger than removing one chapter. Write this course continues
 * the build on the outline you agreed.
 */
export function OutlineReview({ courseId }: { courseId: string }) {
  const plan = usePlan(courseId);
  const chat = usePlanChat(courseId);
  const remove = useRemovePlanChapter(courseId);
  const approve = useApprovePlan(courseId);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [changed, setChanged] = useState<string[]>([]);

  if (plan.isPending) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }
  if (plan.isError || !plan.data) {
    return (
      <ErrorState
        error={plan.error ?? { message: 'Not found', status: 404 }}
        title="The outline didn’t load"
        missingTitle="This course has no outline yet"
        onRetry={() => plan.refetch()}
        retrying={plan.isRefetching}
      />
    );
  }

  const send = (message: string) => {
    const text = message.trim();
    if (!text || chat.isPending) return;
    setFailed(null);
    chat.mutate(text, {
      onSuccess: (res) => {
        setDraft('');
        setChanged(res.changed);
      },
      onError: () => setFailed(text),
    });
  };

  return (
    <Grid gap="lg" data-outline-review>
      <Grid.Col span={{ base: 12, lg: 7 }}>
        <OutlineCard
          plan={plan.data}
          changed={changed}
          removing={remove.isPending ? remove.variables : null}
          onRemove={(key) => remove.mutate(key, { onSuccess: () => setChanged([]) })}
          footer={
            <Stack gap="xs">
              {approve.isError && (
                <Alert color="red" variant="light" icon={<TriangleAlert size={16} />} title="Writing didn’t start">
                  {(approve.error as { message?: string }).message ?? 'Try again in a moment.'}
                </Alert>
              )}
              <Group justify="space-between">
                <Text size="sm" c="dimmed" style={{ flex: '1 1 220px' }}>
                  Nothing is written until you start. You can still leave and come back.
                </Text>
                <Button
                  rightSection={<ArrowRight size={16} />}
                  loading={approve.isPending}
                  disabled={chat.isPending || remove.isPending}
                  onClick={() => approve.mutate()}
                  style={{ flexShrink: 0 }}
                >
                  {approve.isError ? 'Try again' : 'Write this course'}
                </Button>
              </Group>
            </Stack>
          }
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, lg: 5 }}>
        <ChatCard
          plan={plan.data}
          draft={draft}
          setDraft={setDraft}
          onSend={send}
          pending={chat.isPending ? (chat.variables ?? '') : null}
          failed={failed}
        />
      </Grid.Col>
    </Grid>
  );
}

function OutlineCard({
  plan,
  changed,
  removing,
  onRemove,
  footer,
}: {
  plan: CoursePlan;
  changed: string[];
  removing: string | null | undefined;
  onRemove: (key: string) => void;
  footer: React.ReactNode;
}) {
  const { outline } = plan;
  const chapters = outline.modules.reduce((n, m) => n + m.chapters.length, 0);
  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="baseline" wrap="nowrap">
          <Text fw={600} truncate>
            Outline
          </Text>
          <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
            {outline.modules.length} modules · {chapters} chapters · about {tokens(plan.estimate.tokens)} tokens to write
          </Text>
        </Group>
        <ScrollArea.Autosize mah={460} offsetScrollbars>
          <Stack gap="md">
            {outline.modules.map((m, mi) => (
              <Stack key={m.key} gap={4}>
                <Group gap="xs" wrap="nowrap">
                  <ChapterNumber value={String(mi + 1)} />
                  <Text fw={600} size="sm" style={{ minWidth: 0 }}>
                    {m.title}
                  </Text>
                </Group>
                {m.chapters.map((ch, ci) => (
                  <ChapterRow
                    key={ch.key}
                    number={`${mi + 1}.${ci + 1}`}
                    chapter={ch}
                    changed={changed.includes(ch.key)}
                    lastInModule={m.chapters.length === 1}
                    removing={removing === ch.key}
                    onRemove={() => onRemove(ch.key)}
                  />
                ))}
              </Stack>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        {footer}
      </Stack>
    </Card>
  );
}

function ChapterRow({
  number,
  chapter,
  changed,
  lastInModule,
  removing,
  onRemove,
}: {
  number: string;
  chapter: PlanChapter;
  changed: boolean;
  lastInModule: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const label = `Remove ${number} ${chapter.title}`;
  return (
    <Paper
      p="xs"
      pl="md"
      radius="md"
      bg={changed ? 'var(--mantine-primary-color-light)' : undefined}
      data-chapter-key={chapter.key}
      data-changed={changed || undefined}
    >
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <ChapterNumber value={number} />
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" truncate>
              {chapter.title}
            </Text>
            {changed && (
              <Badge size="xs" variant="light" style={{ flexShrink: 0 }}>
                Changed
              </Badge>
            )}
          </Group>
          {chapter.summary && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {chapter.summary}
            </Text>
          )}
        </Stack>
        <Tooltip label={lastInModule ? 'A module keeps at least one chapter' : label} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={44}
            aria-label={label}
            disabled={lastInModule}
            loading={removing}
            onClick={onRemove}
          >
            <X size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
}

function ChatCard({
  plan,
  draft,
  setDraft,
  onSend,
  pending,
  failed,
}: {
  plan: CoursePlan;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (message: string) => void;
  pending: string | null;
  failed: string | null;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const count = plan.messages.length + (pending ? 1 : 0);
  useEffect(() => {
    viewport.current?.scrollTo?.({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  }, [count, failed]);

  return (
    <Card withBorder radius="lg" p="lg" h="100%">
      <Stack gap="sm" h="100%" justify="space-between">
        <Text fw={600}>Ask for changes</Text>
        <ScrollArea.Autosize mah={420} viewportRef={viewport} offsetScrollbars style={{ flex: 1 }}>
          <Stack gap="xs" aria-live="polite">
            {plan.messages.length === 0 && !pending && (
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Add, remove, merge or reorder chapters in your own words. For example:
                </Text>
                {EXAMPLES.map((e) => (
                  <Button key={e} variant="subtle" size="compact-sm" justify="flex-start" onClick={() => setDraft(e)}>
                    {e}
                  </Button>
                ))}
              </Stack>
            )}
            {plan.messages.map((m, i) => (
              <Message key={i} role={m.role} text={m.text} />
            ))}
            {pending && (
              <>
                <Message role="user" text={pending} />
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">
                    Changing the outline…
                  </Text>
                </Group>
              </>
            )}
            {failed && !pending && (
              <Alert color="red" variant="light" icon={<TriangleAlert size={16} />} title="That change didn’t go through">
                <Stack gap="xs" align="flex-start">
                  <Text size="sm">The outline is unchanged.</Text>
                  <Button size="xs" variant="default" onClick={() => onSend(failed)}>
                    Try again
                  </Button>
                </Stack>
              </Alert>
            )}
          </Stack>
        </ScrollArea.Autosize>
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <Textarea
            aria-label="Ask for a change to the outline"
            placeholder="Add a chapter on…"
            autosize
            minRows={1}
            maxRows={4}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend(draft);
              }
            }}
            disabled={!!pending}
            style={{ flex: 1 }}
          />
          <ActionIcon
            size={44}
            aria-label="Send"
            onClick={() => onSend(draft)}
            disabled={!draft.trim() || !!pending}
          >
            <Send size={16} />
          </ActionIcon>
        </Group>
      </Stack>
    </Card>
  );
}

function Message({ role, text }: { role: 'user' | 'agent'; text: string }) {
  return (
    <Paper p="xs" px="sm" radius="md" withBorder={role === 'agent'} bg={role === 'user' ? 'var(--mantine-color-default-hover)' : undefined}>
      <Text size="xs" c="dimmed" fw={600}>
        {role === 'user' ? 'You' : 'Coursewright'}
      </Text>
      <Text size="sm">{text}</Text>
    </Paper>
  );
}
