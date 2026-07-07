import type { Express, Request, Response } from 'express';
import { requirePlatformAdmin } from './platformAdmin.js';
import { isMailConfigured, readMailFromAddress } from './mail.js';
import { checkMailDeliverability } from './mailDnsCheck.js';

export function registerAdminMailDeliverabilityRoutes(app: Express): void {
  app.get('/api/admin/mail/deliverability', async (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    try {
      const report = await checkMailDeliverability({
        mailConfigured: isMailConfigured(),
        fromAddress: readMailFromAddress(),
      });
      res.json(report);
    } catch (error) {
      console.error('[admin] mail deliverability check failed', error);
      res.status(500).json({ error: 'MAIL_DNS_CHECK_FAILED' });
    }
  });
}
