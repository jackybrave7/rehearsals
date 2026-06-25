#!/usr/bin/env bash
# Пересоздать API-контейнер с IPv4-first для Telegram API
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/var/www/rehearsals}"
NAME="${DOCKER_CONTAINER:-rehearsals-api}"
IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"

cd "$REMOTE_DIR"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $REMOTE_DIR"
  exit 1
fi

echo "[fix] stopping $NAME..."
docker stop "$NAME" 2>/dev/null || true
docker rm "$NAME" 2>/dev/null || true

echo "[fix] starting $NAME with NODE_OPTIONS=--dns-result-order=ipv4first"
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -v "$REMOTE_DIR:/app" \
  -p 127.0.0.1:3001:3001 \
  --env-file "$REMOTE_DIR/.env" \
  -e NODE_OPTIONS=--dns-result-order=ipv4first \
  -w /app \
  "$IMAGE" \
  sh -c 'rm -rf node_modules && npm install --omit=dev && npm start'

echo "[fix] waiting for health..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:3001/api/health >/dev/null; then
    break
  fi
  sleep 3
done

curl -sf http://127.0.0.1:3001/api/health
echo

echo "[fix] container fetch test:"
docker cp /tmp/test-fetch.mjs "$NAME:/tmp/test-fetch.mjs" 2>/dev/null || true
docker exec "$NAME" node /tmp/test-fetch.mjs

echo "[fix] done"
