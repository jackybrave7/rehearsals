import { getDb, type AppDatabase } from './db.js';

export type RegistrationMode = 'normal' | 'beta';

export interface RegistrationNotificationSettings {
  enabled: boolean;
  email: string;
}

export interface PlatformSettings {
  registrationMode: RegistrationMode;
  registrationNotify: RegistrationNotificationSettings;
}

type PlatformSettingsRow = {
  registration_mode: string;
  registration_notify_enabled: number | null;
  registration_notify_email: string | null;
};

function mapPlatformSettingsRow(row: PlatformSettingsRow | undefined): PlatformSettings {
  return {
    registrationMode: row?.registration_mode === 'beta' ? 'beta' : 'normal',
    registrationNotify: {
      enabled: Boolean(row?.registration_notify_enabled),
      email: row?.registration_notify_email?.trim() ?? '',
    },
  };
}

function readPlatformSettingsRow(db: AppDatabase): PlatformSettingsRow | undefined {
  return db
    .prepare(
      `SELECT registration_mode, registration_notify_enabled, registration_notify_email
       FROM platform_settings WHERE id = 1`
    )
    .get() as PlatformSettingsRow | undefined;
}

export function getPlatformSettings(db: AppDatabase = getDb()): PlatformSettings {
  return mapPlatformSettingsRow(readPlatformSettingsRow(db));
}

export function getRegistrationMode(db: AppDatabase = getDb()): RegistrationMode {
  return getPlatformSettings(db).registrationMode;
}

export function setRegistrationMode(mode: RegistrationMode, db: AppDatabase = getDb()): RegistrationMode {
  db.prepare(`UPDATE platform_settings SET registration_mode = ? WHERE id = 1`).run(mode);
  return mode;
}

export function getRegistrationNotificationSettings(
  db: AppDatabase = getDb()
): RegistrationNotificationSettings {
  return getPlatformSettings(db).registrationNotify;
}

export function setRegistrationNotificationSettings(
  settings: RegistrationNotificationSettings,
  db: AppDatabase = getDb()
): RegistrationNotificationSettings {
  const email = settings.email.trim().toLowerCase();
  db.prepare(
    `UPDATE platform_settings
     SET registration_notify_enabled = ?, registration_notify_email = ?
     WHERE id = 1`
  ).run(settings.enabled ? 1 : 0, email || null);
  return getRegistrationNotificationSettings(db);
}

export function getRegistrationNotificationRecipients(db: AppDatabase = getDb()): string[] {
  const settings = getRegistrationNotificationSettings(db);
  if (!settings.enabled) return [];
  const email = settings.email.trim().toLowerCase();
  return email ? [email] : [];
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

export function isValidNotificationEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
