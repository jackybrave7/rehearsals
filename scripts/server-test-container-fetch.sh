#!/usr/bin/env bash
docker exec rehearsals-api node <<'NODE'
fetch('https://api.telegram.org', { signal: AbortSignal.timeout(15000) })
  .then((r) => console.log('status', r.status))
  .catch((e) => console.log('error', e.cause?.code || e.message));
NODE
