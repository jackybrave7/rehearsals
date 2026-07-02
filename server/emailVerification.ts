import { createHash, randomBytes } from 'node:crypto';
import type { AppDatabase } from './db.js';

const VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createEmailVerificationToken(db: AppDatabase, userId: string): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  db.prepare(
    `UPDATE users
     SET email_verification_token_hash = ?, email_verification_expires_at = ?
     WHERE id = ?`
  ).run(hashVerificationToken(token), expiresAt, userId);
  return token;
}

export function markEmailVerified(db: AppDatabase, userId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE users
     SET email_verified_at = ?,
         email_verification_token_hash = NULL,
         email_verification_expires_at = NULL
     WHERE id = ?`
  ).run(now, userId);
}

export function verifyEmailByToken(db: AppDatabase, token: string): { userId: string } | null {
  const tokenHash = hashVerificationToken(token);
  const row = db
    .prepare(
      `SELECT id, email_verification_expires_at
       FROM users
       WHERE email_verification_token_hash = ?`
    )
    .get(tokenHash) as { id: string; email_verification_expires_at: string | null } | undefined;

  if (!row?.email_verification_expires_at) return null;
  if (new Date(row.email_verification_expires_at).getTime() < Date.now()) return null;

  markEmailVerified(db, row.id);
  return { userId: row.id };
}

export function isEmailVerified(
  db: AppDatabase,
  userId: string
): boolean {
  const row = db
    .prepare(`SELECT email_verified_at FROM users WHERE id = ?`)
    .get(userId) as { email_verified_at: string | null } | undefined;
  return Boolean(row?.email_verified_at);
}
