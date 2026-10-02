import { randomUUID } from 'node:crypto';
import { getDb, type AppDatabase } from './db.js';
import {
  CHECKLIST_STEP_OPTIONS,
  DEFAULT_DRIP_STEP_TEMPLATES,
  type ChecklistStepId,
  type DripConditionType,
} from './onboardingDripSteps.js';
import { DRIP_TEMPLATES_CONTENT_VERSION } from './onboardingDripDefaultContent.js';
import { dripBodyHtmlFromPlainText } from '../shared/dripEmailBody.js';
import { wrapFullDripEmailHtml } from '../shared/dripEmailDocument.js';

export interface EmailDripStep {
  id: string;
  sortOrder: number;
  enabled: boolean;
  title: string;
  conditionType: DripConditionType;
  conditionChecklistStep: ChecklistStepId | null;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  bodyFormat: 'plain' | 'html';
  actionLabel: string;
  actionPath: string;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  sort_order: number;
  enabled: number;
  title: string;
  condition_type: string;
  condition_checklist_step: string | null;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  subject: string;
  body_text: string;
  body_html: string | null;
  body_format: string;
  action_label: string;
  action_path: string;
  created_at: string;
  updated_at: string;
  sent_count?: number;
};

function mapRow(row: Row): EmailDripStep {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    enabled: Boolean(row.enabled),
    title: row.title,
    conditionType: row.condition_type as DripConditionType,
    conditionChecklistStep: (row.condition_checklist_step as ChecklistStepId) || null,
    delayDays: row.delay_days,
    delayHours: row.delay_hours,
    delayMinutes: row.delay_minutes,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    bodyFormat: row.body_format === 'html' ? 'html' : 'plain',
    actionLabel: row.action_label,
    actionPath: row.action_path,
    sentCount: Number(row.sent_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_STEP = `
  SELECT s.*,
         (SELECT COUNT(*) FROM email_drip_sent d WHERE d.step_id = s.id) AS sent_count
  FROM email_drip_steps s
`;

export function seedEmailDripStepsIfEmpty(db: AppDatabase): void {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM email_drip_steps`).get() as { c: number };
  if (row.c > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO email_drip_steps (
      id, sort_order, enabled, title, condition_type, condition_checklist_step,
      delay_days, delay_hours, delay_minutes,
      subject, body_text, body_html, body_format,
      action_label, action_path, created_at, updated_at
    ) VALUES (?, ?, 1, ?, 'checklist_pending', ?, ?, ?, ?, ?, ?, ?, 'html', ?, ?, ?, ?)`
  );

  DEFAULT_DRIP_STEP_TEMPLATES.forEach((template, index) => {
    insert.run(
      randomUUID(),
      index,
      template.title,
      template.checklistStepId,
      template.delayDays,
      template.delayHours,
      template.delayMinutes,
      template.subject,
      template.bodyText,
      template.bodyHtml,
      template.actionLabel,
      template.actionPath,
      now,
      now
    );
  });
}

export function syncDefaultDripTemplatesToLatest(db: AppDatabase): void {
  const row = db
    .prepare(`SELECT email_drip_templates_version FROM platform_settings WHERE id = 1`)
    .get() as { email_drip_templates_version?: number | null } | undefined;
  const current = Number(row?.email_drip_templates_version ?? 0);
  if (current >= DRIP_TEMPLATES_CONTENT_VERSION) return;

  const now = new Date().toISOString();
  const update = db.prepare(
    `UPDATE email_drip_steps SET
      subject = ?,
      body_text = ?,
      body_html = ?,
      body_format = 'html',
      delay_days = ?,
      delay_hours = 0,
      delay_minutes = 0,
      action_label = ?,
      action_path = ?,
      updated_at = ?
     WHERE condition_checklist_step = ? AND condition_type = 'checklist_pending'`
  );

  for (const template of DEFAULT_DRIP_STEP_TEMPLATES) {
    update.run(
      template.subject,
      template.bodyText,
      template.bodyHtml,
      template.delayDays,
      template.actionLabel,
      template.actionPath,
      now,
      template.checklistStepId
    );
  }

  const insert = db.prepare(
    `INSERT INTO email_drip_steps (
      id, sort_order, enabled, title, condition_type, condition_checklist_step,
      delay_days, delay_hours, delay_minutes,
      subject, body_text, body_html, body_format,
      action_label, action_path, created_at, updated_at
    ) VALUES (?, ?, 1, ?, 'checklist_pending', ?, ?, 0, 0, ?, ?, ?, 'html', ?, ?, ?, ?)`
  );

  for (const [index, template] of DEFAULT_DRIP_STEP_TEMPLATES.entries()) {
    const exists = db
      .prepare(
        `SELECT 1 FROM email_drip_steps WHERE condition_type = 'checklist_pending' AND condition_checklist_step = ?`
      )
      .get(template.checklistStepId);
    if (exists) continue;
    insert.run(
      randomUUID(),
      index,
      template.title,
      template.checklistStepId,
      template.delayDays,
      template.subject,
      template.bodyText,
      template.bodyHtml,
      template.actionLabel,
      template.actionPath,
      now,
      now
    );
  }

  db.prepare(
    `UPDATE platform_settings SET email_drip_templates_version = ? WHERE id = 1`
  ).run(DRIP_TEMPLATES_CONTENT_VERSION);
}

function resolveStoredDripHtml(input: Partial<EmailDripStep> & { bodyText: string }): string | null {
  const trimmed = input.bodyHtml?.trim();
  if (trimmed) return trimmed;
  if (!input.bodyText.trim()) return null;
  const inner = dripBodyHtmlFromPlainText(input.bodyText, { leadFirst: true });
  return wrapFullDripEmailHtml({
    innerBodyHtml: inner,
    actionLabel: input.actionLabel ?? 'Открыть приложение',
    actionPath: input.actionPath ?? '/app',
  });
}

export function listEmailDripSteps(db: AppDatabase = getDb()): EmailDripStep[] {
  const rows = db
    .prepare(`${SELECT_STEP} ORDER BY s.sort_order ASC, s.created_at ASC`)
    .all() as Row[];
  return rows.map(mapRow);
}

export function listEnabledEmailDripSteps(db: AppDatabase): EmailDripStep[] {
  const rows = db
    .prepare(`${SELECT_STEP} WHERE s.enabled = 1 ORDER BY s.sort_order ASC, s.created_at ASC`)
    .all() as Row[];
  return rows.map(mapRow);
}

export function getEmailDripStep(id: string, db: AppDatabase): EmailDripStep | null {
  const row = db.prepare(`${SELECT_STEP} WHERE s.id = ?`).get(id) as Row | undefined;
  return row ? mapRow(row) : null;
}

function nextSortOrder(db: AppDatabase): number {
  const row = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM email_drip_steps`).get() as {
    n: number;
  };
  return row.n;
}

function parseConditionType(value: unknown): DripConditionType | null {
  if (value === 'checklist_pending' || value === 'checklist_done' || value === 'always') {
    return value;
  }
  return null;
}

function parseChecklistStep(value: unknown): ChecklistStepId | null {
  if (typeof value !== 'string') return null;
  return CHECKLIST_STEP_OPTIONS.some((o) => o.id === value) ? (value as ChecklistStepId) : null;
}

export function createEmailDripStep(
  input: Partial<EmailDripStep> & { title: string; subject: string; bodyText: string },
  db: AppDatabase
): EmailDripStep {
  const now = new Date().toISOString();
  const id = randomUUID();
  const conditionType = input.conditionType ?? 'checklist_pending';
  const conditionStep =
    conditionType === 'always' ? null : input.conditionChecklistStep ?? 'theater';

  db.prepare(
    `INSERT INTO email_drip_steps (
      id, sort_order, enabled, title, condition_type, condition_checklist_step,
      delay_days, delay_hours, delay_minutes,
      subject, body_text, body_html, body_format,
      action_label, action_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.sortOrder ?? nextSortOrder(db),
    input.enabled === false ? 0 : 1,
    input.title.trim(),
    conditionType,
    conditionStep,
    input.delayDays ?? 2,
    input.delayHours ?? 0,
    input.delayMinutes ?? 0,
    input.subject.trim(),
    input.bodyText.trim(),
    resolveStoredDripHtml(input),
    input.bodyFormat === 'plain' ? 'plain' : 'html',
    (input.actionLabel ?? 'Открыть приложение').trim(),
    (input.actionPath ?? '/app').trim(),
    now,
    now
  );

  return getEmailDripStep(id, db)!;
}

export function updateEmailDripStep(
  id: string,
  patch: Partial<EmailDripStep>,
  db: AppDatabase
): EmailDripStep | null {
  const current = getEmailDripStep(id, db);
  if (!current) return null;

  const conditionType = patch.conditionType ?? current.conditionType;
  let conditionStep = patch.conditionChecklistStep ?? current.conditionChecklistStep;
  if (conditionType === 'always') conditionStep = null;
  if (conditionType !== 'always' && !conditionStep) conditionStep = 'theater';

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE email_drip_steps SET
      sort_order = ?,
      enabled = ?,
      title = ?,
      condition_type = ?,
      condition_checklist_step = ?,
      delay_days = ?,
      delay_hours = ?,
      delay_minutes = ?,
      subject = ?,
      body_text = ?,
      body_html = ?,
      body_format = ?,
      action_label = ?,
      action_path = ?,
      updated_at = ?
     WHERE id = ?`
  ).run(
    patch.sortOrder ?? current.sortOrder,
    (patch.enabled ?? current.enabled) ? 1 : 0,
    (patch.title ?? current.title).trim(),
    conditionType,
    conditionStep,
    patch.delayDays ?? current.delayDays,
    patch.delayHours ?? current.delayHours,
    patch.delayMinutes ?? current.delayMinutes,
    (patch.subject ?? current.subject).trim(),
    (patch.bodyText ?? current.bodyText).trim(),
    patch.bodyHtml !== undefined ? patch.bodyHtml : current.bodyHtml,
    (patch.bodyFormat ?? current.bodyFormat) === 'html' ? 'html' : 'plain',
    (patch.actionLabel ?? current.actionLabel).trim(),
    (patch.actionPath ?? current.actionPath).trim(),
    now,
    id
  );

  return getEmailDripStep(id, db);
}

export function deleteEmailDripStep(id: string, db: AppDatabase): boolean {
  db.prepare(`DELETE FROM email_drip_sent WHERE step_id = ?`).run(id);
  const info = db.prepare(`DELETE FROM email_drip_steps WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function duplicateEmailDripStep(id: string, db: AppDatabase): EmailDripStep | null {
  const source = getEmailDripStep(id, db);
  if (!source) return null;

  return createEmailDripStep(
    {
      ...source,
      title: `${source.title} (копия)`,
      enabled: false,
      sortOrder: nextSortOrder(db),
    },
    db
  );
}

export function dripStepDelayMs(step: EmailDripStep): number {
  return (
    (step.delayDays * 86400 + step.delayHours * 3600 + step.delayMinutes * 60) * 1000
  );
}

export function getSentDripStepIds(userId: string, db: AppDatabase): Set<string> {
  const rows = db
    .prepare(`SELECT step_id FROM email_drip_sent WHERE user_id = ?`)
    .all(userId) as Array<{ step_id: string }>;
  return new Set(rows.map((r) => r.step_id));
}

export function wasDripStepSent(userId: string, dripStepId: string, db: AppDatabase): boolean {
  const row = db
    .prepare(`SELECT 1 FROM email_drip_sent WHERE user_id = ? AND step_id = ?`)
    .get(userId, dripStepId);
  return Boolean(row);
}

export function markDripStepSent(userId: string, dripStepId: string, db: AppDatabase): void {
  db.prepare(
    `INSERT OR IGNORE INTO email_drip_sent (user_id, step_id, sent_at) VALUES (?, ?, ?)`
  ).run(userId, dripStepId, new Date().toISOString());
}

export function getLastDripSentAt(userId: string, db: AppDatabase): string | null {
  const row = db
    .prepare(`SELECT MAX(sent_at) AS sent_at FROM email_drip_sent WHERE user_id = ?`)
    .get(userId) as { sent_at: string | null } | undefined;
  return row?.sent_at ?? null;
}

export function countDripEmailsSent(db: AppDatabase): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM email_drip_sent`).get() as { c: number };
  return row.c;
}
