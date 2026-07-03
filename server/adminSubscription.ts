import type { Express, Request, Response } from 'express';
import { getDb } from './db.js';
import { isMailConfigured, sendProActivatedEmail } from './mail.js';
import { requirePlatformAdmin } from './platformAdmin.js';
import {
  getStoredSubscription,
  getUserSubscriptionPlan,
  normalizeSubscriptionPlan,
  resolveProExpiresAt,
  setUserSubscriptionPlan,
  type ProDurationPreset,
} from './subscription.js';

function parseProDuration(value: unknown): ProDurationPreset | 'custom' | null {
  if (
    value === 'unlimited' ||
    value === '1m' ||
    value === '3m' ||
    value === '12m' ||
    value === 'custom'
  ) {
    return value;
  }
  return null;
}

export function registerAdminSubscriptionRoutes(app: Express) {
  app.patch('/api/admin/users/:userId/subscription', async (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const body = req.body as {
      plan?: unknown;
      proDuration?: unknown;
      proExpiresAt?: unknown;
    };
    const plan = normalizeSubscriptionPlan(body.plan);
    const db = getDb();
    const userRow = db
      .prepare(`SELECT id, email, name FROM users WHERE id = ?`)
      .get(req.params.userId) as { id: string; email: string; name: string } | undefined;

    if (!userRow) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const previousEffective = getUserSubscriptionPlan(db, userRow.id, userRow.email);

    let proExpiresAt: string | null = null;
    if (plan === 'pro') {
      const proDuration = parseProDuration(body.proDuration);
      if (proDuration === null) {
        res.status(400).json({ error: 'INVALID_PRO_DURATION' });
        return;
      }
      if (proDuration === 'custom') {
        const custom =
          typeof body.proExpiresAt === 'string' ? body.proExpiresAt.trim().slice(0, 10) : '';
        proExpiresAt = resolveProExpiresAt('custom', custom);
        if (!proExpiresAt) {
          res.status(400).json({ error: 'INVALID_PRO_EXPIRES_AT' });
          return;
        }
      } else {
        proExpiresAt = resolveProExpiresAt(proDuration);
      }
    }

    const updated = setUserSubscriptionPlan(db, userRow.id, plan, proExpiresAt);
    if (!updated) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const stored = getStoredSubscription(db, userRow.id);
    const effectivePlan = getUserSubscriptionPlan(db, userRow.id, userRow.email);

    console.info(
      `[admin] subscription ${userRow.id} -> ${plan}` +
        (plan === 'pro' ? ` until ${proExpiresAt ?? 'unlimited'}` : '') +
        ` by ${session.user.email}`
    );

    let mailSent: boolean | null = null;
    if (effectivePlan === 'pro' && previousEffective !== 'pro') {
      if (!isMailConfigured()) {
        console.error('[admin] pro activation mail skipped: SMTP not configured');
        mailSent = false;
      } else {
        try {
          await sendProActivatedEmail(userRow.email, userRow.name);
          mailSent = true;
        } catch (error) {
          console.error('[admin] pro activation mail failed', error);
          mailSent = false;
        }
      }
    }

    res.json({
      userId: userRow.id,
      plan: effectivePlan,
      subscriptionPlanStored: stored.plan,
      subscriptionProExpiresAt: stored.proExpiresAt,
      mailSent,
    });
  });
}
