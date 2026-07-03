import type { Express, Request, Response } from 'express';
import { assignOrphanTheaters } from './auth.js';
import { getDb } from './db.js';
import { createEmailVerificationToken, isEmailVerified, markEmailVerified } from './emailVerification.js';
import { isMailConfigured, sendEmailVerificationEmail } from './mail.js';
import { getRegistrationMode } from './platformSettings.js';
import { requirePlatformAdmin } from './platformAdmin.js';

function buildVerifyUrl(token: string): string {
  const appUrl = process.env.APP_URL?.trim() || 'https://rehears.ru';
  return `${appUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
}

export function registerAdminEmailVerificationRoutes(app: Express): void {
  app.post('/api/admin/users/:userId/resend-verification', async (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const db = getDb();
    const userId = req.params.userId;
    const row = db
      .prepare(`SELECT id, email, name, email_verified_at FROM users WHERE id = ?`)
      .get(userId) as
      | { id: string; email: string; name: string; email_verified_at: string | null }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (row.email_verified_at) {
      res.json({ ok: true, alreadyVerified: true, mailSent: null, verifyUrl: null });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
      return;
    }

    const token = createEmailVerificationToken(db, row.id);
    const verifyUrl = buildVerifyUrl(token);
    const betaMode = getRegistrationMode(db) === 'beta';

    let mailSent = false;
    try {
      await sendEmailVerificationEmail(row.email, row.name, token, { betaMode });
      mailSent = true;
    } catch (error) {
      console.error('[admin] resend verification mail failed', error);
    }

    console.info(`[admin] resend verification for ${row.email} by ${session.user.email}, mailSent=${mailSent}`);
    res.json({ ok: true, mailSent, verifyUrl });
  });

  app.post('/api/admin/users/:userId/verify-email', (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const db = getDb();
    const userId = req.params.userId;
    const row = db
      .prepare(`SELECT id, email, email_verified_at FROM users WHERE id = ?`)
      .get(userId) as { id: string; email: string; email_verified_at: string | null } | undefined;

    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (row.email_verified_at) {
      res.json({ ok: true, alreadyVerified: true });
      return;
    }

    markEmailVerified(db, userId);
    assignOrphanTheaters(db, userId);
    console.info(`[admin] manually verified email for ${row.email} by ${session.user.email}`);
    res.json({ ok: true, alreadyVerified: false });
  });
}
