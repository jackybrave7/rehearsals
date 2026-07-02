import type { Express, Request, Response } from 'express';
import { getDb } from './db.js';
import { sendProActivatedEmail } from './mail.js';
import { requirePlatformAdmin } from './platformAdmin.js';
import {
  getUserSubscriptionPlan,
  normalizeSubscriptionPlan,
  setUserSubscriptionPlan,
} from './subscription.js';

export function registerAdminSubscriptionRoutes(app: Express) {
  app.patch('/api/admin/users/:userId/subscription', async (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const plan = normalizeSubscriptionPlan((req.body as { plan?: unknown })?.plan);
    const db = getDb();
    const userRow = db
      .prepare(`SELECT id, email, name FROM users WHERE id = ?`)
      .get(req.params.userId) as { id: string; email: string; name: string } | undefined;

    if (!userRow) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const previousPlan = getUserSubscriptionPlan(db, userRow.id, userRow.email);
    const updated = setUserSubscriptionPlan(db, userRow.id, plan);
    if (!updated) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    console.info(`[admin] subscription ${userRow.id} -> ${plan} by ${session.user.email}`);

    let mailSent = false;
    if (plan === 'pro' && previousPlan !== 'pro') {
      try {
        await sendProActivatedEmail(userRow.email, userRow.name);
        mailSent = true;
      } catch (error) {
        console.error('[admin] pro activation mail failed', error);
      }
    }

    res.json({ userId: userRow.id, plan, mailSent });
  });
}
