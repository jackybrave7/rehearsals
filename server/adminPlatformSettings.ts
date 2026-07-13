import type { Express, Request, Response } from 'express';
import { assignOrphanTheaters } from './auth.js';
import { getDb } from './db.js';
import { isEmailVerified } from './emailVerification.js';
import { isMailConfigured, sendRegistrationApprovedEmail } from './mail.js';
import { requirePlatformAdmin } from './platformAdmin.js';
import {
  approveUserRegistration,
  getPlatformSettings,
  isValidNotificationEmail,
  setRegistrationMode,
  setRegistrationNotificationSettings,
  type RegistrationMode,
} from './platformSettings.js';

function parseRegistrationMode(value: unknown): RegistrationMode | null {
  return value === 'normal' || value === 'beta' ? value : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

export function registerAdminPlatformSettingsRoutes(app: Express): void {
  app.get('/api/admin/platform-settings', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    res.json(getPlatformSettings());
  });

  app.patch('/api/admin/platform-settings', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;

    const mode = req.body?.registrationMode;
    const notifyEnabled = req.body?.registrationNotifyEnabled;
    const notifyEmail = req.body?.registrationNotifyEmail;

    const hasMode = mode !== undefined;
    const hasNotifyEnabled = notifyEnabled !== undefined;
    const hasNotifyEmail = notifyEmail !== undefined;

    if (!hasMode && !hasNotifyEnabled && !hasNotifyEmail) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (hasMode) {
      const parsedMode = parseRegistrationMode(mode);
      if (!parsedMode) {
        res.status(400).json({ error: 'INVALID_MODE' });
        return;
      }
      setRegistrationMode(parsedMode);
    }

    if (hasNotifyEnabled || hasNotifyEmail) {
      const current = getPlatformSettings();
      const nextEnabled = hasNotifyEnabled
        ? parseBoolean(notifyEnabled)
        : current.registrationNotify.enabled;
      if (nextEnabled === null) {
        res.status(400).json({ error: 'INVALID_NOTIFY_ENABLED' });
        return;
      }

      const nextEmail = hasNotifyEmail
        ? typeof notifyEmail === 'string'
          ? notifyEmail.trim().toLowerCase()
          : ''
        : current.registrationNotify.email;

      if (nextEnabled && !isValidNotificationEmail(nextEmail)) {
        res.status(400).json({ error: 'INVALID_NOTIFY_EMAIL' });
        return;
      }

      setRegistrationNotificationSettings({
        enabled: nextEnabled,
        email: nextEmail,
      });
    }

    res.json(getPlatformSettings());
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
