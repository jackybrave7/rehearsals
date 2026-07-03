#!/usr/bin/env bash
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/var/www/rehearsals}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"

cd "$REMOTE_DIR"

echo "[sync-frontend] rebuilding"
docker run --rm \
  -v "$REMOTE_DIR:/app" \
  --env-file "$REMOTE_DIR/.env" \
  -w /app \
  "$NODE_IMAGE" \
  bash -lc 'if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi && npm run build'

if grep -rq 'scenes.length === 0 ? .Импортировать сцены' dist/ 2>/dev/null || grep -rq 'Импортировать сцены' dist/; then
  echo "[sync-frontend] OK: import-from-doc build present"
else
  echo "[sync-frontend] WARNING: expected UI strings not found in dist"
fi

echo "[sync-frontend] Done — hard-refresh https://rehears.ru (Ctrl+Shift+R)"
