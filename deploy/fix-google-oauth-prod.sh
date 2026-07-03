#!/usr/bin/env bash
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/var/www/rehearsals}"
CLIENT_ID="${CLIENT_ID:-148056464382-lfksbhtelmtvbcbhr4i5a7u7ne5g4gv3.apps.googleusercontent.com}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"

cd "$REMOTE_DIR"

echo "[fix-google] updating VITE_GOOGLE_CLIENT_ID in .env"
sed -i '/^VITE_GOOGLE_CLIENT_ID=/d' .env
printf '%s\n' "VITE_GOOGLE_CLIENT_ID=${CLIENT_ID}" >> .env

echo "[fix-google] rebuilding frontend"
docker run --rm \
  -v "$REMOTE_DIR:/app" \
  --env-file "$REMOTE_DIR/.env" \
  -w /app \
  "$NODE_IMAGE" \
  bash -lc 'if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi && npm run build'

if grep -rq '148056464382' dist/; then
  echo "[fix-google] OK: new client id baked into dist"
else
  echo "[fix-google] ERROR: new client id not found in dist"
  exit 1
fi

if grep -rq '835632674586' dist/; then
  echo "[fix-google] ERROR: old disabled client id still in dist"
  exit 1
fi

echo "[fix-google] Done. Test Google sign-in at https://rehears.ru"
