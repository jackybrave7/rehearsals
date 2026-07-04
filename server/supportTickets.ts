import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from './auth.js';
import { getDb, type AppDatabase } from './db.js';
import { isMailConfigured, sendSupportTicketConfirmationEmail } from './mail.js';

export const SUPPORT_TICKET_CATEGORIES = ['bug', 'feature', 'billing', 'account', 'other'] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

export const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export interface SupportTicketRow {
  id: string;
  ticket_number: string;
  user_id: string;
  user_email: string;
  user_name: string;
  category: SupportTicketCategory;
  subject: string | null;
  message: string;
  status: SupportTicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: SupportTicketCategory;
  subject: string | null;
  message: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
}

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 10000;

function isValidCategory(value: unknown): value is SupportTicketCategory {
  return typeof value === 'string' && (SUPPORT_TICKET_CATEGORIES as readonly string[]).includes(value);
}

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

export function generateTicketNumber(db: AppDatabase): string {
  const year = new Date().getFullYear();
  const prefix = `SUP-${year}-`;
  const row = db
    .prepare(
      `SELECT ticket_number FROM support_tickets WHERE ticket_number LIKE ? ORDER BY ticket_number DESC LIMIT 1`
    )
    .get(`${prefix}%`) as { ticket_number: string } | undefined;

  let seq = 1;
  if (row?.ticket_number) {
    const match = row.ticket_number.match(/-(\d+)$/);
    if (match) seq = Number.parseInt(match[1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function createSupportTicket(
  db: AppDatabase,
  input: {
    userId: string;
    userEmail: string;
    userName: string;
    category: SupportTicketCategory;
    subject: string | null;
    message: string;
  }
): SupportTicket {
  const now = new Date().toISOString();
  const id = uuidv4();
  const ticketNumber = generateTicketNumber(db);

  db.prepare(
    `INSERT INTO support_tickets (
      id, ticket_number, user_id, user_email, user_name, category, subject, message, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
  ).run(
    id,
    ticketNumber,
    input.userId,
    input.userEmail,
    input.userName,
    input.category,
    input.subject,
    input.message,
    now,
    now
  );

  const row = db.prepare(`SELECT * FROM support_tickets WHERE id = ?`).get(id) as SupportTicketRow;
  return mapTicketRow(row);
}

export function registerSupportTicketRoutes(app: Express): void {
  app.post('/api/support/tickets', async (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const category = req.body?.category;
    if (!isValidCategory(category)) {
      res.status(400).json({ error: 'INVALID_CATEGORY' });
      return;
    }

    const rawSubject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const subject = rawSubject.length > 0 ? rawSubject.slice(0, MAX_SUBJECT_LENGTH) : null;

    const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!rawMessage) {
      res.status(400).json({ error: 'MESSAGE_REQUIRED' });
      return;
    }
    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: 'MESSAGE_TOO_LONG' });
      return;
    }

    const db = getDb();
    const ticket = createSupportTicket(db, {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      category,
      subject,
      message: rawMessage,
    });

    let mailSent = false;
    if (isMailConfigured()) {
      try {
        await sendSupportTicketConfirmationEmail({
          to: ticket.userEmail,
          name: ticket.userName,
          ticketNumber: ticket.ticketNumber,
          category: ticket.category,
          subject: ticket.subject,
          message: ticket.message,
        });
        mailSent = true;
      } catch (error) {
        console.error('[support] confirmation mail failed', error);
      }
    }

    console.info(
      `[support] ticket ${ticket.ticketNumber} created by ${ticket.userEmail}, mailSent=${mailSent}`
    );
    res.status(201).json({ ticket, mailSent });
  });
}
