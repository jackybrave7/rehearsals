import { readFileSync } from 'node:fs';

for (const line of readFileSync('/app/.env', 'utf8').split('\n')) {
  const m = /^TELEGRAM_BOT_TOKEN=(.*)$/.exec(line.trim());
  if (m) process.env.TELEGRAM_BOT_TOKEN = m[1];
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.log('no token');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
  signal: AbortSignal.timeout(15000),
});
console.log('getMe', res.status, await res.text());
