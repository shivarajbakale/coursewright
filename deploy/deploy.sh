#!/usr/bin/env bash
#
# One-command deploy of parley-api as its own Tailscale node on the deploy
# host (the Mac mini), via ts-deploy.
#
#   npm run deploy              # private: HTTPS on the tailnet only
#   npm run deploy:public       # public internet via Tailscale Funnel (asks first)
#   npm run deploy:status       # list the host's nodes
#   npm run deploy:logs         # follow this node's logs
#   npm run deploy:down         # stop and remove this node
#   npm run deploy -- --pull    # extra flags are forwarded to ts-deploy
#
# Settings live in deploy/config.env — this script is generic. It was written by
# create-rocketship's scripts/deploy-kit; re-run the installer with --force there
# to upgrade it rather than hand-editing it.
#
# How it works: rsync the WORKING TREE to ~/$REMOTE_DIR on the host, then
# ts-deploy wraps compose.ts-deploy.yml in a Tailscale sidecar, builds on the
# host (arm64, no registry) and brings it up. Private and public differ by one
# flag, so `deploy` after `deploy:public` takes the node private again.
#
# Guards, each one there because of an outage in an earlier copy of this script:
#   dirty tree refused ........ ALLOW_DIRTY_DEPLOY=1 to override
#   public asks for "publish" . CONFIRM_PUBLIC=1 for CI / scripts
#   health polled after deploy  SKIP_HEALTHCHECK=1 to override
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$KIT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# shellcheck source=/dev/null
. "$KIT_DIR/config.env"
: "${NODE_NAME:?set NODE_NAME in deploy/config.env}"
: "${SERVE_PORT:?set SERVE_PORT in deploy/config.env}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.ts-deploy.yml}"
REMOTE_DIR="${REMOTE_DIR:-projects/${NODE_NAME}}"
HEALTH_PATHS="${HEALTH_PATHS:-}"
RSYNC_EXCLUDES="${RSYNC_EXCLUDES:-}"
PUBLIC_WARNING="${PUBLIC_WARNING:-}"
PUBLIC_URL="https://${NODE_NAME}.${TAILNET:-<tailnet>.ts.net}"

# --- arguments ----------------------------------------------------------------
ACTION="deploy"
PUBLIC=0
PASS=()
for arg in "$@"; do
  case "$arg" in
    --down) ACTION="down" ;;
    --logs) ACTION="logs" ;;
    --status) ACTION="status" ;;
    --public | --funnel) PUBLIC=1 ;;
    *) PASS+=("$arg") ;;
  esac
done

# --- deploy host: $TS_DEPLOY_HOST > ts-deploy's saved config ------------------
HOST="${TS_DEPLOY_HOST:-}"
if [ -z "$HOST" ]; then
  HOST=$(sed -n 's/.*"target"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "${HOME}/.config/ts-deploy/remote.json" 2>/dev/null || true)
fi
if [ -z "$HOST" ]; then
  echo "error: no deploy host configured." >&2
  echo "       set one with:  ts-deploy host set <user@host>" >&2
  echo "       or export TS_DEPLOY_HOST=<user@host>" >&2
  exit 1
fi

# --- run ts-deploy against the host -------------------------------------------
# Locally ts-deploy drives the host itself (--host). CI runners do not have it —
# it is not on npm — so there it runs on the host over plain ssh. A leading ~/ is
# left unquoted so it expands on the host, not here.
ts() {
  if command -v ts-deploy >/dev/null 2>&1; then
    ts-deploy --host "$HOST" "$@"
    return
  fi
  local remote="" a
  for a in "$@"; do
    case "$a" in
      "~/"*) remote+=" ~/$(printf '%q' "${a#\~/}")" ;;
      *) remote+=" $(printf '%q' "$a")" ;;
    esac
  done
  local tty=""
  [ "$ACTION" = "logs" ] && tty="-tt"
  # shellcheck disable=SC2086
  ssh $tty -o BatchMode=yes "$HOST" \
    "PATH=\"\$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:\$PATH\" ts-deploy${remote}"
}

case "$ACTION" in
  status) ts ls; exit ;;
  logs) ts logs "$NODE_NAME"; exit ;;
  down) ts down "~/${REMOTE_DIR}" -n "$NODE_NAME" -f "$COMPOSE_FILE"; exit ;;
esac

