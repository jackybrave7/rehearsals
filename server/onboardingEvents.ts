import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, type AppDatabase } from './db.js';
import { requireAuth } from './auth.js';
import {
  ONBOARDING_EVENT_TYPES,
  type OnboardingEventType,
  ONBOARDING_EVENT_LABELS,
} from '../shared/onboardingEvents.js';

function isOnboardingEventType(value: string): value is OnboardingEventType {
  return (ONBOARDING_EVENT_TYPES as readonly string[]).includes(value);
}

export function touchUserLastActive(db: AppDatabase, userId: string, at = new Date().toISOString()) {
  db.prepare(`UPDATE users SET last_active_at = ? WHERE id = ?`).run(at, userId);
}

export function touchUserLastLogin(db: AppDatabase, userId: string, at = new Date().toISOString()) {
  db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).run(at, userId);
}

export function recordOnboardingEvent(
  db: AppDatabase,
  userId: string,
  eventType: OnboardingEventType,
  theaterId?: string | null
) {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO user_onboarding_events (id, user_id, event_type, theater_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), userId, eventType, theaterId ?? null, createdAt);
}

export interface UserOnboardingEventRow {
  eventType: OnboardingEventType;
  label: string;
  createdAt: string;
  theaterId: string | null;
}

export function listOnboardingEventsForUser(
  db: AppDatabase,
  userId: string
): UserOnboardingEventRow[] {
  const rows = db
    .prepare(
      `SELECT event_type, theater_id, created_at
       FROM user_onboarding_events
       WHERE user_id = ?
       ORDER BY created_at ASC`
    )
    .all(userId) as Array<{ event_type: string; theater_id: string | null; created_at: string }>;

  return rows
    .filter((row) => isOnboardingEventType(row.event_type))
    .map((row) => ({
      eventType: row.event_type as OnboardingEventType,
      label: ONBOARDING_EVENT_LABELS[row.event_type as OnboardingEventType],
      createdAt: row.created_at,
      theaterId: row.theater_id,
    }));
}

export function userHasTheaterTelegram(db: AppDatabase, userId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok
       FROM theaters t
       JOIN theater_members tm ON tm.theater_id = t.id AND tm.user_id = ?
       WHERE t.telegram_chat_id IS NOT NULL AND trim(t.telegram_chat_id) <> ''
       LIMIT 1`
    )
    .get(userId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

export function registerOnboardingEventRoutes(app: Express) {
  app.post('/api/onboarding-events', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const eventType = typeof req.body?.eventType === 'string' ? req.body.eventType.trim() : '';
    const theaterId =
      typeof req.body?.theaterId === 'string' && req.body.theaterId.trim()
        ? req.body.theaterId.trim()
        : null;

    if (!isOnboardingEventType(eventType)) {
      res.status(400).json({ error: 'INVALID_EVENT_TYPE' });
      return;
    }

    const db = getDb();
    recordOnboardingEvent(db, session.user.id, eventType, theaterId);
    touchUserLastActive(db, session.user.id);
    res.json({ ok: true });
  });
}
