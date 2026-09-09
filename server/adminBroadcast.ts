import type { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, type AppDatabase } from './db.js';
import { isMailConfigured, sendBroadcastEmail } from './mail.js';
import { requirePlatformAdmin, isPlatformAdminEmail } from './platformAdmin.js';
import { getUserSubscriptionPlan } from './subscription.js';
import {
  buildTrackedBroadcastHtml,
  createBroadcastRecipient,
  extractBroadcastUrls,
  getBroadcastEngagementStats,
  insertBroadcastLinks,
  listBroadcastRecipientEngagement,
  markRecipientFailed,
  markRecipientSent,
  type BroadcastEngagementStats,
  type BroadcastRecipientEngagement,
} from './broadcastTracking.js';

export type BroadcastSubscriptionFilter = 'all' | 'free' | 'pro';
export type BroadcastRegistrationStatusFilter =
  | 'all'
  | 'approved'
  | 'pending_approval'
  | 'pending_email';
export type BroadcastTriStateFilter = 'all' | 'yes' | 'no';

export interface BroadcastFilters {
  registeredFrom?: string;
  registeredTo?: string;
  subscriptionPlan: BroadcastSubscriptionFilter;
  registrationStatus: BroadcastRegistrationStatusFilter;
  emailVerified: BroadcastTriStateFilter;
  hasTheater: BroadcastTriStateFilter;
  isTheaterOwner: BroadcastTriStateFilter;
  minActiveSessions: number;
  excludePlatformAdmins: boolean;
}

export interface BroadcastRecipient {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: 'free' | 'pro';
}

export interface BroadcastPreview {
  recipientCount: number;
  sample: BroadcastRecipient[];
  filters: BroadcastFilters;
}

export interface BroadcastSendResult {
  broadcastId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  failures: Array<{ email: string; error: string }>;
}

export type BroadcastStatus = 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface BroadcastScheduleResult {
  broadcastId: string;
  scheduledAt: string;
  recipientCount: number;
}

export interface BroadcastHistoryItem {
  id: string;
  subject: string;
  bodyPreview: string;
  filters: BroadcastFilters;
  sentByUserId: string;
  sentByEmail: string;
  createdAt: string;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  openedCount: number;
  clickedCount: number;
  openRatePercent: number;
  clickRatePercent: number;
}

export interface BroadcastDetail extends BroadcastHistoryItem {
  bodyText: string;
  stats: BroadcastEngagementStats;
  recipients: BroadcastRecipientEngagement[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || !DATE_RE.test(trimmed)) return undefined;
  return trimmed;
}

function parseTriState(value: unknown, fallback: BroadcastTriStateFilter): BroadcastTriStateFilter {
  return value === 'yes' || value === 'no' || value === 'all' ? value : fallback;
}

function parseRegistrationStatus(value: unknown): BroadcastRegistrationStatusFilter {
  return value === 'approved' ||
    value === 'pending_approval' ||
    value === 'pending_email' ||
    value === 'all'
    ? value
    : 'all';
}

