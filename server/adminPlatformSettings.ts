import type { Express, Request, Response } from 'express';
import { assignOrphanTheaters } from './auth.js';
import { getDb } from './db.js';
import { isEmailVerified } from './emailVerification.js';
import { isMailConfigured, sendRegistrationApprovedEmail } from './mail.js';
import { requirePlatformAdmin } from './platformAdmin.js';
import {
  approveUserRegistration,
  getRegistrationMode,
  setRegistrationMode,
  type RegistrationMode,
} from './platformSettings.js';

function parseRegistrationMode(value: unknown): RegistrationMode | null {
  return value === 'normal' || value === 'beta' ? value : null;
}

export function registerAdminPlatformSettingsRoutes(app: Express): void {
  app.get('/api/admin/platform-settings', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    res.json({ registrationMode: getRegistrationMode() });
  });

  app.patch('/api/admin/platform-settings', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    const mode = parseRegistrationMode(req.body?.registrationMode);
    if (!mode) {
      res.status(400).json({ error: 'INVALID_MODE' });
      return;
    }
    setRegistrationMode(mode);
    res.json({ registrationMode: mode });
  });

  app.post('/api/admin/users/:userId/approve-registration', async (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const db = getDb();
    const userId = req.params.userId;
    const row = db
      .prepare(`SELECT id, email, name, email_verified_at, registration_approved_at FROM users WHERE id = ?`)
      .get(userId) as
      | {
          id: string;
          email: string;
          name: string;
          email_verified_at: string | null;
          registration_approved_at: string | null;
        }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (!isEmailVerified(db, userId)) {
      res.status(400).json({ error: 'EMAIL_NOT_VERIFIED' });
      return;
    }
    if (row.registration_approved_at) {
      res.json({ ok: true, alreadyApproved: true, mailSent: null });
      return;
    }

    approveUserRegistration(db, userId);
    assignOrphanTheaters(db, userId);

    let mailSent: boolean | null = null;
    if (!isMailConfigured()) {
      console.error('[admin] registration approved mail skipped: SMTP not configured');
      mailSent = false;
    } else {
      try {
        await sendRegistrationApprovedEmail(row.email, row.name);
        mailSent = true;
      } catch (error) {
        console.error('[admin] registration approved mail failed', error);
        mailSent = false;
      }
    }

    console.info(`[admin] approved registration ${row.email} by ${session.user.email}`);
    res.json({ ok: true, mailSent });
  });
}
