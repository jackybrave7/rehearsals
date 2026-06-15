#!/usr/bin/env bash
set -eo pipefail

REMOTE_DIR="${REMOTE_DIR:-/var/www/rehearsals}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-rehearsals-api}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"

load_node_env() {
  set +u

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  export PATH="/usr/local/bin:/usr/bin:${PATH:-}"

  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
  fi

  if ! command -v npm >/dev/null 2>&1 && [ -s "$HOME/.profile" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.profile" || true
  fi

  if ! command -v npm >/dev/null 2>&1 && [ -s "$HOME/.bashrc" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.bashrc" || true
  fi
}

has_host_npm() {
  command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1
}

has_docker() {
  command -v docker >/dev/null 2>&1
}

run_in_node_container() {
  local cmd="$1"
  local env_file_args=()
  if [ -f "$REMOTE_DIR/.env" ]; then
    env_file_args=(--env-file "$REMOTE_DIR/.env")
  fi

  echo "[deploy] docker run $NODE_IMAGE: $cmd"
  docker run --rm \
    -v "$REMOTE_DIR:/app" \
    -w /app \
    "${env_file_args[@]}" \
    "$NODE_IMAGE" \
    bash -lc "$cmd"
}

host_node_major() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0
}

host_node_ok() {
  if ! has_host_npm; then
    return 1
  fi
  [ "$(host_node_major)" -ge 20 ]
}

use_docker_build() {
  has_docker
}

npm_install() {
  if use_docker_build; then
    run_in_node_container "if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi"
    return
  fi

  if host_node_ok; then
    echo "[deploy] npm install (host)..."
    if [ -f package-lock.json ]; then
      npm ci || npm install
    else
      npm install
    fi
    return
  fi

  echo "[deploy] ERROR: need docker or Node.js 20+ on host (current: $(node -v 2>/dev/null || echo missing))"
  exit 127
}

npm_build() {
  if use_docker_build; then
    run_in_node_container "npm run build"
    return
  fi

  if host_node_ok; then
    echo "[deploy] npm run build (host)..."
    npm run build
    return
  fi

  echo "[deploy] ERROR: cannot run build"
  exit 127
}

restart_api() {
  if has_docker && docker ps -a --format '{{.Names}}' | grep -qx "$DOCKER_CONTAINER"; then
    echo "[deploy] docker restart $DOCKER_CONTAINER..."
    docker restart "$DOCKER_CONTAINER"
    return
  fi

  if command -v pm2 >/dev/null 2>&1 && pm2 describe rehearsals-api >/dev/null 2>&1; then
    echo "[deploy] pm2 restart rehearsals-api..."
    pm2 restart rehearsals-api
    pm2 save
    return
  fi

  echo "[deploy] ERROR: API runtime not found (docker:$DOCKER_CONTAINER or pm2:rehearsals-api)"
  exit 1
}

if [ ! -d "$REMOTE_DIR" ]; then
  echo "[deploy] ERROR: directory not found: $REMOTE_DIR"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "[deploy] ERROR: git not found"
  exit 127
fi

if ! has_docker && ! has_host_npm; then
  echo "[deploy] ERROR: need docker or npm on host"
  exit 127
fi

load_node_env

cd "$REMOTE_DIR"

echo "[deploy] $(date -Is) - $REMOTE_DIR"
if use_docker_build; then
  echo "[deploy] build via docker ($NODE_IMAGE)"
elif host_node_ok; then
  echo "[deploy] node: $(command -v node) ($(node -v))"
  echo "[deploy] npm:  $(command -v npm) ($(npm -v))"
else
  echo "[deploy] host node: $(node -v 2>/dev/null || echo missing) — too old, will use docker if available"
fi

echo "[deploy] git pull..."
git fetch origin
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git reset --hard "origin/${BRANCH}"

if [ ! -f .env ]; then
  echo "[deploy] WARNING: .env missing. Copy from .env.example before build."
fi

npm_install
npm_build
restart_api

echo "[deploy] waiting for API..."
for i in 1 2 3 4 5 6; do
  HEALTH=$(curl -sf "http://127.0.0.1:${API_PORT:-3001}/api/health" || true)
  if [ -n "$HEALTH" ]; then
    break
  fi
  echo "[deploy] API not ready yet, retry $i/6..."
  sleep 5
done

echo "[deploy] health check..."
HEALTH=$(curl -sf "http://127.0.0.1:${API_PORT:-3001}/api/health" || true)
echo "$HEALTH"
if echo "$HEALTH" | grep -q '"service":"rehearsals"'; then
  echo "[deploy] Done."
elif echo "$HEALTH" | grep -q '"ok":true'; then
  echo "[deploy] WARNING: API is up but code looks old (no service:rehearsals)."
  echo "[deploy] Push latest commits and run deploy again."
  exit 1
else
  echo "[deploy] ERROR: API health check failed"
  exit 1
fi
