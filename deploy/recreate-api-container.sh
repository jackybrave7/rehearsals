#!/usr/bin/env bash
set -euo pipefail
REMOTE_DIR="${REMOTE_DIR:-/var/www/rehearsals}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-rehearsals-api}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"

cd "$REMOTE_DIR"
docker stop "$DOCKER_CONTAINER" 2>/dev/null || true
docker rm "$DOCKER_CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$DOCKER_CONTAINER" \
  --restart unless-stopped \
  --network host \
  -v "$REMOTE_DIR:/app" \
  --env-file "$REMOTE_DIR/.env" \
  -e NODE_OPTIONS=--dns-result-order=ipv4first \
  -w /app \
  "$NODE_IMAGE" \
  npm start

sleep 3
curl -sf "http://127.0.0.1:${API_PORT:-3001}/api/health"
echo ""
docker exec "$DOCKER_CONTAINER" printenv | grep -E '^SMTP_DKIM_' | sed 's/SMTP_DKIM_PRIVATE_KEY=.*/SMTP_DKIM_PRIVATE_KEY=***/' || echo "WARNING: SMTP_DKIM_* not in container"
