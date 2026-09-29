import { getDb, type AppDatabase } from './db.js';

export interface OnboardingDripSettings {
  enabled: boolean;
  includeLegacyUsers: boolean;
  /** ISO — момент первого включения цепочки (отсечка «старых» пользователей). */
  launchedAt: string | null;
}

type DripSettingsRow = {
  email_drip_enabled: number | null;
  email_drip_include_legacy: number | null;
  email_drip_launched_at: string | null;
};

function readRow(db: AppDatabase): DripSettingsRow | undefined {
  return db
    .prepare(
      `SELECT email_drip_enabled, email_drip_include_legacy, email_drip_launched_at
       FROM platform_settings WHERE id = 1`
    )
    .get() as DripSettingsRow | undefined;
}

export function getOnboardingDripSettings(db: AppDatabase = getDb()): OnboardingDripSettings {
  const row = readRow(db);
  return {
    enabled: Boolean(row?.email_drip_enabled),
    includeLegacyUsers: Boolean(row?.email_drip_include_legacy),
    launchedAt: row?.email_drip_launched_at ?? null,
  };
}

export function updateOnboardingDripSettings(
  patch: { enabled?: boolean; includeLegacyUsers?: boolean },
  db: AppDatabase = getDb()
): OnboardingDripSettings {
  const current = getOnboardingDripSettings(db);
  const enabled = patch.enabled ?? current.enabled;
  const includeLegacyUsers = patch.includeLegacyUsers ?? current.includeLegacyUsers;

  let launchedAt = current.launchedAt;
  if (enabled && !current.enabled && !launchedAt) {
    launchedAt = new Date().toISOString();
  }

  db.prepare(
    `UPDATE platform_settings
     SET email_drip_enabled = ?,
         email_drip_include_legacy = ?,
         email_drip_launched_at = ?
     WHERE id = 1`
  ).run(enabled ? 1 : 0, includeLegacyUsers ? 1 : 0, launchedAt);

  return getOnboardingDripSettings(db);
}

export function markOnboardingDripSent(
  userId: string,
  stepId: string,
  db: AppDatabase = getDb()
): void {
  db.prepare(
    `INSERT OR IGNORE INTO email_drip_sent (user_id, step_id, sent_at) VALUES (?, ?, ?)`
  ).run(userId, stepId, new Date().toISOString());
}

export function wasOnboardingDripStepSent(
  userId: string,
  stepId: string,
  db: AppDatabase = getDb()
): boolean {
  const row = db
    .prepare(`SELECT 1 FROM email_drip_sent WHERE user_id = ? AND step_id = ?`)
    .get(userId, stepId);
  return Boolean(row);
}

export function getLastOnboardingDripSentAt(userId: string, db: AppDatabase = getDb()): string | null {
  const row = db
    .prepare(`SELECT MAX(sent_at) AS sent_at FROM email_drip_sent WHERE user_id = ?`)
    .get(userId) as { sent_at: string | null } | undefined;
  return row?.sent_at ?? null;
}

export function countOnboardingDripSent(db: AppDatabase = getDb()): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM email_drip_sent`).get() as { c: number };
  return row.c;
}
