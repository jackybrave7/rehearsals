import type { AppDatabase } from './db.js';
import { getOnboardingDripSettings } from './onboardingDripSettings.js';
import { getRegistrationMode, isRegistrationApproved } from './platformSettings.js';
import { isPlatformAdminEmail } from './platformAdmin.js';

export interface OnboardingDripRecentDelivery {
  sentAt: string;
  email: string;
  subject: string;
  stepTitle: string;
}

export interface OnboardingDripRecentUser {
  id: string;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  registrationApprovedAt: string | null;
  dripLettersSent: number;
  dripBlockers: string[];
}

export interface OnboardingDripDiagnostics {
  registrationMode: 'beta' | 'normal';
  lastDeliveryAt: string | null;
  deliveriesLast24h: number;
  deliveriesLast7d: number;
  recentDeliveries: OnboardingDripRecentDelivery[];
  recentRegistrations: OnboardingDripRecentUser[];
}

function dripBlockers(
  db: AppDatabase,
  user: {
    id: string;
    email: string;
    email_verified_at: string | null;
    registration_approved_at: string | null;
    created_at: string;
  },
  settings: ReturnType<typeof getOnboardingDripSettings>
): string[] {
  const blockers: string[] = [];
  if (!settings.enabled) blockers.push('цепочка выключена');
  if (!user.email_verified_at) blockers.push('email не подтверждён');
  if (isPlatformAdminEmail(user.email)) blockers.push('админ');
  if (getRegistrationMode(db) === 'beta' && !isRegistrationApproved(db, user.id)) {
    blockers.push('beta: нет одобрения регистрации');
  }
  if (!settings.includeLegacyUsers && settings.launchedAt) {
    const created = Date.parse(user.created_at);
    const launched = Date.parse(settings.launchedAt);
    if (Number.isFinite(created) && Number.isFinite(launched) && created < launched) {
      blockers.push('зарегистрирован до запуска цепочки (legacy выкл)');
    }
  }
  return blockers;
}

export function getOnboardingDripDiagnostics(db: AppDatabase): OnboardingDripDiagnostics {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const settings = getOnboardingDripSettings(db);

  const lastDelivery = db
    .prepare(`SELECT MAX(sent_at) AS sent_at FROM email_drip_deliveries`)
    .get() as { sent_at: string | null } | undefined;

  const deliveriesLast24h = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM email_drip_deliveries WHERE sent_at >= ?`)
      .get(since24h) as { c: number }
  ).c;

  const deliveriesLast7d = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM email_drip_deliveries WHERE sent_at >= ?`)
      .get(since7d) as { c: number }
  ).c;

  const recentDeliveries = db
    .prepare(
      `SELECT d.sent_at, d.email, d.subject, s.title AS step_title
       FROM email_drip_deliveries d
       JOIN email_drip_steps s ON s.id = d.step_id
       ORDER BY d.sent_at DESC
       LIMIT 12`
    )
    .all() as Array<{
    sent_at: string;
    email: string;
    subject: string;
    step_title: string;
  }>;

  const recentUsers = db
    .prepare(
      `SELECT u.id, u.email, u.created_at, u.email_verified_at, u.registration_approved_at,
              (SELECT COUNT(*) FROM email_drip_sent ds WHERE ds.user_id = u.id) AS drip_letters
       FROM users u
       WHERE u.created_at >= ?
       ORDER BY u.created_at DESC
       LIMIT 20`
    )
    .all(since3d) as Array<{
    id: string;
    email: string;
    created_at: string;
    email_verified_at: string | null;
    registration_approved_at: string | null;
    drip_letters: number;
  }>;

  return {
    registrationMode: getRegistrationMode(db),
    lastDeliveryAt: lastDelivery?.sent_at ?? null,
    deliveriesLast24h,
    deliveriesLast7d,
    recentDeliveries: recentDeliveries.map((row) => ({
      sentAt: row.sent_at,
      email: row.email,
      subject: row.subject,
      stepTitle: row.step_title,
    })),
    recentRegistrations: recentUsers.map((row) => ({
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
      emailVerifiedAt: row.email_verified_at,
      registrationApprovedAt: row.registration_approved_at,
      dripLettersSent: Number(row.drip_letters),
      dripBlockers: dripBlockers(db, row, settings),
    })),
  };
}