import { getDb, type AppDatabase } from './db.js';

export type RegistrationMode = 'normal' | 'beta';

export function getRegistrationMode(db: AppDatabase = getDb()): RegistrationMode {
  const row = db
    .prepare(`SELECT registration_mode FROM platform_settings WHERE id = 1`)
    .get() as { registration_mode: string } | undefined;
  return row?.registration_mode === 'beta' ? 'beta' : 'normal';
}

export function setRegistrationMode(mode: RegistrationMode, db: AppDatabase = getDb()): RegistrationMode {
  db.prepare(`UPDATE platform_settings SET registration_mode = ? WHERE id = 1`).run(mode);
  return mode;
}

export function isRegistrationApproved(db: AppDatabase, userId: string): boolean {
  if (getRegistrationMode(db) === 'normal') return true;
  const row = db
    .prepare(`SELECT registration_approved_at FROM users WHERE id = ?`)
    .get(userId) as { registration_approved_at: string | null } | undefined;
  return Boolean(row?.registration_approved_at);
}

export function approveUserRegistration(db: AppDatabase, userId: string): boolean {
  const row = db
    .prepare(`SELECT id, registration_approved_at FROM users WHERE id = ?`)
    .get(userId) as { id: string; registration_approved_at: string | null } | undefined;
  if (!row) return false;
  if (row.registration_approved_at) return true;
  db.prepare(`UPDATE users SET registration_approved_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    userId
  );
  return true;
}
