#!/bin/sh
# Container entrypoint. With LITESTREAM_BUCKET set: restore the database from the replica if the volume is
# empty, then run the app under `litestream replicate` so every WAL change is shipped to S3/R2. Without it:
# just run the app (the Fly volume alone keeps the data).
set -e
mkdir -p "$(dirname "$CW_DB_PATH")"
APP="/app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8123 --proxy-headers"

if [ -n "$LITESTREAM_BUCKET" ]; then
  litestream restore -config /app/litestream.yml -if-db-not-exists -if-replica-exists "$CW_DB_PATH"
  exec litestream replicate -config /app/litestream.yml -exec "$APP"
fi
exec $APP