function parseSubscriptionPlan(value: unknown): BroadcastSubscriptionFilter {
  return value === 'free' || value === 'pro' || value === 'all' ? value : 'all';
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function parseMinActiveSessions(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export function parseBroadcastFilters(body: unknown): BroadcastFilters | null {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const filters = input.filters;
  const source = filters && typeof filters === 'object' ? (filters as Record<string, unknown>) : input;

  return {
    registeredFrom: parseDate(source.registeredFrom),
    registeredTo: parseDate(source.registeredTo),
    subscriptionPlan: parseSubscriptionPlan(source.subscriptionPlan),
    registrationStatus: parseRegistrationStatus(source.registrationStatus),
    emailVerified: parseTriState(source.emailVerified, 'yes'),
    hasTheater: parseTriState(source.hasTheater, 'all'),
    isTheaterOwner: parseTriState(source.isTheaterOwner, 'all'),
    minActiveSessions: parseMinActiveSessions(source.minActiveSessions),
    excludePlatformAdmins: parseBoolean(source.excludePlatformAdmins, true),
  };
}

function buildRecipientQuery(filters: BroadcastFilters): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.registeredFrom) {
    conditions.push(`date(u.created_at) >= date(?)`);
    params.push(filters.registeredFrom);
  }
  if (filters.registeredTo) {
    conditions.push(`date(u.created_at) <= date(?)`);
    params.push(filters.registeredTo);
  }
  if (filters.emailVerified === 'yes') {
    conditions.push(`u.email_verified_at IS NOT NULL`);
  } else if (filters.emailVerified === 'no') {
    conditions.push(`u.email_verified_at IS NULL`);
  }
  if (filters.registrationStatus === 'approved') {
    conditions.push(`u.registration_approved_at IS NOT NULL`);
  } else if (filters.registrationStatus === 'pending_approval') {
    conditions.push(`u.email_verified_at IS NOT NULL AND u.registration_approved_at IS NULL`);
  } else if (filters.registrationStatus === 'pending_email') {
    conditions.push(`u.email_verified_at IS NULL`);
  }
  if (filters.hasTheater === 'yes') {
    conditions.push(
      `EXISTS (SELECT 1 FROM theater_members tm WHERE tm.user_id = u.id UNION SELECT 1 FROM theaters t WHERE t.owner_user_id = u.id)`
    );
  } else if (filters.hasTheater === 'no') {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM theater_members tm WHERE tm.user_id = u.id UNION SELECT 1 FROM theaters t WHERE t.owner_user_id = u.id)`
    );
  }
  if (filters.isTheaterOwner === 'yes') {
    conditions.push(`EXISTS (SELECT 1 FROM theaters t WHERE t.owner_user_id = u.id)`);
  } else if (filters.isTheaterOwner === 'no') {
    conditions.push(`NOT EXISTS (SELECT 1 FROM theaters t WHERE t.owner_user_id = u.id)`);
  }
  if (filters.minActiveSessions > 0) {
    conditions.push(
      `(SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) >= ?`
    );
    params.push(new Date().toISOString(), filters.minActiveSessions);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return {
    sql: `SELECT u.id, u.email, u.name
          FROM users u
          ${where}
          ORDER BY u.created_at DESC`,
    params,
  };
}

export function queryBroadcastRecipients(
  filters: BroadcastFilters,
  db: AppDatabase = getDb()
): BroadcastRecipient[] {
  const { sql, params } = buildRecipientQuery(filters);
  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    email: string;
    name: string;
  }>;

  return rows
    .filter((row) => {
      if (filters.excludePlatformAdmins && isPlatformAdminEmail(row.email)) return false;
      if (filters.subscriptionPlan === 'all') return true;
      return getUserSubscriptionPlan(db, row.id, row.email) === filters.subscriptionPlan;
    })
    .map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      subscriptionPlan: getUserSubscriptionPlan(db, row.id, row.email),
    }));
}

export function previewBroadcast(
  filters: BroadcastFilters,
  db: AppDatabase = getDb()
): BroadcastPreview {
  const recipients = queryBroadcastRecipients(filters, db);
  return {
    recipientCount: recipients.length,
    sample: recipients.slice(0, 8),
    filters,
  };
}

function readBroadcastEmailDelayMs(): number {
  const parsed = Number(process.env.BROADCAST_EMAIL_DELAY_MS ?? 500);
  if (!Number.isFinite(parsed) || parsed < 0) return 500;
  return Math.min(Math.floor(parsed), 10_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function insertBroadcastLog(
  db: AppDatabase,
  entry: {
    id: string;
    subject: string;
    bodyText: string;
    filters: BroadcastFilters;
    sentByUserId: string;
    recipientCount: number;
    successCount: number;
    failureCount: number;
    createdAt?: string;
    status?: BroadcastStatus;
    scheduledAt?: string | null;
    sentAt?: string | null;
  }
): void {
  db.prepare(
    `INSERT INTO email_broadcasts (
       id, subject, body_text, filters_json, sent_by_user_id, created_at,
       recipient_count, success_count, failure_count, status, scheduled_at, sent_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.id,
    entry.subject,
    entry.bodyText,
    JSON.stringify(entry.filters),
    entry.sentByUserId,
    entry.createdAt ?? new Date().toISOString(),
    entry.recipientCount,
    entry.successCount,
    entry.failureCount,
    entry.status ?? 'sent',
    entry.scheduledAt ?? null,
    entry.sentAt ?? null
  );
}

