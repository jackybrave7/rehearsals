import type { AppDatabase } from './db.js';
import { CHECKLIST_STEP_OPTIONS, type ChecklistStepId } from './onboardingDripSteps.js';

export interface UserSetupStepProgress {
  id: ChecklistStepId;
  done: boolean;
}

function parseJsonRecord(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Театр для оценки прогресса: active → owned → первый owner/editor. */
export function resolvePrimaryTheaterId(db: AppDatabase, userId: string): string | null {
  const settings = db
    .prepare(`SELECT active_theater_id FROM user_settings WHERE user_id = ?`)
    .get(userId) as { active_theater_id: string | null } | undefined;

  const activeId = settings?.active_theater_id?.trim();
  if (activeId) {
    const member = db
      .prepare(
        `SELECT 1 FROM theater_members
         WHERE theater_id = ? AND user_id = ? AND role IN ('owner', 'editor')`
      )
      .get(activeId, userId);
    if (member) return activeId;
  }

  const owned = db
    .prepare(`SELECT id FROM theaters WHERE owner_user_id = ? ORDER BY name LIMIT 1`)
    .get(userId) as { id: string } | undefined;
  if (owned?.id) return owned.id;

  const memberTheater = db
    .prepare(
      `SELECT t.id FROM theaters t
       JOIN theater_members tm ON tm.theater_id = t.id AND tm.user_id = ?
       WHERE tm.role IN ('owner', 'editor')
       ORDER BY t.name
       LIMIT 1`
    )
    .get(userId) as { id: string } | undefined;
  return memberTheater?.id ?? null;
}

export function getUserSetupStepProgress(db: AppDatabase, userId: string): UserSetupStepProgress[] {
  const theaterId = resolvePrimaryTheaterId(db, userId);
  const hasTheater = Boolean(
    db.prepare(`SELECT 1 FROM theaters WHERE owner_user_id = ? LIMIT 1`).get(userId)
  ) || Boolean(
    db
      .prepare(
        `SELECT 1 FROM theater_members WHERE user_id = ? AND role IN ('owner', 'editor') LIMIT 1`
      )
      .get(userId)
  );

  let actors = 0;
  let plays = 0;
  let scenes = 0;
  let castCount = 0;
  let venues = 0;
  let hasScheduledRehearsal = false;
  let telegramDone = false;
  let telegramBotDone = false;

  if (theaterId) {
    actors = (db.prepare(`SELECT COUNT(*) AS c FROM actors WHERE theater_id = ?`).get(theaterId) as { c: number }).c;

    const playRows = db
      .prepare(`SELECT id FROM plays WHERE theater_id = ?`)
      .all(theaterId) as Array<{ id: string }>;
    plays = playRows.length;
    const playIds = playRows.map((p) => p.id);

    if (playIds.length > 0) {
      const placeholders = playIds.map(() => '?').join(',');
      scenes = (db
        .prepare(`SELECT COUNT(*) AS c FROM scenes WHERE play_id IN (${placeholders})`)
        .get(...playIds) as { c: number }).c;

      castCount = (db
        .prepare(`SELECT COUNT(*) AS c FROM cast_assignments WHERE play_id IN (${placeholders})`)
        .get(...playIds) as { c: number }).c;
    }

    venues = (db.prepare(`SELECT COUNT(*) AS c FROM venues WHERE theater_id = ?`).get(theaterId) as { c: number }).c;

    hasScheduledRehearsal = Boolean(
      db
        .prepare(
          `SELECT 1 FROM schedule_blocks sb
           JOIN rehearsals r ON r.id = sb.rehearsal_id
           WHERE r.theater_id = ?
           LIMIT 1`
        )
        .get(theaterId)
    );

    const theaterRow = db
      .prepare(`SELECT telegram_chat_id FROM theaters WHERE id = ?`)
      .get(theaterId) as { telegram_chat_id: string | null } | undefined;

    const metaRow = db
      .prepare(`SELECT app_meta FROM user_settings WHERE user_id = ?`)
      .get(userId) as { app_meta: string } | undefined;
    const appMeta = parseJsonRecord(metaRow?.app_meta);
    const guidePlanSent = appMeta.guideOnboardingPlanSent === true;

    const planSent = Boolean(
      db
        .prepare(
          `SELECT 1 FROM rehearsals
           WHERE theater_id = ? AND telegram_plan_sent_at IS NOT NULL AND trim(telegram_plan_sent_at) != ''
           LIMIT 1`
        )
        .get(theaterId)
    );

    telegramDone =
      Boolean(theaterRow?.telegram_chat_id?.trim()) || guidePlanSent || planSent;

    const linkedActors = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM actors
           WHERE theater_id = ? AND status = 'active'
             AND telegram_chat_id IS NOT NULL AND trim(telegram_chat_id) != ''`
        )
        .get(theaterId) as { c: number }
    ).c;

    telegramBotDone =
      Boolean(theaterRow?.telegram_chat_id?.trim()) && linkedActors >= 1;
  }

  const doneById: Record<ChecklistStepId, boolean> = {
    theater: hasTheater,
    actors: actors >= 1,
    play: plays >= 1,
    scenes: scenes >= 3,
    cast: castCount >= 1,
    venue: venues >= 1,
    rehearsal: hasScheduledRehearsal,
    telegram: telegramDone,
    telegram_bot: telegramBotDone,
  };

  return CHECKLIST_STEP_OPTIONS.map((step) => ({
    id: step.id,
    done: doneById[step.id],
  }));
}

export function getFirstRehearsalPlanAt(db: AppDatabase, userId: string): string | null {
  const theaterId = resolvePrimaryTheaterId(db, userId);
  if (!theaterId) return null;

  const row = db
    .prepare(
      `SELECT MIN(r.created_at) AS first_at
       FROM rehearsals r
       WHERE r.theater_id = ?
         AND EXISTS (SELECT 1 FROM schedule_blocks sb WHERE sb.rehearsal_id = r.id)`
    )
    .get(theaterId) as { first_at: string | null } | undefined;

  const value = row?.first_at?.trim();
  return value || null;
}

export function getChecklistStepAnchorAt(
  db: AppDatabase,
  userId: string,
  stepId: ChecklistStepId
): string | null {
  if (stepId === 'rehearsal') {
    return getFirstRehearsalPlanAt(db, userId);
  }
  return null;
}

export function getFirstPendingSetupStep(
  db: AppDatabase,
  userId: string
): ChecklistStepId | null {
  const progress = getUserSetupStepProgress(db, userId);
  const pending = progress.find((step) => !step.done);
  return pending?.id ?? null;
}
