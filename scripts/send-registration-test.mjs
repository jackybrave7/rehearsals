#!/usr/bin/env node
/** Send registration verification email: node scripts/send-registration-test.mjs user@mail.ru */
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

const to = process.argv[2]?.trim();
if (!to || !to.includes('@')) {
  console.error('Usage: node scripts/send-registration-test.mjs recipient@mail.ru');
  process.exit(1);
}

const { sendEmailVerificationEmail } = await import('../server/mail.ts');
await sendEmailVerificationEmail(to, 'Тест', `test-${Date.now()}`, { betaMode: false });
console.log('Registration test email sent to', to);
