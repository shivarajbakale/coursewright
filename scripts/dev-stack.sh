#!/usr/bin/env bash
# Runs the whole Coursewright stack against the real agent service:
#   agent    FastAPI + deepagents on :8123   (agent/, uv)
#   runtime  CopilotKit runtime on :4000      (runtime-dev/server.ts)
#   web      Vite on :5173 with MSW off       (proxies /api/copilotkit -> :4000, /api -> :8123)
# Ctrl-C stops all three. Put ANTHROPIC_API_KEY / VOYAGE_API_KEY in agent/.env.
set -euo pipefail
cd "$(dirname "$0")/.."
pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
(cd agent && uv run uvicorn app.main:app --port 8123 --reload) & pids+=($!)
npx tsx runtime-dev/server.ts & pids+=($!)
VITE_ENABLE_MOCKING=false npx vite --port 5173 & pids+=($!)
wait
