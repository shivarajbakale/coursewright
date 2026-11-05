/**
 * Notification query & mutation hooks.
 *
 * Components use these, not the service, so caching, refetching and
 * invalidation live in one place. The list refetches every 30 s so the
 * sidebar's unread count stays current without a socket, and `useJob`
 * invalidates it the moment a watched build or review ends.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/api/services/notificationService';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
};

/** The latest notifications, newest first. */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationService.list(),
    refetchInterval: 30_000,
    // A failed list is shown inside the menu; no need to hammer the service.
    retry: 1,
  });
}

/** Read state for one notification. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Mark every notification read. */
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Convenience: derived counts for the bell badge. */
export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read).length;
}
