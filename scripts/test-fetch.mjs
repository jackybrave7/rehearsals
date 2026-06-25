fetch('https://api.telegram.org', { signal: AbortSignal.timeout(15000) })
  .then((r) => {
    console.log('status', r.status);
    process.exit(0);
  })
  .catch((e) => {
    console.log('error', e.cause?.code || e.message);
    process.exit(1);
  });
