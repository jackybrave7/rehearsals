#!/usr/bin/env bash
docker inspect rehearsals-api --format '{{range .Config.Env}}{{println .}}{{end}}' | sort