# --- guard: public is a publish, so it is confirmed, never assumed --------------
if [ "$PUBLIC" = "1" ]; then
  echo "==> --public puts ${PUBLIC_URL} on the PUBLIC internet." >&2
  echo "    Anyone with the hostname reaches every route this node serves." >&2
  [ -n "$PUBLIC_WARNING" ] && echo "    ${PUBLIC_WARNING}" >&2
  if [ "${CONFIRM_PUBLIC:-}" = "1" ]; then
    echo "    CONFIRM_PUBLIC=1 — proceeding." >&2
  elif [ ! -t 0 ]; then
    echo "error: refusing to go public without a terminal to confirm at." >&2
    echo "       set CONFIRM_PUBLIC=1 if you mean it." >&2
    exit 1
  else
    printf '    Type "publish" to continue: ' >&2
    read -r reply
    if [ "$reply" != "publish" ]; then
      echo "aborted; nothing was deployed." >&2
      exit 1
    fi
  fi
fi

# --- guard: rsync ships the working tree, not a commit -------------------------
if git rev-parse --git-dir >/dev/null 2>&1; then
  dirty="$(git status --porcelain)"
  if [ -n "$dirty" ]; then
    if [ "${ALLOW_DIRTY_DEPLOY:-}" = "1" ]; then
      echo "warning: deploying a DIRTY working tree (ALLOW_DIRTY_DEPLOY=1)." >&2
    else
      echo "error: refusing to deploy — the working tree has uncommitted changes." >&2
      echo "       they would ship as-is. Commit or stash (or ALLOW_DIRTY_DEPLOY=1)." >&2
      echo "$dirty" | sed 's/^/         /' >&2
      exit 1
    fi
  fi
fi

# --- sync -----------------------------------------------------------------------
EXCLUDES=(
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' --exclude 'build'
  --exclude '.next' --exclude 'coverage' --exclude '.claude' --exclude 'logs'
  --exclude '*.log' --exclude '*.db' --exclude '*.db-*' --exclude '*.sqlite*'
  --exclude '.ts-deploy.*' --exclude '.DS_Store'
)
for pattern in $RSYNC_EXCLUDES; do
  EXCLUDES+=(--exclude "$pattern")
done
# No local .env (a CI runner without DEPLOY_DOTENV): keep the host's copy.
# --delete never removes excluded paths on the receiving side.
if [ ! -f .env ]; then
  echo "note: no local .env — the host keeps the one it already has." >&2
  EXCLUDES+=(--exclude '.env')
fi

echo "==> syncing ${PROJECT_DIR} -> ${HOST}:~/${REMOTE_DIR}"
ssh -o BatchMode=yes "$HOST" "mkdir -p ~/$(printf '%q' "$REMOTE_DIR")"
rsync -az --delete "${EXCLUDES[@]}" -e "ssh -o BatchMode=yes" ./ "${HOST}:${REMOTE_DIR}/"

# --- deploy ---------------------------------------------------------------------
MODE="private"
FLAGS=(-n "$NODE_NAME" -f "$COMPOSE_FILE" --serve "$SERVE_PORT" -b)
if [ "$PUBLIC" = "1" ]; then
  MODE="PUBLIC"
  FLAGS+=(--funnel)
fi
echo "==> deploying '${NODE_NAME}' (${MODE}) on ${HOST}"
ts "~/${REMOTE_DIR}" "${FLAGS[@]}" ${PASS[@]+"${PASS[@]}"}

# --- prove it answers -----------------------------------------------------------
# A container can report healthy while the route users hit returns 500, so poll
# the real paths over the tailnet (MagicDNS node name, plain http on the app port).
if [ "${SKIP_HEALTHCHECK:-}" != "1" ] && [ -n "$HEALTH_PATHS" ]; then
  for path in $HEALTH_PATHS; do
    url="http://${NODE_NAME}:${SERVE_PORT}${path}"
    echo "==> waiting for ${url}"
    ok=""
    for attempt in $(seq 1 30); do
      code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
      if [ "$code" = "200" ]; then
        ok=1
        echo "    200 after ${attempt} attempt(s)"
        break
      fi
      echo "    attempt ${attempt}/30: ${code:-000}"
      sleep 6
    done
    if [ -z "$ok" ]; then
      echo "error: ${url} never returned 200. The deploy is up but not working." >&2
      echo "       inspect with: npm run deploy:logs  (SKIP_HEALTHCHECK=1 to bypass)" >&2
      exit 1
    fi
  done
fi

echo "==> ${NODE_NAME} is live (${MODE}): ${PUBLIC_URL}"