function updateBroadcastCounts(
  db: AppDatabase,
  broadcastId: string,
  successCount: number,
  failureCount: number,
  recipientCount: number
): void {
  db.prepare(
    `UPDATE email_broadcasts
     SET success_count = ?, failure_count = ?, recipient_count = ?, status = 'sent', sent_at = ?
     WHERE id = ?`
  ).run(successCount, failureCount, recipientCount, new Date().toISOString(), broadcastId);
}

function loadBroadcastRow(broadcastId: string, db: AppDatabase) {
  return db
    .prepare(
      `SELECT id, subject, body_text, filters_json, sent_by_user_id, status
       FROM email_broadcasts
       WHERE id = ?`
    )
    .get(broadcastId) as
    | {
        id: string;
        subject: string;
        body_text: string;
        filters_json: string;
        sent_by_user_id: string;
        status: string;
      }
    | undefined;
}

function parseStoredBroadcastFilters(filtersJson: string): BroadcastFilters {
  let filters: BroadcastFilters = {
    subscriptionPlan: 'all',
    registrationStatus: 'all',
    emailVerified: 'all',
    hasTheater: 'all',
    isTheaterOwner: 'all',
    minActiveSessions: 0,
    excludePlatformAdmins: true,
  };
  try {
    const parsed = JSON.parse(filtersJson) as Partial<BroadcastFilters>;
    filters = {
      registeredFrom: parsed.registeredFrom,
      registeredTo: parsed.registeredTo,
      subscriptionPlan: parseSubscriptionPlan(parsed.subscriptionPlan),
      registrationStatus: parseRegistrationStatus(parsed.registrationStatus),
      emailVerified: parseTriState(parsed.emailVerified, 'all'),
      hasTheater: parseTriState(parsed.hasTheater, 'all'),
      isTheaterOwner: parseTriState(parsed.isTheaterOwner, 'all'),
      minActiveSessions: parseMinActiveSessions(parsed.minActiveSessions),
      excludePlatformAdmins: parseBoolean(parsed.excludePlatformAdmins, true),
    };
  } catch {
    // keep defaults
  }
  return filters;
}

export async function dispatchBroadcast(
  broadcastId: string,
  db: AppDatabase = getDb()
): Promise<BroadcastSendResult> {
  if (!isMailConfigured()) {
    throw new Error('MAIL_NOT_CONFIGURED');
  }

  const row = loadBroadcastRow(broadcastId, db);
  if (!row) {
    throw new Error('NOT_FOUND');
  }
  if (row.status !== 'scheduled' && row.status !== 'sending') {
    throw new Error('INVALID_STATUS');
  }

  const filters = parseStoredBroadcastFilters(row.filters_json);
  const recipients = queryBroadcastRecipients(filters, db);
  const urls = extractBroadcastUrls(row.body_text);
  const links = insertBroadcastLinks(broadcastId, urls, db);
  const failures: Array<{ email: string; error: string }> = [];
  let sentCount = 0;

  db.prepare(`UPDATE email_broadcasts SET recipient_count = ? WHERE id = ?`).run(
    recipients.length,
    broadcastId
  );

  for (const recipient of recipients) {
    const recipientId = createBroadcastRecipient(
      broadcastId,
      recipient.id,
      recipient.email,
      db
    );
    const greeting = recipient.name.trim() || recipient.email.split('@')[0] || 'коллега';
    const html = buildTrackedBroadcastHtml({
      greeting,
      bodyText: row.body_text,
      recipientId,
      links,
    });

    try {
      await sendBroadcastEmail({
        to: recipient.email,
        name: recipient.name,
        subject: row.subject,
        bodyText: row.body_text,
        html,
      });
      markRecipientSent(recipientId, db);
      sentCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SEND_FAILED';
      markRecipientFailed(recipientId, message, db);
      failures.push({
        email: recipient.email,
        error: message,
      });
    }
    await sleep(readBroadcastEmailDelayMs());
  }

  updateBroadcastCounts(db, broadcastId, sentCount, failures.length, recipients.length);

  return {
    broadcastId,
    recipientCount: recipients.length,
    sentCount,
    failedCount: failures.length,
    failures: failures.slice(0, 20),
  };
}

