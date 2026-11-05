/**
 * MSW handler registry. One handler array per resource.
 */
import { coursewrightHandlers } from './coursewrightHandlers';
import { notificationHandlers } from './notificationHandlers';

export const handlers = [...coursewrightHandlers, ...notificationHandlers];

export { coursewrightHandlers } from './coursewrightHandlers';
export { notificationHandlers } from './notificationHandlers';
