import { CopilotRuntime } from '@copilotkit/runtime/v2';
import { HttpAgent } from '@ag-ui/client';

/** The agent service base URL. Locally the FastAPI app on :8123. */
const AGENT_URL = process.env.AGENT_URL ?? 'http://localhost:8123';

/** One runtime, one agent: the tutor deep agent served over AG-UI by FastAPI. */
export function createRuntime() {
  const headers: Record<string, string> = {};
  if (process.env.CW_SHARED_SECRET) headers['x-cw-secret'] = process.env.CW_SHARED_SECRET;
  return new CopilotRuntime({
    agents: {
      tutor: new HttpAgent({ url: `${AGENT_URL}/agents/tutor`, headers }),
    },
  });
}