export async function sendBroadcast(
  filters: BroadcastFilters,
  subject: string,
  bodyText: string,
  sentByUserId: string,
  db: AppDatabase = getDb()
): Promise<BroadcastSendResult> {
  if (!isMailConfigured()) {
    throw new Error('MAIL_NOT_CONFIGURED');
  }

  const recipients = queryBroadcastRecipients(filters, db);
  const broadcastId = uuidv4();
  const createdAt = new Date().toISOString();

  insertBroadcastLog(db, {
    id: broadcastId,
    subject,
    bodyText,
    filters,
    sentByUserId,
    recipientCount: recipients.length,
    successCount: 0,
    failureCount: 0,
    createdAt,
    status: 'sending',
  });

  try {
    return await dispatchBroadcast(broadcastId, db);
  } catch (error) {
    db.prepare(`UPDATE email_broadcasts SET status = 'failed' WHERE id = ?`).run(broadcastId);
    throw error;
  }
}

const MIN_SCHEDULE_LEAD_MS = 60_000;

function parseScheduledAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function scheduleBroadcast(
  filters: BroadcastFilters,
  subject: string,
  bodyText: string,
  sentByUserId: string,
  scheduledAt: string,
  db: AppDatabase = getDb()
): BroadcastScheduleResult {
  if (!isMailConfigured()) {
    throw new Error('MAIL_NOT_CONFIGURED');
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error('INVALID_SCHEDULE_TIME');
  }
  if (scheduledDate.getTime() <= Date.now() + MIN_SCHEDULE_LEAD_MS) {
    throw new Error('SCHEDULE_TOO_SOON');
  }

  const preview = previewBroadcast(filters, db);
  if (preview.recipientCount === 0) {
    throw new Error('NO_RECIPIENTS');
  }

  const broadcastId = uuidv4();
  insertBroadcastLog(db, {
    id: broadcastId,
    subject,
    bodyText,
    filters,
    sentByUserId,
    recipientCount: preview.recipientCount,
    successCount: 0,
    failureCount: 0,
    status: 'scheduled',
    scheduledAt: scheduledDate.toISOString(),
  });

  return {
    broadcastId,
    scheduledAt: scheduledDate.toISOString(),
    recipientCount: preview.recipientCount,
  };
}

export function cancelScheduledBroadcast(
  broadcastId: string,
  db: AppDatabase = getDb()
): boolean {
  const result = db
    .prepare(
      `UPDATE email_broadcasts
       SET status = 'cancelled'
       WHERE id = ? AND status = 'scheduled'`
    )
    .run(broadcastId);
  return result.changes > 0;
}

export async function processDueBroadcasts(db: AppDatabase = getDb()): Promise<number> {
  if (!isMailConfigured()) return 0;

  const now = new Date().toISOString();
  const rows = db
    .prepare(
      `SELECT id
       FROM email_broadcasts
       WHERE status = 'scheduled' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC
       LIMIT 3`
    )
    .all(now) as Array<{ id: string }>;

  let processed = 0;
  for (const row of rows) {
    const claim = db
      .prepare(
        `UPDATE email_broadcasts
         SET status = 'sending'
         WHERE id = ? AND status = 'scheduled'`
      )
      .run(row.id);
    if (claim.changes === 0) continue;

    try {
      await dispatchBroadcast(row.id, db);
      processed += 1;
    } catch (error) {
      console.error('[broadcasts] scheduled send failed', row.id, error);
      db.prepare(`UPDATE email_broadcasts SET status = 'failed' WHERE id = ?`).run(row.id);
    }
  }

  return processed;
}

