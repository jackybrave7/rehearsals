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
    -e NODE_ENV=development \
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
  local install_cmd='rm -rf node_modules && if [ -f package-lock.json ]; then npm ci; else npm install; fi && test -x node_modules/.bin/tsc'
  if use_docker_build; then
    run_in_node_container "$install_cmd"
    return
  fi

  if host_node_ok; then
    echo "[deploy] npm install (host)..."
    NODE_ENV=development bash -lc "$install_cmd"
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

npm_prune_for_prod() {
  if use_docker_build; then
    echo "[deploy] npm prune --omit=dev (production runtime)..."
    run_in_node_container "npm prune --omit=dev"
    return
  fi
  if host_node_ok; then
    NODE_ENV=production npm prune --omit=dev
  fi
}

stop_api() {
  if has_docker && docker ps --format '{{.Names}}' | grep -qx "$DOCKER_CONTAINER"; then
    echo "[deploy] docker stop $DOCKER_CONTAINER (free node_modules)..."
    docker stop "$DOCKER_CONTAINER"
  fi
}

api_container_needs_recreate() {
  local cmd
  cmd="$(docker inspect --format '{{join .Config.Cmd " "}}' "$DOCKER_CONTAINER" 2>/dev/null || true)"
  echo "$cmd" | grep -q 'npm install'
}

start_api_container() {
  local env_file_args=()
  if [ -f "$REMOTE_DIR/.env" ]; then
    env_file_args=(--env-file "$REMOTE_DIR/.env")
  fi
  echo "[deploy] docker run $DOCKER_CONTAINER (npm start)..."
  docker run -d \
    --name "$DOCKER_CONTAINER" \
    --restart unless-stopped \
    --network host \
    -v "$REMOTE_DIR:/app" \
    "${env_file_args[@]}" \
    -e NODE_OPTIONS=--dns-result-order=ipv4first \
    -w /app \
    "$NODE_IMAGE" \
    npm start
}

restart_api() {
  if has_docker && docker ps -a --format '{{.Names}}' | grep -qx "$DOCKER_CONTAINER"; then
    echo "[deploy] Recreating $DOCKER_CONTAINER (reload .env)..."
    docker stop "$DOCKER_CONTAINER" 2>/dev/null || true
    docker rm "$DOCKER_CONTAINER" 2>/dev/null || true
    start_api_container
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
echo "[deploy] code at $(git rev-parse --short HEAD) ($(git log -1 --format='%s'))"

if [ -f .env ]; then
  if ! grep -q '^SMTP_HOST=' .env; then
    echo "[deploy] WARNING: SMTP_HOST not set in .env — registration email and password reset will fail."
    echo "[deploy] Add SMTP_* vars on the server (see .env.example), then: docker restart rehearsals-api"
  fi
  google_client_count=$(grep -c '^VITE_GOOGLE_CLIENT_ID=' .env 2>/dev/null || echo 0)
  google_client_value=$(grep '^VITE_GOOGLE_CLIENT_ID=' .env | tail -1 | cut -d= -f2-)
  if [ "$google_client_count" -gt 1 ]; then
    echo "[deploy] WARNING: duplicate VITE_GOOGLE_CLIENT_ID lines in .env — keep only one."
  fi
  if [ -z "$google_client_value" ]; then
    echo "[deploy] WARNING: VITE_GOOGLE_CLIENT_ID is empty — Google Docs sign-in will fail on production."
    echo "[deploy] Set it in .env before npm run build."
  fi
else
  echo "[deploy] WARNING: .env missing. Copy from .env.example before build."
fi

stop_api
npm_install
npm_build
npm_prune_for_prod
restart_api

echo "[deploy] waiting for API..."
for i in $(seq 1 36); do
  HEALTH=$(curl -sf "http://127.0.0.1:${API_PORT:-3001}/api/health" || true)
  if [ -n "$HEALTH" ]; then
    break
  fi
  if [ "$((i % 6))" -eq 0 ]; then
    echo "[deploy] API not ready yet, retry $i/36..."
  fi
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
  if has_docker && docker ps -a --format '{{.Names}}' | grep -qx "$DOCKER_CONTAINER"; then
    echo "[deploy] API container logs (last 80 lines):"
    docker logs "$DOCKER_CONTAINER" --tail 80 2>&1 || true
  fi
  exit 1
fi
