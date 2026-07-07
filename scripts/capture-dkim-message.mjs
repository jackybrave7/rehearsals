#!/usr/bin/env node
/** Dump raw MIME to verify DKIM-Signature is present (no SMTP send). */
import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

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

function readDkimPrivateKey() {
  const keyPath = process.env.SMTP_DKIM_PRIVATE_KEY_PATH?.trim();
  if (keyPath) {
    const resolved = keyPath.startsWith('/') ? keyPath : resolve(root, keyPath);
    return readFileSync(resolved, 'utf8').trim();
  }
  return process.env.SMTP_DKIM_PRIVATE_KEY?.replace(/\\n/g, '\n').trim() ?? '';
}

const domain = process.env.SMTP_DKIM_DOMAIN?.trim();
const selector = process.env.SMTP_DKIM_SELECTOR?.trim() || 'mail';
const privateKey = readDkimPrivateKey();
const from = process.env.SMTP_FROM?.trim() || 'support@rehears.ru';
const fromDomain = from.split('@')[1] ?? 'rehears.ru';

const transporter = nodemailer.createTransport({
  streamTransport: true,
  newline: 'unix',
  buffer: true,
  dkim: domain && privateKey ? { domainName: domain, keySelector: selector, privateKey } : undefined,
});

const info = await transporter.sendMail({
  from: `"Репетиции" <${from}>`,
  to: 'test@mail.ru',
  subject: 'Подтвердите email — Репетиции',
  text: 'Тест',
  headers: {
    'Message-ID': `<${randomUUID()}@${fromDomain}>`,
    'X-Mailer': 'Rehearsals',
    'X-Mailru-Msgtype': 'registration',
    'X-Postmaster-Msgtype': 'registration',
  },
});

const raw = info.message.toString();
const hasDkim = raw.includes('DKIM-Signature');
const hasUnsub = /list-unsubscribe/i.test(raw);
console.log('DKIM-Signature present:', hasDkim);
console.log('List-Unsubscribe present:', hasUnsub);
if (hasDkim) {
  const line = raw.match(/DKIM-Signature: ([^\r\n]+)/)?.[1] ?? '';
  console.log('d=', line.match(/\bd=([^;]+)/)?.[1]);
  console.log('s=', line.match(/\bs=([^;]+)/)?.[1]);
}
console.log('Headers preview:\n', raw.split('\n\n')[0]);