function parseBroadcastHistoryRow(row: {
  id: string;
  subject: string;
  body_text: string;
  filters_json: string;
  sent_by_user_id: string;
  sent_by_email: string | null;
  created_at: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  success_count: number;
  failure_count: number;
}): BroadcastHistoryItem {
  const filters = parseStoredBroadcastFilters(row.filters_json);
  const status = (
    row.status === 'scheduled' ||
    row.status === 'sending' ||
    row.status === 'sent' ||
    row.status === 'cancelled' ||
    row.status === 'failed'
      ? row.status
      : 'sent'
  ) as BroadcastStatus;

  return {
    id: row.id,
    subject: row.subject,
    bodyPreview: row.body_text.slice(0, 160),
    filters,
    sentByUserId: row.sent_by_user_id,
    sentByEmail: row.sent_by_email ?? '',
    createdAt: row.created_at,
    status,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    recipientCount: row.recipient_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    ...(() => {
      if (status === 'scheduled' || status === 'cancelled') {
        return {
          openedCount: 0,
          clickedCount: 0,
          openRatePercent: 0,
          clickRatePercent: 0,
        };
      }
      const stats = getBroadcastEngagementStats(row.id);
      return {
        openedCount: stats.openedCount,
        clickedCount: stats.clickedCount,
        openRatePercent: stats.openRatePercent,
        clickRatePercent: stats.clickRatePercent,
      };
    })(),
  };
}

