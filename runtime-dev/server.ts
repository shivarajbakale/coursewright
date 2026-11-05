/**
 * CopilotKit runtime for local development.
 *
 * The browser talks to `/api/copilotkit` (Vite proxies it here, port 4000); the
 * runtime forwards each run to the Python tutor agent over AG-UI. In
 * production the same `createRuntime()` backs a Vercel function
 * (`api/copilotkit/[[...slug]].ts`).
 */
import { createServer } from 'node:http';
import { createCopilotNodeListener } from '@copilotkit/runtime/v2/node';
import { createRuntime } from './runtime';

const port = Number(process.env.RUNTIME_PORT ?? 4000);

const listener = createCopilotNodeListener({
  runtime: createRuntime(),
  basePath: '/api/copilotkit',
});

createServer(listener).listen(port, () => {
  console.log(`[runtime] CopilotKit runtime on http://localhost:${port}/api/copilotkit`);
});
