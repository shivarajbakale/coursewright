/**
 * MSW handler registry.
 *
 * Add one handler array per resource. The `add-api-endpoint` and `add-feature`
 * skills append here automatically.
 */
import { billingHandlers } from './billingHandlers';
import { notificationHandlers } from './notificationHandlers';
import { customerHandlers } from './customerHandlers';
import { teamHandlers } from './teamHandlers';

export const handlers = [
  ...customerHandlers,
  ...notificationHandlers,
  ...teamHandlers,
  ...billingHandlers,
  // ...add your resource handlers here
];

export { billingHandlers } from './billingHandlers';
export { notificationHandlers } from './notificationHandlers';
export { customerHandlers } from './customerHandlers';
export { teamHandlers } from './teamHandlers';
