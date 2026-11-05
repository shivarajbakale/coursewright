/**
 * Notification domain. The agent service writes one when work you started
 * and are waiting on finishes or fails: a course build, a project review, or
 * the indexing of a link you added. The sidebar's Notifications menu lists
 * them; `read` powers its unread count.
 */

export type NotificationKind =
  | 'course_ready'
  | 'course_failed'
  | 'review_ready'
  | 'review_failed'
  | 'source_failed';

export interface Notification {
  id: string;
  kind: NotificationKind;
  /** One line that names the course, project or link. */
  title: string;
  /** The failure reason, or what to do next. */
  body: string;
  /** Where a click goes: the course, its build page, the project, or Sources. */
  href: string;
  courseId: string | null;
  read: boolean;
  createdAt: string;
}
