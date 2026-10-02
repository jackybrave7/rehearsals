import type { Express, Request } from 'express';
import { getDb } from './db.js';
import { isMailConfigured, sendOnboardingDripEmail } from './mail.js';
import { getUserSetupStepProgress, type UserSetupStepProgress } from './onboardingDripProgress.js';
import { getOnboardingDripSettings, updateOnboardingDripSettings } from './onboardingDripSettings.js';
import {
  CHECKLIST_STEP_OPTIONS,
  DRIP_ACTION_PATH_OPTIONS,
  DRIP_CONDITION_LABELS,
  type ChecklistStepId,
  type DripConditionType,
} from './onboardingDripSteps.js';
import {
  countDripEmailsSent,
  createEmailDripStep,
  deleteEmailDripStep,
  dripStepDelayMs,
  duplicateEmailDripStep,
  listEmailDripSteps,
  listEnabledEmailDripSteps,
  markDripStepSent,
  type EmailDripStep,
  updateEmailDripStep,
  wasDripStepSent,
} from './onboardingDripRules.js';
import { getRegistrationMode, isRegistrationApproved } from './platformSettings.js';
import { isPlatformAdminEmail, requirePlatformAdmin } from './platformAdmin.js';
import { createDripDelivery, getDripChainEngagementStats } from './dripEmailTracking.js';

const BATCH_SIZE = 30;

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isUserEligibleForDrip(
  db: ReturnType<typeof getDb>,
  user: {
    id: string;
    email: string;
    created_at: string;
    email_verified_at: string | null;
  },
  settings: ReturnType<typeof getOnboardingDripSettings>
): boolean {
  if (!user.email_verified_at) return false;
  if (isPlatformAdminEmail(user.email)) return false;
  if (getRegistrationMode(db) === 'beta' && !isRegistrationApproved(db, user.id)) return false;

  if (!settings.includeLegacyUsers && settings.launchedAt) {
    const createdMs = parseIsoMs(user.created_at);
    const launchedMs = parseIsoMs(settings.launchedAt);
    if (createdMs != null && launchedMs != null && createdMs < launchedMs) {
      return false;
    }
  }

  return true;
}

function isConditionMet(step: EmailDripStep, progress: UserSetupStepProgress[]): boolean {
  if (step.conditionType === 'always') return true;
  if (!step.conditionChecklistStep) return false;
  const item = progress.find((p) => p.id === step.conditionChecklistStep);
  if (!item) return false;
  if (step.conditionType === 'checklist_pending') return !item.done;
  if (step.conditionType === 'checklist_done') return item.done;
  return false;
}

function findDripStepToSend(
  db: ReturnType<typeof getDb>,
  user: { id: string; email_verified_at: string | null; created_at: string }
): EmailDripStep | null {
  const steps = listEnabledEmailDripSteps(db);
  const progress = getUserSetupStepProgress(db, user.id);
  const lastSentAt = getLastDripSentAt(user.id, db);
  const registrationAnchor =
    parseIsoMs(user.email_verified_at) ?? parseIsoMs(user.created_at);

  for (const step of steps) {
    if (wasDripStepSent(user.id, step.id, db)) continue;
    if (!isConditionMet(step, progress)) continue;

    const anchorMs = lastSentAt ? parseIsoMs(lastSentAt) : registrationAnchor;
    if (anchorMs == null) return null;
    if (Date.now() - anchorMs < dripStepDelayMs(step)) return null;

    return step;
  }

  return null;
}

function getLastDripSentAt(userId: string, db: ReturnType<typeof getDb>): string | null {
  const row = db
    .prepare(`SELECT MAX(sent_at) AS sent_at FROM email_drip_sent WHERE user_id = ?`)
    .get(userId) as { sent_at: string | null } | undefined;
  return row?.sent_at ?? null;
}

