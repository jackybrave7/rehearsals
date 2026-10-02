import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, type AppDatabase } from './db.js';
import { readAppBaseUrl } from './broadcastTracking.js';

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const HREF_RE = /href="(https?:\/\/[^"]+)"/gi;

export interface DripDeliveryLink {
  id: string;
  url: string;
}

export function createDripDelivery(
  stepId: string,
  userId: string,
  email: string,
  subject: string,
  db: AppDatabase = getDb()
): string {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO email_drip_deliveries (
       id, step_id, user_id, email, subject, sent_at, delivery_status, open_count, click_count
     ) VALUES (?, ?, ?, ?, ?, ?, 'sent', 0, 0)`
  ).run(id, stepId, userId, email, subject, new Date().toISOString());
  return id;
}

function insertDeliveryLinks(
  deliveryId: string,
  urls: string[],
  db: AppDatabase
): DripDeliveryLink[] {
  const stmt = db.prepare(
    `INSERT INTO email_drip_delivery_links (id, delivery_id, url, position) VALUES (?, ?, ?, ?)`
  );
  const unique = [...new Set(urls.filter(Boolean))];
  return unique.map((url, index) => {
    const id = uuidv4();
    stmt.run(id, deliveryId, url, index);
    return { id, url };
  });
}

export function applyDripEmailTracking(
  html: string,
  deliveryId: string,
  actionUrl: string,
  db: AppDatabase = getDb()
): string {
  const appUrl = readAppBaseUrl();
  const urls = new Set<string>();
  if (actionUrl) urls.add(actionUrl);

  let match: RegExpExecArray | null;
  const hrefRe = new RegExp(HREF_RE.source, 'gi');
  while ((match = hrefRe.exec(html)) !== null) {
    const href = match[1];
    if (href && !href.includes('/api/drip/track/') && !href.includes('/api/broadcast/track/')) {
      urls.add(href);
    }
  }

  const links = insertDeliveryLinks(deliveryId, [...urls], db);
  const linkByUrl = new Map(links.map((link) => [link.url, link]));

  let tracked = html.replace(/href="(https?:\/\/[^"]+)"/gi, (full, url: string) => {
    if (url.includes('/api/drip/track/') || url.includes('/api/broadcast/track/')) {
      return full;
    }
    const link = linkByUrl.get(url);
    if (!link) return full;
    const trackUrl = `${appUrl}/api/drip/track/click/${deliveryId}/${link.id}`;
    return `href="${trackUrl}"`;
  });

  const pixel = `${appUrl}/api/drip/track/open/${deliveryId}.gif`;
  const pixelTag = `<img src="${pixel}" width="1" height="1" alt="" style="display:block;border:0;outline:none;width:1px;height:1px;" />`;
  if (tracked.includes('</body>')) {
    tracked = tracked.replace('</body>', `${pixelTag}</body>`);
  } else {
    tracked += pixelTag;
  }

  return tracked;
}

function recordDripOpen(deliveryId: string, userAgent: string | undefined, db: AppDatabase): void {
  const row = db
    .prepare(`SELECT id, opened_at FROM email_drip_deliveries WHERE id = ?`)
    .get(deliveryId) as { id: string; opened_at: string | null } | undefined;
  if (!row) return;

  db.prepare(
    `UPDATE email_drip_deliveries
     SET open_count = open_count + 1,
         opened_at = COALESCE(opened_at, ?)
     WHERE id = ?`
  ).run(new Date().toISOString(), deliveryId);

  db.prepare(
    `INSERT INTO email_drip_opens (id, delivery_id, opened_at, user_agent) VALUES (?, ?, ?, ?)`
  ).run(uuidv4(), deliveryId, new Date().toISOString(), userAgent?.slice(0, 500) ?? null);
}

function recordDripClick(
  deliveryId: string,
  linkId: string,
  userAgent: string | undefined,
  db: AppDatabase
): string | null {
  const link = db
    .prepare(
      `SELECT l.url FROM email_drip_delivery_links l
       JOIN email_drip_deliveries d ON d.id = l.delivery_id
       WHERE l.delivery_id = ? AND l.id = ?`
    )
    .get(deliveryId, linkId) as { url: string } | undefined;
  if (!link) return null;

  db.prepare(
    `UPDATE email_drip_deliveries
     SET click_count = click_count + 1,
         clicked_at = COALESCE(clicked_at, ?)
     WHERE id = ?`
  ).run(new Date().toISOString(), deliveryId);

  db.prepare(
    `INSERT INTO email_drip_clicks (id, delivery_id, link_id, url, clicked_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    deliveryId,
    linkId,
    link.url,
    new Date().toISOString(),
    userAgent?.slice(0, 500) ?? null
  );

  return link.url;
}

