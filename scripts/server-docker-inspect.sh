#!/usr/bin/env bash
docker inspect rehearsals-api --format '{{.Name}} image={{.Config.Image}}'
docker inspect rehearsals-api --format 'NetworkMode={{.HostConfig.NetworkMode}}'
docker inspect rehearsals-api --format '{{range .Config.Env}}{{println .}}{{end}}' | grep TELEGRAM | sed 's/=.*/=MASKED/'
echo "--- full cmd ---"
docker inspect rehearsals-api --format '{{.Path}} {{join .Args " "}}'
tr '\0' ' ' < /proc/$(docker inspect rehearsals-api --format '{{.State.Pid}}')/cmdline 2>/dev/null || true
echo
docker ps --no-trunc --filter name=rehearsals-api
