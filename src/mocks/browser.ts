import { setupWorker } from 'msw/browser';
import { handlers } from './handlers/index';

/**
 * Mock Service Worker Browser Setup
 *
 * This creates a service worker that intercepts network requests
 * in the browser and returns mock responses based on the handlers.
 *
 * Used for development without a backend and for testing in the browser.
 */
export const worker = setupWorker(...handlers);

/**
 * Start the mock service worker
 *
 * @param options - Options for starting the worker
 * @returns Promise that resolves when the worker is ready
 */
export async function startMockServiceWorker(options?: {
  onUnhandledRequest?: 'bypass' | 'warn' | 'error';
  quiet?: boolean;
}) {
  return worker.start({
    onUnhandledRequest: options?.onUnhandledRequest || 'bypass',
    quiet: options?.quiet || false,
  });
}
