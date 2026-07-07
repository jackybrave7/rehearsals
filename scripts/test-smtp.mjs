#!/usr/bin/env node
/**
 * Тест SMTP: node scripts/test-smtp.mjs recipient@example.com
 * Читает .env из корня проекта (как API).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
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

const to = process.argv[2]?.trim();
if (!to || !to.includes('@')) {
  console.error('Usage: node scripts/test-smtp.mjs recipient@example.com');
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

if (!host || !user || !pass || !from) {
  console.error('SMTP not configured in .env (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM)');
  process.exit(1);
}

const domain = from.split('@')[1] ?? 'rehears.ru';
const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  tls: { minVersion: 'TLSv1.2' },
});

const subject = 'Тест доставки — rehears.ru';
const text = [
  'Это тестовое письмо с сервера Репетиции.',
  '',
  `Время: ${new Date().toISOString()}`,
  `Получатель: ${to}`,
  '',
  'Если письмо во входящих — SMTP и DNS в порядке.',
  'Если в спаме или не пришло — настройте DKIM (см. deploy/mail-deliverability.md).',
].join('\n');

const info = await transporter.sendMail({
  from: `"Репетиции" <${from}>`,
  to,
  subject,
  text,
  headers: {
    'Message-ID': `<${randomUUID()}@${domain}>`,
  },
  envelope: { from, to },
});

console.log('Sent:', {
  to,
  messageId: info.messageId,
  accepted: info.accepted,
  rejected: info.rejected,
  response: info.response,
});
