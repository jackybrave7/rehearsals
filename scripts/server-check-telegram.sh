#!/usr/bin/env bash
set -euo pipefail
cd /var/www/rehearsals

echo "=== TELEGRAM_BOT_TOKEN in .env ==="
if [ -f .env ]; then
  if grep -q '^TELEGRAM_BOT_TOKEN=.' .env; then
    echo "TELEGRAM_BOT_TOKEN=set (non-empty)"
  else
    echo "TELEGRAM_BOT_TOKEN=MISSING or empty"
  fi
else
  echo "NO .env file"
fi

echo "=== API runtime ==="
docker ps --format '{{.Names}}' 2>/dev/null | grep -E 'rehearsals' || pm2 describe rehearsals-api 2>/dev/null | head -1 || echo "unknown runtime"

echo "=== health ==="
curl -sf http://127.0.0.1:3001/api/health || echo "health FAILED"
echo

echo "=== telegram config (no auth) ==="
curl -sf 'http://127.0.0.1:3001/api/telegram/config?theaterId=x' || echo "config FAILED"
echo

echo "=== getMe via Telegram API ==="
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  curl -sf "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | head -c 300 || echo "getMe FAILED (network or bad token)"
  echo
else
  echo "skip getMe — no token"
fi

echo "=== recent API logs (telegram) ==="
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx rehearsals-api; then
  docker logs rehearsals-api --tail 30 2>&1 | grep -i telegram || echo "no telegram lines in last 30"
elif command -v pm2 >/dev/null 2>&1; then
  pm2 logs rehearsals-api --lines 30 --nostream 2>&1 | grep -i telegram || echo "no telegram lines"
fi
