/**
 * Notification query & mutation hooks.
 *
 * Components use these — not the service — so caching, refetching, and
 * invalidation live in one place. `notificationKeys` keeps query keys
 * consistent across the bell dropdown (which only needs the top 5) and the
 * inbox (which needs everything).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/api/services/notificationService';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
};

/** Fetch the full notification list (latest first). */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationService.list(),
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
