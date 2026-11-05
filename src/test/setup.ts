import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { server } from '../mocks/node';

/**
 * Test setup.
 *
 * MSW intercepts every request the app makes, so component tests exercise the
 * same handlers the running app uses — no per-test stubbing of the service
 * layer. Testing Library's DOM is torn down between tests.
 *
 * jsdom does not implement these, and Mantine's popovers, scroll areas and
 * responsive props call them on mount, so they are stubbed once here rather
 * than in every test.
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  // TanStack Router restores scroll on every navigation; jsdom has no layout,
  // so the call is meaningless here but noisy if left unstubbed.
  window.scrollTo = () => {};

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
