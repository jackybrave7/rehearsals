#!/usr/bin/env node
/**
 * Проверка SPF / DKIM / DMARC для доставки на Mail.ru
 * node scripts/check-mail-dns.mjs [domain]
 */
import dns from 'node:dns/promises';

const domain = (process.argv[2] ?? 'rehears.ru').trim().toLowerCase();

async function txt(name) {
  try {
    const rows = await dns.resolveTxt(name);
    return rows.map((p) => p.join(''));
  } catch {
    return [];
  }
}

function ok(label, pass, detail) {
  console.log(`${pass ? '✓' : '✗'} ${label}: ${detail}`);
}

const spfRows = await txt(domain);
const spf = spfRows.find((r) => r.toLowerCase().startsWith('v=spf1'));
ok('SPF', Boolean(spf?.includes('timeweb')), spf ?? 'не найден');

const dmarcRows = await txt(`_dmarc.${domain}`);
const dmarc = dmarcRows.find((r) => r.toLowerCase().startsWith('v=dmarc1'));
ok('DMARC', Boolean(dmarc), dmarc ?? 'не найден');

for (const selector of ['mail', 'dkim']) {
  const rows = await txt(`${selector}._domainkey.${domain}`);
  const raw = rows[0];
  const valid = Boolean(raw?.toLowerCase().includes('v=dkim1') && /p=/i.test(raw ?? ''));
  ok(`DKIM ${selector}`, valid, raw ? (valid ? 'ok' : 'есть, но без v=DKIM1') : 'не найден');
}

console.log('\nПостмастер: https://postmaster.mail.ru/');
console.log(`Верификация: https://${domain}/mailru-verification120c4ec91218f839.html`);