export function listBroadcastHistory(limit = 20, db: AppDatabase = getDb()): BroadcastHistoryItem[] {
  const rows = db
    .prepare(
      `SELECT b.id, b.subject, b.body_text, b.filters_json, b.sent_by_user_id, b.created_at,
              b.status, b.scheduled_at, b.sent_at,
              b.recipient_count, b.success_count, b.failure_count,
              u.email AS sent_by_email
       FROM email_broadcasts b
       LEFT JOIN users u ON u.id = b.sent_by_user_id
       ORDER BY COALESCE(b.scheduled_at, b.sent_at, b.created_at) DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    subject: string;
    body_text: string;
    filters_json: string;
    sent_by_user_id: string;
    sent_by_email: string | null;
    created_at: string;
    status: string;
    scheduled_at: string | null;
    sent_at: string | null;
    recipient_count: number;
    success_count: number;
    failure_count: number;
  }>;

  return rows.map(parseBroadcastHistoryRow);
}

export function getBroadcastDetail(
  broadcastId: string,
  db: AppDatabase = getDb()
): BroadcastDetail | null {
  const row = db
    .prepare(
      `SELECT b.id, b.subject, b.body_text, b.filters_json, b.sent_by_user_id, b.created_at,
              b.status, b.scheduled_at, b.sent_at,
              b.recipient_count, b.success_count, b.failure_count,
              u.email AS sent_by_email
       FROM email_broadcasts b
       LEFT JOIN users u ON u.id = b.sent_by_user_id
       WHERE b.id = ?`
    )
    .get(broadcastId) as
    | {
        id: string;
        subject: string;
        body_text: string;
        filters_json: string;
        sent_by_user_id: string;
        sent_by_email: string | null;
        created_at: string;
        status: string;
        scheduled_at: string | null;
        sent_at: string | null;
        recipient_count: number;
        success_count: number;
        failure_count: number;
      }
    | undefined;

  if (!row) return null;

  const summary = parseBroadcastHistoryRow(row);
  return {
    ...summary,
    bodyText: row.body_text,
    stats: getBroadcastEngagementStats(broadcastId, db),
    recipients: listBroadcastRecipientEngagement(broadcastId, db),
  };
}

function parseSendBody(body: unknown): { filters: BroadcastFilters; subject: string; bodyText: string } | null {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const filters = parseBroadcastFilters(input);
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const bodyText = typeof input.bodyText === 'string' ? input.bodyText.trim() : '';
  if (!filters || !subject || !bodyText) return null;
  if (subject.length > 200 || bodyText.length > 20000) return null;
  return { filters, subject, bodyText };
}

function parseScheduleBody(
  body: unknown
): { filters: BroadcastFilters; subject: string; bodyText: string; scheduledAt: string } | null {
  const parsed = parseSendBody(body);
  if (!parsed || !body || typeof body !== 'object') return null;
  const scheduledAt = parseScheduledAt((body as Record<string, unknown>).scheduledAt);
  if (!scheduledAt) return null;
  return { ...parsed, scheduledAt };
}

export function registerAdminBroadcastRoutes(app: Express): void {
  app.post('/api/admin/broadcast/preview', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    const filters = parseBroadcastFilters(req.body);
    if (!filters) {
      res.status(400).json({ error: 'INVALID_FILTERS' });
      return;
    }
    try {
      res.json(previewBroadcast(filters));
    } catch (error) {
      console.error('[admin] broadcast preview failed', error);
      res.status(500).json({ error: 'PREVIEW_FAILED' });
    }
  });

  app.post('/api/admin/broadcast/send', async (req, res) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const parsed = parseSendBody(req.body);
    if (!parsed) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const confirm = req.body?.confirm === true || req.body?.confirm === 'true';
    if (!confirm) {
      res.status(400).json({ error: 'CONFIRM_REQUIRED' });
      return;
    }

    if (!isMailConfigured()) {
      res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
      return;
    }

    try {
      const preview = previewBroadcast(parsed.filters);
      if (preview.recipientCount === 0) {
        res.status(400).json({ error: 'NO_RECIPIENTS' });
        return;
      }

      const result = await sendBroadcast(
        parsed.filters,
        parsed.subject,
        parsed.bodyText,
        session.user.id
      );
      res.json(result);
    } catch (error) {
      console.error('[admin] broadcast send failed', error);
      if (error instanceof Error && error.message === 'MAIL_NOT_CONFIGURED') {
        res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
        return;
      }
      res.status(500).json({ error: 'SEND_FAILED' });
    }
  });

  app.post('/api/admin/broadcast/schedule', (req, res) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const parsed = parseScheduleBody(req.body);
    if (!parsed) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const confirm = req.body?.confirm === true || req.body?.confirm === 'true';
    if (!confirm) {
      res.status(400).json({ error: 'CONFIRM_REQUIRED' });
      return;
    }

    if (!isMailConfigured()) {
      res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
      return;
    }

    try {
      const result = scheduleBroadcast(
        parsed.filters,
        parsed.subject,
        parsed.bodyText,
        session.user.id,
        parsed.scheduledAt
      );
      res.json(result);
    } catch (error) {
      console.error('[admin] broadcast schedule failed', error);
      if (error instanceof Error) {
        if (error.message === 'MAIL_NOT_CONFIGURED') {
          res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
          return;
        }
        if (error.message === 'NO_RECIPIENTS') {
          res.status(400).json({ error: 'NO_RECIPIENTS' });
          return;
        }
        if (error.message === 'SCHEDULE_TOO_SOON') {
          res.status(400).json({ error: 'SCHEDULE_TOO_SOON' });
          return;
        }
        if (error.message === 'INVALID_SCHEDULE_TIME') {
          res.status(400).json({ error: 'INVALID_SCHEDULE_TIME' });
          return;
        }
      }
      res.status(500).json({ error: 'SCHEDULE_FAILED' });
    }
  });

  app.post('/api/admin/broadcast/:broadcastId/cancel', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    try {
      const cancelled = cancelScheduledBroadcast(req.params.broadcastId);
      if (!cancelled) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('[admin] broadcast cancel failed', error);
      res.status(500).json({ error: 'CANCEL_FAILED' });
    }
  });

  app.get('/api/admin/broadcast/history', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      res.json({ items: listBroadcastHistory(limit) });
    } catch (error) {
      console.error('[admin] broadcast history failed', error);
      res.status(500).json({ error: 'HISTORY_FAILED' });
    }
  });

  app.get('/api/admin/broadcast/:broadcastId', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    try {
      const detail = getBroadcastDetail(req.params.broadcastId);
      if (!detail) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      res.json(detail);
    } catch (error) {
      console.error('[admin] broadcast detail failed', error);
      res.status(500).json({ error: 'DETAIL_FAILED' });
    }
  });
}
