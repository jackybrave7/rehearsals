import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from './auth.js';
import { getDb, type AppDatabase } from './db.js';
import {
  getFileRecord,
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  publicFileUrl,
  saveSupportAttachmentFile,
} from './fileStorage.js';
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

export interface SupportTicketAttachment {
  id: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
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
  attachments: SupportTicketAttachment[];
}

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 10000;

function isValidCategory(value: unknown): value is SupportTicketCategory {
  return typeof value === 'string' && (SUPPORT_TICKET_CATEGORIES as readonly string[]).includes(value);
}

function parseAttachmentFileIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return [...new Set(ids)].slice(0, MAX_SUPPORT_ATTACHMENTS);
}

export function loadSupportTicketAttachments(
  db: AppDatabase,
  ticketId: string
): SupportTicketAttachment[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.file_id, f.original_name, f.mime_type, f.size_bytes
       FROM support_ticket_attachments a
       JOIN files f ON f.id = a.file_id
       WHERE a.ticket_id = ?
       ORDER BY a.created_at ASC`
    )
    .all(ticketId) as Array<{
    id: string;
    file_id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    fileId: row.file_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    url: publicFileUrl(row.file_id),
  }));
}

function mapTicketRow(db: AppDatabase, row: SupportTicketRow): SupportTicket {
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
    attachments: loadSupportTicketAttachments(db, row.id),
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

function isFileLinkedToTicket(db: AppDatabase, fileId: string): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM support_ticket_attachments WHERE file_id = ? LIMIT 1`)
    .get(fileId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

function linkAttachmentFiles(
  db: AppDatabase,
  ticketId: string,
  userId: string,
  attachmentFileIds: string[]
): SupportTicketAttachment[] {
  if (attachmentFileIds.length === 0) return [];

  const now = new Date().toISOString();
  const linked: SupportTicketAttachment[] = [];

  for (const fileId of attachmentFileIds) {
    const record = getFileRecord(db, fileId);
    if (!record || record.ownerUserId !== userId) {
      throw new Error('INVALID_ATTACHMENT');
    }
    if (isFileLinkedToTicket(db, fileId)) {
      throw new Error('ATTACHMENT_ALREADY_USED');
    }

    const attachmentId = uuidv4();
    db.prepare(
      `INSERT INTO support_ticket_attachments (id, ticket_id, file_id, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(attachmentId, ticketId, fileId, now);

    linked.push({
      id: attachmentId,
      fileId: record.id,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      url: publicFileUrl(record.id),
    });
  }

  return linked;
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
    attachmentFileIds?: string[];
  }
): SupportTicket {
  const now = new Date().toISOString();
  const id = uuidv4();
  const ticketNumber = generateTicketNumber(db);
  const attachmentFileIds = parseAttachmentFileIds(input.attachmentFileIds);

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

  try {
    linkAttachmentFiles(db, id, input.userId, attachmentFileIds);
  } catch (error) {
    db.prepare(`DELETE FROM support_tickets WHERE id = ?`).run(id);
    throw error;
  }

  const row = db.prepare(`SELECT * FROM support_tickets WHERE id = ?`).get(id) as SupportTicketRow;
  return mapTicketRow(db, row);
}

export function registerSupportTicketRoutes(app: Express): void {
  app.post('/api/support/attachments', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'screenshot.png';
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'application/octet-stream';
    const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';

    if (!dataBase64) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'INVALID_BASE64' });
      return;
    }

    if (buffer.byteLength > MAX_SUPPORT_ATTACHMENT_BYTES) {
      res.status(413).json({ error: 'FILE_TOO_LARGE' });
      return;
    }

    try {
      const record = saveSupportAttachmentFile(
        getDb(),
        session.user.id,
        buffer,
        name || 'screenshot.png',
        mimeType
      );
      res.status(201).json({
        fileId: record.id,
        url: publicFileUrl(record.id),
        mimeType: record.mimeType,
        size: record.sizeBytes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UPLOAD_FAILED';
      if (message === 'INVALID_FILE_TYPE') {
        res.status(400).json({ error: 'INVALID_FILE_TYPE' });
        return;
      }
      if (message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'FILE_TOO_LARGE' });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

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

    const attachmentFileIds = parseAttachmentFileIds(req.body?.attachmentFileIds);
    if (Array.isArray(req.body?.attachmentFileIds) && req.body.attachmentFileIds.length > MAX_SUPPORT_ATTACHMENTS) {
      res.status(400).json({ error: 'TOO_MANY_ATTACHMENTS' });
      return;
    }

    const db = getDb();
    let ticket: SupportTicket;
    try {
      ticket = createSupportTicket(db, {
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.name,
        category,
        subject,
        message: rawMessage,
        attachmentFileIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'INVALID_REQUEST';
      if (message === 'INVALID_ATTACHMENT' || message === 'ATTACHMENT_ALREADY_USED') {
        res.status(400).json({ error: message });
        return;
      }
      throw error;
    }

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
          attachmentCount: ticket.attachments.length,
        });
        mailSent = true;
      } catch (error) {
        console.error('[support] confirmation mail failed', error);
      }
    }

    console.info(
      `[support] ticket ${ticket.ticketNumber} created by ${ticket.userEmail}, attachments=${ticket.attachments.length}, mailSent=${mailSent}`
    );
    res.status(201).json({ ticket, mailSent });
  });
}
