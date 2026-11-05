import { setupServer } from 'msw/node';
import { handlers } from './handlers/index';

/**
 * MSW server for Node (Vitest). Lifecycle (listen/reset/close) is wired in
 * `src/test/setup.ts`.
 */
export const server = setupServer(...handlers);