export interface DripChainEngagementStats {
  totalDeliveries: number;
  totalOpens: number;
  totalClicks: number;
  uniqueOpens: number;
  uniqueClicks: number;
  steps: Array<{
    stepId: string;
    title: string;
    deliveries: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
  }>;
}

export function getDripChainEngagementStats(db: AppDatabase = getDb()): DripChainEngagementStats {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS deliveries,
              COALESCE(SUM(open_count), 0) AS opens,
              COALESCE(SUM(click_count), 0) AS clicks,
              COALESCE(SUM(CASE WHEN open_count > 0 THEN 1 ELSE 0 END), 0) AS unique_opens,
              COALESCE(SUM(CASE WHEN click_count > 0 THEN 1 ELSE 0 END), 0) AS unique_clicks
       FROM email_drip_deliveries`
    )
    .get() as {
    deliveries: number;
    opens: number;
    clicks: number;
    unique_opens: number;
    unique_clicks: number;
  };

  const stepRows = db
    .prepare(
      `SELECT s.id AS step_id, s.title,
              COUNT(d.id) AS deliveries,
              COALESCE(SUM(d.open_count), 0) AS opens,
              COALESCE(SUM(d.click_count), 0) AS clicks
       FROM email_drip_steps s
       LEFT JOIN email_drip_deliveries d ON d.step_id = s.id
       GROUP BY s.id
       ORDER BY s.sort_order, s.title`
    )
    .all() as Array<{
    step_id: string;
    title: string;
    deliveries: number;
    opens: number;
    clicks: number;
  }>;

  return {
    totalDeliveries: totals.deliveries,
    totalOpens: totals.opens,
    totalClicks: totals.clicks,
    uniqueOpens: totals.unique_opens,
    uniqueClicks: totals.unique_clicks,
    steps: stepRows.map((row) => ({
      stepId: row.step_id,
      title: row.title,
      deliveries: row.deliveries,
      opens: row.opens,
      clicks: row.clicks,
      openRate: row.deliveries > 0 ? row.opens / row.deliveries : 0,
      clickRate: row.deliveries > 0 ? row.clicks / row.deliveries : 0,
    })),
  };
}

export interface UserDripEngagement {
  deliveryId: string;
  stepId: string;
  stepTitle: string;
  subject: string;
  sentAt: string;
  openCount: number;
  openedAt: string | null;
  clickCount: number;
  clickedAt: string | null;
  clicks: Array<{ url: string; clickedAt: string }>;
}

export function listUserDripEngagement(
  userId: string,
  db: AppDatabase = getDb()
): UserDripEngagement[] {
  const rows = db
    .prepare(
      `SELECT d.id, d.step_id, d.subject, d.sent_at, d.open_count, d.opened_at, d.click_count, d.clicked_at,
              s.title AS step_title
       FROM email_drip_deliveries d
       JOIN email_drip_steps s ON s.id = d.step_id
       WHERE d.user_id = ?
       ORDER BY d.sent_at DESC`
    )
    .all(userId) as Array<{
    id: string;
    step_id: string;
    subject: string;
    sent_at: string;
    open_count: number;
    opened_at: string | null;
    click_count: number;
    clicked_at: string | null;
    step_title: string;
  }>;

  const clickStmt = db.prepare(
    `SELECT url, clicked_at FROM email_drip_clicks WHERE delivery_id = ? ORDER BY clicked_at DESC`
  );

  return rows.map((row) => ({
    deliveryId: row.id,
    stepId: row.step_id,
    stepTitle: row.step_title,
    subject: row.subject,
    sentAt: row.sent_at,
    openCount: row.open_count,
    openedAt: row.opened_at,
    clickCount: row.click_count,
    clickedAt: row.clicked_at,
    clicks: (clickStmt.all(row.id) as Array<{ url: string; clicked_at: string }>).map((click) => ({
      url: click.url,
      clickedAt: click.clicked_at,
    })),
  }));
}

export function registerDripTrackingRoutes(app: Express): void {
  app.get('/api/drip/track/open/:deliveryId.gif', (req: Request, res: Response) => {
    try {
      const deliveryId = req.params.deliveryId.replace(/\.gif$/i, '');
      recordDripOpen(deliveryId, req.headers['user-agent'], getDb());
    } catch (error) {
      console.error('[drip] open track failed', error);
    }
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.status(200).send(TRACKING_PIXEL);
  });

  app.get('/api/drip/track/click/:deliveryId/:linkId', (req: Request, res: Response) => {
    try {
      const target = recordDripClick(
        req.params.deliveryId,
        req.params.linkId,
        req.headers['user-agent'],
        getDb()
      );
      if (target) {
        res.redirect(302, target);
        return;
      }
    } catch (error) {
      console.error('[drip] click track failed', error);
    }
    res.status(404).send('Not found');
  });
}
