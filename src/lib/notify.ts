import { notifications } from '@mantine/notifications';

/**
 * Toasts.
 *
 * `@mantine/notifications` is a queue with an imperative API, not a component
 * you place — `<Notifications />` is mounted once in `ThemeProvider` and this
 * module is how the rest of the app talks to it. Nothing else should import
 * `notifications` directly.
 *
 * The shape is deliberately the two calls the app actually makes. A wrapper
 * that re-exported the whole API would be a rename, not a boundary; this one
 * decides the colour and the timing for a success and for a failure, in one
 * place, so a mutation handler never has to.
 *
 *   import { toast } from '@/lib/notify';
 *   toast.success('Project updated');
 *   toast.error('Could not update project');
 *
 * An error stays twice as long as a success: the user has to read it, and may
 * have looked away while the request was in flight.
 */
export const toast = {
  success(message: string) {
    notifications.show({ message, color: 'green', autoClose: 4000 });
  },
  error(message: string) {
    notifications.show({ message, color: 'red', autoClose: 8000 });
  },
};
