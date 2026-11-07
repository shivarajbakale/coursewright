import { useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { useExtendCourse } from '@/hooks/useCoursewright';

/**
 * "Extend this course": say what to add, and the builder plans new modules after the last one, built on
 * what the course already teaches. The plan waits for review on the build page; the course stays readable
 * the whole time.
 */
export function ExtendCourseModal({
  courseId,
  title,
  opened,
  onClose,
}: {
  courseId: string;
  title: string;
  opened: boolean;
  onClose: () => void;
}) {
  const [request, setRequest] = useState('');
  const extend = useExtendCourse(courseId);
  const navigate = useNavigate();
  const short = request.trim().length < 10;

  const submit = () => {
    if (short) return;
    extend.mutate(request.trim(), {
      onSuccess: () => {
        onClose();
        setRequest('');
        void navigate({ to: '/courses/$courseId/building', params: { courseId } });
      },
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Extend this course" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          New modules go after the last one in “{title}”, built on what it already teaches. You
          review them before anything is written, and you can keep reading meanwhile.
        </Text>
        <Textarea
          label="What should it add?"
          placeholder="Advanced strategies, options pricing, building a live trading system…"
          autosize
          minRows={4}
          maxRows={10}
          value={request}
          onChange={e => setRequest(e.currentTarget.value)}
          data-autofocus
        />
        {extend.isError && (
          <Alert color="red" variant="light" title="Couldn't start planning">
            {(extend.error as { message?: string }).message ?? 'Try again in a moment.'}
          </Alert>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={short} loading={extend.isPending}>
            Plan new modules
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
