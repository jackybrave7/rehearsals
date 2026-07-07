#!/usr/bin/env node
/**
 * Генерация DKIM для подписи писем с VPS (nodemailer).
 * node scripts/setup-smtp-dkim.mjs [domain]
 */
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const domain = (process.argv[2] ?? 'rehears.ru').trim().toLowerCase();
const writeEnv = process.argv.includes('--write-env');
const selector = 'mail';
const keyDir = resolve(root, 'data', 'dkim');
const privatePath = resolve(keyDir, `${domain}.private.pem`);

mkdirSync(keyDir, { recursive: true });

let privateKeyPem;
if (existsSync(privatePath)) {
  privateKeyPem = readFileSync(privatePath, 'utf8');
  console.log(`[dkim] Using existing private key: ${privatePath}`);
} else {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKeyPem = pair.privateKey;
  writeFileSync(privatePath, privateKeyPem, { mode: 0o600 });
  console.log(`[dkim] Generated private key: ${privatePath}`);
}

const publicFromPrivate = createPublicKey(privateKeyPem).export({
  type: 'spki',
  format: 'pem',
});
const publicBody = publicFromPrivate
  .replace(/-----BEGIN PUBLIC KEY-----/g, '')
  .replace(/-----END PUBLIC KEY-----/g, '')
  .replace(/\s/g, '');

const dnsValue = `v=DKIM1; k=rsa; p=${publicBody}`;

console.log('\n=== DNS (TimeWeb → Домены → rehears.ru → DNS → TXT) ===');
console.log(`Хост: ${selector}._domainkey`);
console.log(`Значение:\n${dnsValue}\n`);

console.log('=== .env на сервере (рекомендуется) ===');
console.log(`SMTP_DKIM_DOMAIN=${domain}`);
console.log(`SMTP_DKIM_SELECTOR=${selector}`);
console.log(`SMTP_DKIM_PRIVATE_KEY_PATH=data/dkim/${domain}.private.pem`);
console.log('');
console.log('Не кладите приватный ключ в .env — Docker портит многострочные значения.');

console.log('\n=== После добавления DNS ===');
console.log('1. Подождите 15–60 минут');
console.log('2. node scripts/check-mail-dns.mjs');
console.log('3. docker restart rehearsals-api');
console.log('4. node scripts/test-smtp.mjs ваш@mail.ru');
console.log('5. https://postmaster.mail.ru/ → добавить домен');

if (writeEnv) {
  const envPath = resolve(root, '.env');
  let envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const lines = [
    `SMTP_DKIM_DOMAIN=${domain}`,
    `SMTP_DKIM_SELECTOR=${selector}`,
    `SMTP_DKIM_PRIVATE_KEY_PATH=data/dkim/${domain}.private.pem`,
  ];
  for (const line of lines) {
    const key = line.split('=')[0];
    const re = new RegExp(`^${key}=.*$`, 'm');
    envText = re.test(envText) ? envText.replace(re, line) : `${envText.trimEnd()}\n${line}\n`;
  }
  envText = envText.replace(/^SMTP_DKIM_PRIVATE_KEY=.*\n?/m, '');
  writeFileSync(envPath, envText.endsWith('\n') ? envText : `${envText}\n`, 'utf8');
  console.log(`\n[dkim] Updated ${envPath}`);
}
