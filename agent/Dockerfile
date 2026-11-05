# Coursewright agent service: FastAPI + deepagents + SQLite, Node 20 for the Flowmovie checker, and
# Litestream to replicate the SQLite file to S3/R2. Build from agent/: `fly deploy` or `docker build .`
FROM node:20-bookworm-slim AS node

FROM python:3.12-slim-bookworm

ARG LITESTREAM_VERSION=0.3.13
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    CW_DB_PATH=/data/coursewright.db \
    CW_NODE_BIN=/usr/local/bin/node

# Node 20 (only the binary is needed: the Flowmovie scripts have no npm dependencies).
COPY --from=node /usr/local/bin/node /usr/local/bin/node

# uv, pinned.
COPY --from=ghcr.io/astral-sh/uv:0.11.29 /uv /uvx /usr/local/bin/

# Litestream.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && arch="$(dpkg --print-architecture)" \
 && curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${arch}.tar.gz" \
    | tar -xz -C /usr/local/bin litestream \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, for layer caching.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY vendor ./vendor
COPY evals ./evals
COPY README.md litestream.yml start.sh ./
RUN uv sync --frozen --no-dev && chmod +x start.sh && node --version

EXPOSE 8123
CMD ["./start.sh"]