export async function processOnboardingDripBatch(): Promise<{ sent: number }> {
  if (!isMailConfigured()) return { sent: 0 };

  const db = getDb();
  const settings = getOnboardingDripSettings(db);
  if (!settings.enabled) return { sent: 0 };

  const appUrl = (process.env.APP_URL?.trim() || 'https://rehears.ru').replace(/\/$/, '');

  const users = db
    .prepare(
      `SELECT id, email, name, created_at, email_verified_at
       FROM users ORDER BY created_at ASC LIMIT 500`
    )
    .all() as Array<{
    id: string;
    email: string;
    name: string;
    created_at: string;
    email_verified_at: string | null;
  }>;

  let sent = 0;
  let processed = 0;

  for (const user of users) {
    if (processed >= BATCH_SIZE) break;
    if (!isUserEligibleForDrip(db, user, settings)) continue;

    const step = findDripStepToSend(db, user);
    if (!step) continue;

    processed += 1;

    try {
      const actionUrl = `${appUrl}${step.actionPath.startsWith('/') ? step.actionPath : `/${step.actionPath}`}`;
      const deliveryId = createDripDelivery(
        step.id,
        user.id,
        user.email,
        step.subject,
        db
      );
      await sendOnboardingDripEmail({
        to: user.email,
        name: user.name,
        subject: step.subject,
        bodyText: step.bodyText,
        bodyFormat: step.bodyFormat,
        bodyHtml: step.bodyHtml,
        actionLabel: step.actionLabel,
        actionUrl,
        dripDeliveryId: deliveryId,
      });
      markDripStepSent(user.id, step.id, db);
      sent += 1;
    } catch (error) {
      console.error('[onboarding-drip] send failed', user.id, step.id, error);
    }
  }

  if (sent > 0) console.log(`[onboarding-drip] sent ${sent} email(s)`);
  return { sent };
}

function parseStepBody(req: Request): Partial<EmailDripStep> & { title?: string; subject?: string; bodyText?: string } {
  const b = req.body ?? {};
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' ? Number(v) : fallback;

  return {
    sortOrder: b.sortOrder !== undefined ? num(b.sortOrder, 0) : undefined,
    enabled: b.enabled === undefined ? undefined : Boolean(b.enabled),
    title: typeof b.title === 'string' ? b.title : undefined,
    conditionType:
      b.conditionType === 'checklist_pending' ||
      b.conditionType === 'checklist_done' ||
      b.conditionType === 'always'
        ? (b.conditionType as DripConditionType)
        : undefined,
    conditionChecklistStep:
      typeof b.conditionChecklistStep === 'string'
        ? (b.conditionChecklistStep as ChecklistStepId)
        : b.conditionChecklistStep === null
          ? null
          : undefined,
    delayDays: b.delayDays !== undefined ? num(b.delayDays, 0) : undefined,
    delayHours: b.delayHours !== undefined ? num(b.delayHours, 0) : undefined,
    delayMinutes: b.delayMinutes !== undefined ? num(b.delayMinutes, 0) : undefined,
    subject: typeof b.subject === 'string' ? b.subject : undefined,
    bodyText: typeof b.bodyText === 'string' ? b.bodyText : undefined,
    bodyHtml: b.bodyHtml === null ? null : typeof b.bodyHtml === 'string' ? b.bodyHtml : undefined,
    bodyFormat: b.bodyFormat === 'html' || b.bodyFormat === 'plain' ? b.bodyFormat : undefined,
    actionLabel: typeof b.actionLabel === 'string' ? b.actionLabel : undefined,
    actionPath: typeof b.actionPath === 'string' ? b.actionPath : undefined,
  };
}

