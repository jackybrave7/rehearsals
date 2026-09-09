import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, type AppDatabase } from './db.js';

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/** 1×1 transparent GIF */
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export interface BroadcastLink {
  id: string;
  url: string;
}

export function extractBroadcastUrls(bodyText: string): string[] {
  const matches = bodyText.match(URL_RE) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;:!?)]+$/, '')))];
}

export function readAppBaseUrl(): string {
  return (process.env.APP_URL?.trim() || 'https://rehears.ru').replace(/\/$/, '');
}

export function insertBroadcastLinks(
  broadcastId: string,
  urls: string[],
  db: AppDatabase = getDb()
): BroadcastLink[] {
  const stmt = db.prepare(
    `INSERT INTO email_broadcast_links (id, broadcast_id, url, position)
     VALUES (?, ?, ?, ?)`
  );
  return urls.map((url, index) => {
    const id = uuidv4();
    stmt.run(id, broadcastId, url, index);
    return { id, url };
  });
}

export function createBroadcastRecipient(
  broadcastId: string,
  userId: string,
  email: string,
  db: AppDatabase = getDb()
): string {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO email_broadcast_recipients (
       id, broadcast_id, user_id, email, delivery_status, open_count, click_count, created_at
     ) VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`
  ).run(id, broadcastId, userId, email, new Date().toISOString());
  return id;
}

export function markRecipientSent(recipientId: string, db: AppDatabase = getDb()): void {
  db.prepare(
    `UPDATE email_broadcast_recipients
     SET delivery_status = 'sent', sent_at = ?, delivery_error = NULL
     WHERE id = ?`
  ).run(new Date().toISOString(), recipientId);
}

export function markRecipientFailed(
  recipientId: string,
  error: string,
  db: AppDatabase = getDb()
): void {
  db.prepare(
    `UPDATE email_broadcast_recipients
     SET delivery_status = 'failed', delivery_error = ?
     WHERE id = ?`
  ).run(error.slice(0, 500), recipientId);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTrackedBroadcastHtml(options: {
  greeting: string;
  bodyText: string;
  recipientId: string;
  links: BroadcastLink[];
  appUrl?: string;
}): string {
  const appUrl = (options.appUrl ?? readAppBaseUrl()).replace(/\/$/, '');
  const linkByUrl = new Map(options.links.map((link) => [link.url, link]));
  const openPixel = `${appUrl}/api/broadcast/track/open/${options.recipientId}.gif`;

  const body = options.bodyText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const escaped = escapeHtml(block);
      const withLinks = escaped.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
        const normalized = match.replace(/[.,;:!?)]+$/, '');
        const suffix = match.slice(normalized.length);
        const tracked = linkByUrl.get(normalized);
        const href = tracked
          ? `${appUrl}/api/broadcast/track/click/${options.recipientId}/${tracked.id}`
          : normalized;
        return `<a href="${escapeHtml(href)}" style="color:#b8860b;">${escapeHtml(normalized)}</a>${suffix}`;
      });
      return `<p style="margin:0 0 12px;line-height:1.6;">${withLinks.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;color:#222;max-width:560px;">
    <p style="margin:0 0 12px;line-height:1.6;">Здравствуйте, ${escapeHtml(options.greeting)}!</p>
    ${body}
    <p style="margin:20px 0 0;font-size:13px;color:#666;line-height:1.5;">
      Это письмо отправлено из сервиса «Репетиции».
    </p>
    <img src="${escapeHtml(openPixel)}" width="1" height="1" alt="" style="display:block;border:0;outline:none;" />
  </body>
</html>`;
}

function recordOpen(recipientId: string, userAgent: string | undefined, db: AppDatabase): void {
  const now = new Date().toISOString();
  const row = db
    .prepare(`SELECT id, opened_at FROM email_broadcast_recipients WHERE id = ?`)
    .get(recipientId) as { id: string; opened_at: string | null } | undefined;
  if (!row) return;

  db.prepare(
    `UPDATE email_broadcast_recipients
     SET open_count = open_count + 1,
         opened_at = COALESCE(opened_at, ?)
     WHERE id = ?`
  ).run(now, recipientId);

  db.prepare(
    `INSERT INTO email_broadcast_opens (id, recipient_id, opened_at, user_agent)
     VALUES (?, ?, ?, ?)`
  ).run(uuidv4(), recipientId, now, userAgent?.slice(0, 500) ?? null);
}

function recordClick(
  recipientId: string,
  linkId: string,
  userAgent: string | undefined,
  db: AppDatabase
): string | null {
  const link = db
    .prepare(
      `SELECT l.url
       FROM email_broadcast_links l
       JOIN email_broadcast_recipients r ON r.broadcast_id = l.broadcast_id
       WHERE r.id = ? AND l.id = ?`
    )
    .get(recipientId, linkId) as { url: string } | undefined;
  if (!link) return null;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE email_broadcast_recipients
     SET click_count = click_count + 1,
         clicked_at = COALESCE(clicked_at, ?)
     WHERE id = ?`
  ).run(now, recipientId);

  db.prepare(
    `INSERT INTO email_broadcast_clicks (id, recipient_id, link_id, url, clicked_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), recipientId, linkId, link.url, now, userAgent?.slice(0, 500) ?? null);

  return link.url;
}

export interface BroadcastEngagementStats {
  sentCount: number;
  failedCount: number;
  openedCount: number;
  clickedCount: number;
  openRatePercent: number;
  clickRatePercent: number;
}

export function getBroadcastEngagementStats(
  broadcastId: string,
  db: AppDatabase = getDb()
): BroadcastEngagementStats {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN delivery_status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
         SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
         SUM(CASE WHEN delivery_status = 'sent' AND opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opened_count,
         SUM(CASE WHEN delivery_status = 'sent' AND click_count > 0 THEN 1 ELSE 0 END) AS clicked_count
       FROM email_broadcast_recipients
       WHERE broadcast_id = ?`
    )
    .get(broadcastId) as {
    sent_count: number | null;
    failed_count: number | null;
    opened_count: number | null;
    clicked_count: number | null;
  };

  const sentCount = Number(row.sent_count ?? 0);
  const failedCount = Number(row.failed_count ?? 0);
  const openedCount = Number(row.opened_count ?? 0);
  const clickedCount = Number(row.clicked_count ?? 0);
  const openRatePercent = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
  const clickRatePercent = sentCount > 0 ? Math.round((clickedCount / sentCount) * 100) : 0;

  return {
    sentCount,
    failedCount,
    openedCount,
    clickedCount,
    openRatePercent,
    clickRatePercent,
  };
}

