import type { Express, Request, Response } from 'express';
import { getDb } from './db.js';
import { requirePlatformAdmin } from './platformAdmin.js';
import {
  SUPPORT_TICKET_STATUSES,
  type SupportTicket,
  type SupportTicketRow,
  type SupportTicketStatus,
} from './supportTickets.js';

function mapTicketRow(row: SupportTicketRow): SupportTicket {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isValidStatus(value: unknown): value is SupportTicketStatus {
  return typeof value === 'string' && (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value);
}

export function registerAdminSupportTicketRoutes(app: Express): void {
  app.get('/api/admin/support/tickets', (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 100;

    const db = getDb();
    let sql = `SELECT * FROM support_tickets`;
    const params: unknown[] = [];

    if (statusFilter && isValidStatus(statusFilter)) {
      sql += ` WHERE status = ?`;
      params.push(statusFilter);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as SupportTicketRow[];
    const openCount = (
      db.prepare(`SELECT COUNT(*) AS count FROM support_tickets WHERE status = 'open'`).get() as {
        count: number;
      }
    ).count;

    res.json({
      tickets: rows.map(mapTicketRow),
      openCount: Number(openCount),
    });
  });

  app.patch('/api/admin/support/tickets/:id', (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const status = req.body?.status;
    if (!isValidStatus(status)) {
      res.status(400).json({ error: 'INVALID_STATUS' });
      return;
    }

    const db = getDb();
    const existing = db
      .prepare(`SELECT id FROM support_tickets WHERE id = ?`)
      .get(req.params.id) as { id: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?`).run(
      status,
      now,
      req.params.id
    );

    const row = db
      .prepare(`SELECT * FROM support_tickets WHERE id = ?`)
      .get(req.params.id) as SupportTicketRow;

    console.info(
      `[admin] support ticket ${row.ticket_number} status → ${status} by ${session.user.email}`
    );
    res.json({ ticket: mapTicketRow(row) });
  });
}