function serializeStep(step: EmailDripStep) {
  return {
    id: step.id,
    sortOrder: step.sortOrder,
    enabled: step.enabled,
    title: step.title,
    conditionType: step.conditionType,
    conditionChecklistStep: step.conditionChecklistStep,
    delayDays: step.delayDays,
    delayHours: step.delayHours,
    delayMinutes: step.delayMinutes,
    subject: step.subject,
    bodyText: step.bodyText,
    bodyHtml: step.bodyHtml,
    bodyFormat: step.bodyFormat,
    actionLabel: step.actionLabel,
    actionPath: step.actionPath,
    sentCount: step.sentCount,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}

export function registerOnboardingDripAdminRoutes(app: Express): void {
  app.get('/api/admin/onboarding-drip', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    const db = getDb();
    res.json({
      settings: getOnboardingDripSettings(db),
      mailConfigured: isMailConfigured(),
      steps: listEmailDripSteps(db).map(serializeStep),
      meta: {
        checklistSteps: CHECKLIST_STEP_OPTIONS,
        conditionTypes: Object.entries(DRIP_CONDITION_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        actionPaths: DRIP_ACTION_PATH_OPTIONS,
      },
      stats: { totalSent: countDripEmailsSent(db) },
      engagement: getDripChainEngagementStats(db),
    });
  });

  app.patch('/api/admin/onboarding-drip', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    const enabled =
      req.body?.enabled === undefined
        ? undefined
        : req.body.enabled === true || req.body.enabled === 1 || req.body.enabled === 'true';
    const includeLegacyUsers =
      req.body?.includeLegacyUsers === undefined
        ? undefined
        : req.body.includeLegacyUsers === true ||
          req.body.includeLegacyUsers === 1 ||
          req.body.includeLegacyUsers === 'true';

    if (enabled === undefined && includeLegacyUsers === undefined) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    res.json({ settings: updateOnboardingDripSettings({ enabled, includeLegacyUsers }) });
  });

  app.post('/api/admin/onboarding-drip/steps', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    const patch = parseStepBody(req);
    if (!patch.title?.trim() || !patch.subject?.trim() || !patch.bodyText?.trim()) {
      res.status(400).json({ error: 'MISSING_FIELDS' });
      return;
    }
    try {
      const step = createEmailDripStep(
        {
          ...patch,
          title: patch.title,
          subject: patch.subject,
          bodyText: patch.bodyText,
        },
        getDb()
      );
      res.status(201).json({ step: serializeStep(step) });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'INVALID' });
    }
  });

  app.patch('/api/admin/onboarding-drip/steps/:id', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    const id = req.params.id;
    try {
      const step = updateEmailDripStep(id, parseStepBody(req), getDb());
      if (!step) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      res.json({ step: serializeStep(step) });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'INVALID' });
    }
  });

  app.delete('/api/admin/onboarding-drip/steps/:id', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    if (!deleteEmailDripStep(req.params.id, getDb())) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/onboarding-drip/steps/:id/duplicate', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    const step = duplicateEmailDripStep(req.params.id, getDb());
    if (!step) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.status(201).json({ step: serializeStep(step) });
  });

  app.post('/api/admin/onboarding-drip/test-send', async (req, res) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    if (!isMailConfigured()) {
      res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
      return;
    }

    const patch = parseStepBody(req);
    if (!patch.subject?.trim() || !patch.bodyText?.trim() || !patch.bodyHtml?.trim()) {
      res.status(400).json({ error: 'MISSING_FIELDS' });
      return;
    }

    const appUrl = (process.env.APP_URL?.trim() || 'https://rehears.ru').replace(/\/$/, '');
    const rawPath = patch.actionPath?.trim() || '/app';
    const actionPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const actionUrl = `${appUrl}${actionPath}`;

    try {
      let dripDeliveryId: string | undefined;
      const stepId = typeof req.body?.stepId === 'string' ? req.body.stepId.trim() : '';
      if (stepId) {
        dripDeliveryId = createDripDelivery(
          stepId,
          session.user.id,
          session.user.email,
          `[Тест] ${patch.subject.trim()}`,
          getDb()
        );
      }

      await sendOnboardingDripEmail({
        to: session.user.email,
        name: session.user.name?.trim() || session.user.email,
        subject: `[Тест] ${patch.subject.trim()}`,
        bodyText: patch.bodyText.trim(),
        bodyFormat: 'html',
        bodyHtml: patch.bodyHtml.trim(),
        actionLabel: patch.actionLabel?.trim() || 'Открыть приложение',
        actionUrl,
        dripDeliveryId,
      });
      res.json({ ok: true, sentTo: session.user.email });
    } catch (error) {
      console.error('[onboarding-drip] test send failed', error);
      res.status(500).json({ error: 'SEND_FAILED' });
    }
  });
}
