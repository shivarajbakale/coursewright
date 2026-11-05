/**
 * Production CopilotKit runtime as a Vercel function (Web Request/Response).
 * AGENT_URL points at the deployed Python agent service.
 */
import { createCopilotRuntimeHandler } from '@copilotkit/runtime/v2';
import { createRuntime } from '../../runtime-dev/runtime';

const handler = createCopilotRuntimeHandler({ runtime: createRuntime(), basePath: '/api/copilotkit' });

export const GET = handler;
export const POST = handler;
