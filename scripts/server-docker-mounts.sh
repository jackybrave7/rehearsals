#!/usr/bin/env bash
set -euo pipefail
docker inspect rehearsals-api --format 'Binds={{json .HostConfig.Binds}}'
docker inspect rehearsals-api --format 'PortBindings={{json .HostConfig.PortBindings}}'
docker inspect rehearsals-api --format 'EnvFile={{json .HostConfig}}' | head -c 500
docker inspect rehearsals-api --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(TELEGRAM_BOT_TOKEN|API_PORT|NODE_OPTIONS)=' | sed 's/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=MASKED/'