export interface BroadcastRecipientEngagement {
  id: string;
  userId: string;
  email: string;
  name: string;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  deliveryError: string | null;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
}

export function listBroadcastRecipientEngagement(
  broadcastId: string,
  db: AppDatabase = getDb()
): BroadcastRecipientEngagement[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.user_id, r.email, r.delivery_status, r.delivery_error, r.sent_at,
              r.opened_at, r.open_count, r.clicked_at, r.click_count, u.name
       FROM email_broadcast_recipients r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.broadcast_id = ?
       ORDER BY u.name COLLATE NOCASE, r.email`
    )
    .all(broadcastId) as Array<{
    id: string;
    user_id: string;
    email: string;
    delivery_status: string;
    delivery_error: string | null;
    sent_at: string | null;
    opened_at: string | null;
    open_count: number;
    clicked_at: string | null;
    click_count: number;
    name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.name ?? row.email,
    deliveryStatus: row.delivery_status as BroadcastRecipientEngagement['deliveryStatus'],
    deliveryError: row.delivery_error,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
    openCount: row.open_count,
    clickedAt: row.clicked_at,
    clickCount: row.click_count,
  }));
}

export interface UserBroadcastEngagement {
  broadcastId: string;
  subject: string;
  broadcastAt: string;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  deliveryError: string | null;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  clicks: Array<{ url: string; clickedAt: string }>;
}

export function listUserBroadcastEngagement(
  userId: string,
  db: AppDatabase = getDb()
): UserBroadcastEngagement[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.broadcast_id, r.delivery_status, r.delivery_error, r.sent_at,
              r.opened_at, r.open_count, r.clicked_at, r.click_count,
              b.subject, b.created_at AS broadcast_at
       FROM email_broadcast_recipients r
       JOIN email_broadcasts b ON b.id = r.broadcast_id
       WHERE r.user_id = ?
       ORDER BY b.created_at DESC`
    )
    .all(userId) as Array<{
    id: string;
    broadcast_id: string;
    delivery_status: string;
    delivery_error: string | null;
    sent_at: string | null;
    opened_at: string | null;
    open_count: number;
    clicked_at: string | null;
    click_count: number;
    subject: string;
    broadcast_at: string;
  }>;

  const clickStmt = db.prepare(
    `SELECT url, clicked_at FROM email_broadcast_clicks WHERE recipient_id = ? ORDER BY clicked_at DESC`
  );

  return rows.map((row) => ({
    broadcastId: row.broadcast_id,
    subject: row.subject,
    broadcastAt: row.broadcast_at,
    deliveryStatus: row.delivery_status as UserBroadcastEngagement['deliveryStatus'],
    deliveryError: row.delivery_error,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
    openCount: row.open_count,
    clickedAt: row.clicked_at,
    clickCount: row.click_count,
    clicks: (clickStmt.all(row.id) as Array<{ url: string; clicked_at: string }>).map((click) => ({
      url: click.url,
      clickedAt: click.clicked_at,
    })),
  }));
}

export function registerBroadcastTrackingRoutes(app: Express): void {
  app.get('/api/broadcast/track/open/:recipientId.gif', (req: Request, res: Response) => {
    try {
      const recipientId = req.params.recipientId.replace(/\.gif$/i, '');
      recordOpen(recipientId, req.headers['user-agent'], getDb());
    } catch (error) {
      console.error('[broadcast] open track failed', error);
    }
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).send(TRACKING_PIXEL);
  });

  app.get('/api/broadcast/track/click/:recipientId/:linkId', (req: Request, res: Response) => {
    try {
      const target = recordClick(
        req.params.recipientId,
        req.params.linkId,
        req.headers['user-agent'],
        getDb()
      );
      if (target) {
        res.redirect(302, target);
        return;
      }
    } catch (error) {
      console.error('[broadcast] click track failed', error);
    }
    res.status(404).send('Not found');
  });
}
