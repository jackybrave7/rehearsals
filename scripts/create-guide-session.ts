/**
 * Creates a short-lived dev session for guide screenshot capture.
 * Uses the first theater owner in the local DB — does not print user email.
 */
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, '..', '.guide-session-token');

const GUIDE_SESSION_TOKEN = 'guide-screenshot-dev-session-token-v1';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sessionExpiryIso(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + 1);
  return expires.toISOString();
}

const db = getDb();

const ownerRow = db
  .prepare(
    `SELECT owner_user_id AS userId FROM theaters WHERE owner_user_id IS NOT NULL LIMIT 1`
  )
  .get() as { userId: string } | undefined;

if (!ownerRow?.userId) {
  console.error('No theater with owner found in local DB. Log in once and create a theater.');
  process.exit(1);
}

db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(GUIDE_SESSION_TOKEN));

const sessionId = uuidv4();
db.prepare(
  `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
).run(sessionId, ownerRow.userId, hashToken(GUIDE_SESSION_TOKEN), sessionExpiryIso());

writeFileSync(TOKEN_FILE, GUIDE_SESSION_TOKEN, 'utf8');
console.log('Session ready for guide screenshots.');
console.log(`Token file: ${TOKEN_FILE}`);
