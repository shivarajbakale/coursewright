#!/usr/bin/env bash
# Canonical session-start script. Idempotent — safe to run any time.
#
# Honors $NPM_BIN if set, otherwise falls back to whatever `npm` is on PATH.
# Set RUN_DEV=1 to launch the Vite dev server after verification.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NPM="${NPM_BIN:-npm}"

echo "==> Working directory: $PWD"
echo "==> Using npm at: $(command -v "$NPM" || echo "$NPM")"

if [ ! -d node_modules ]; then
  echo "==> Installing dependencies (npm install)"
  "$NPM" install
else
  echo "==> Dependencies present (skip install; run 'make setup' to refresh)"
fi

echo "==> Type check (npm run type-check)"
"$NPM" run type-check

echo "==> Lint (npm run lint)"
"$NPM" run lint

echo "==> Tests (npm run test)"
"$NPM" run test

echo
echo "==> Baseline verification passed."
echo "    Run 'make dev' (or RUN_DEV=1 ./init.sh) to launch the app on http://localhost:5173."

if [ "${RUN_DEV:-0}" = "1" ]; then
  echo "==> Launching the dev server"
  exec "$NPM" run dev
fi
