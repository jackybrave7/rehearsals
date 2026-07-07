#!/usr/bin/env node
import { createPrivateKey } from 'node:crypto';
import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env');

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const domain = process.env.SMTP_DKIM_DOMAIN?.trim();
const selector = process.env.SMTP_DKIM_SELECTOR?.trim();
function readDkimPrivateKey() {
  const keyPath = process.env.SMTP_DKIM_PRIVATE_KEY_PATH?.trim();
  if (keyPath) {
    const resolved = keyPath.startsWith('/') ? keyPath : resolve(root, keyPath);
    return readFileSync(resolved, 'utf8').trim();
  }
  return process.env.SMTP_DKIM_PRIVATE_KEY?.replace(/\\n/g, '\n').trim() ?? '';
}

const rawKey = readDkimPrivateKey();

console.log('DKIM env:', {
  domain: domain ?? null,
  selector: selector ?? null,
  keyPath: process.env.SMTP_DKIM_PRIVATE_KEY_PATH ?? null,
  keyLength: rawKey.length,
  hasBegin: rawKey.includes('BEGIN PRIVATE KEY'),
  hasEnd: rawKey.includes('END PRIVATE KEY'),
});

if (!rawKey) {
  console.error('FAIL: DKIM private key not found (SMTP_DKIM_PRIVATE_KEY_PATH)');
  process.exit(1);
}

try {
  createPrivateKey(rawKey);
  console.log('OK: private key parses');
} catch (error) {
  console.error('FAIL: private key invalid', error);
  process.exit(1);
}

const host = process.env.SMTP_HOST?.trim();
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const from = process.env.SMTP_FROM?.trim() || user;
const port = Number(process.env.SMTP_PORT ?? 587);
const secure =
  process.env.SMTP_SECURE === '1' ||
  process.env.SMTP_SECURE === 'true' ||
  port === 465;

if (!host || !user || !pass) {
  console.error('FAIL: SMTP not configured');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  dkim: domain && selector && rawKey ? { domainName: domain, keySelector: selector, privateKey: rawKey } : undefined,
  tls: { minVersion: 'TLSv1.2' },
});

const to = process.argv[2]?.trim();
if (!to) {
  console.log('Usage: node scripts/verify-dkim-env.mjs recipient@mail.ru');
  process.exit(0);
}

const info = await transporter.sendMail({
  from: `"Репетиции тест" <${from}>`,
  to,
  subject: 'DKIM verify — rehears.ru',
  text: `Тест DKIM ${new Date().toISOString()}\nЕсли письмо пришло — проверьте заголовок Authentication-Results.`,
  headers: {
    'X-Mailru-Msgtype': 'test',
  },
});

console.log('Sent:', {
  to,
  messageId: info.messageId,
  accepted: info.accepted,
  rejected: info.rejected,
  response: info.response,
});
