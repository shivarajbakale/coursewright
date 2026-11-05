/**
 * Notification domain — every inbox row, topbar-bell preview, and
 * Dashboard "recent activity" item is a Notification.
 *
 * `kind` is a closed enum so we can pick an icon + colour in one place:
 * `mention | comment | invite | deploy | payment | system`. `actor` is the
 * person who caused it; `projectId` links project-scoped notifications to the
 * Projects detail pane; `read` powers the bell badge + inbox filter.
 */

export type NotificationKind =
  | 'mention'
  | 'comment'
  | 'invite'
  | 'deploy'
  | 'payment'
  | 'system';

export interface NotificationActor {
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  /** Short, single-line body. The inbox shows it; the dropdown hides it. */
  body: string;
  actor?: NotificationActor;
  /** Optional project reference — inbox renders a "View project" link. */
  projectId?: string;
  /** Optional deep-link target; the inbox routes here on click. */
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationCounts {
  unread: number;
  total: number;
}
