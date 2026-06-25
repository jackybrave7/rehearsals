#!/usr/bin/env bash
set -euo pipefail

echo "=== docker network ==="
docker inspect rehearsals-api --format 'NetworkMode={{.HostConfig.NetworkMode}} DNS={{.HostConfig.Dns}}'
docker inspect rehearsals-api --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(TELEGRAM|API_PORT)=' | sed 's/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=MASKED/'

echo "=== host -> telegram ==="
curl -sf --max-time 8 https://api.telegram.org >/dev/null && echo host_ok || echo host_FAIL

echo "=== container -> telegram ==="
docker exec rehearsals-api sh -c 'wget -qO- --timeout=8 https://api.telegram.org >/dev/null && echo container_ok || echo container_FAIL' 2>&1 || echo docker_exec_FAILED

echo "=== container DNS ==="
docker exec rehearsals-api sh -c 'getent hosts api.telegram.org || nslookup api.telegram.org 2>/dev/null | head -5' 2>&1 || true

echo "=== docker run command ==="
docker inspect rehearsals-api --format '{{.Config.Image}} {{json .HostConfig.NetworkMode}}'
