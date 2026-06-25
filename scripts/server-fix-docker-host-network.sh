#!/usr/bin/env bash
set -euo pipefail
REMOTE_DIR="${REMOTE_DIR:-/var/www/rehearsals}"
NAME="${DOCKER_CONTAINER:-rehearsals-api}"
IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"

cd "$REMOTE_DIR"
docker stop "$NAME" 2>/dev/null || true
docker rm "$NAME" 2>/dev/null || true

docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --network host \
  -v "$REMOTE_DIR:/app" \
  --env-file "$REMOTE_DIR/.env" \
  -e NODE_OPTIONS=--dns-result-order=ipv4first \
  -w /app \
  "$IMAGE" \
  sh -c 'rm -rf node_modules && npm install --omit=dev && npm start'

for i in $(seq 1 12); do
  curl -sf http://127.0.0.1:3001/api/health >/dev/null && break
  sleep 3
done
curl -sf http://127.0.0.1:3001/api/health
echo
docker cp /tmp/test-fetch.mjs "$NAME:/tmp/test-fetch.mjs" 2>/dev/null || true
docker exec "$NAME" node /tmp/test-fetch.mjs
