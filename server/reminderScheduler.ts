import type { AppState, Rehearsal } from '../src/types/index.js';
import { getDb, type AppDatabase } from './db.js';
import { loadState } from './stateRepository.js';
import { getTelegramConfig, sendTelegramHtmlMessage } from './telegram.js';
import { buildRehearsalTelegramBotMessage } from '../src/utils/rehearsalTelegramExport.js';
import {
  getReminderKind,
  hasReminderBeenSent,
  isRehearsalInFuture,
  isReminderDue,
  parseRehearsalStartUtc,
  resolveReminderSettings,
  type RehearsalReminderSent,
} from '../src/utils/reminders.js';

const TICK_MS = Number(process.env.REMINDER_TICK_MINUTES ?? 5) * 60 * 1000;
const WINDOW_MINUTES = Number(process.env.REMINDER_WINDOW_MINUTES ?? 10);
const UTC_OFFSET_HOURS = Number(process.env.REHEARSAL_UTC_OFFSET_HOURS ?? 3);

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getTheaterOwnerUserId(db: AppDatabase, theaterId: string | null | undefined): string | null {
  if (!theaterId) return null;
  const row = db.prepare(`SELECT owner_user_id FROM theaters WHERE id = ?`).get(theaterId) as
    | { owner_user_id: string | null }
    | undefined;
  return row?.owner_user_id ?? null;
}

function getOwnerTheaterIds(db: AppDatabase, userId: string): string[] {
  const rows = db
    .prepare(
      `SELECT id FROM theaters WHERE owner_user_id = ?
       UNION
       SELECT theater_id AS id FROM theater_members WHERE user_id = ? AND role IN ('owner', 'editor')`
    )
    .all(userId, userId) as Array<{ id: string }>;
  return [...new Set(rows.map((row) => row.id))];
}

function loadOwnerReminderSettings(db: AppDatabase, userId: string) {
  const row = db.prepare(`SELECT app_meta FROM user_settings WHERE user_id = ?`).get(userId) as
    | { app_meta: string }
    | undefined;
  const appMeta = parseJson<AppState['appMeta']>(row?.app_meta, {});
  return resolveReminderSettings(appMeta);
}

function appendReminderSent(
  db: AppDatabase,
  rehearsalId: string,
  entry: RehearsalReminderSent
): void {
  const row = db.prepare(`SELECT reminders_sent FROM rehearsals WHERE id = ?`).get(rehearsalId) as
    | { reminders_sent: string }
    | undefined;
  if (!row) return;
  const current = parseJson<RehearsalReminderSent[]>(row.reminders_sent, []);
  db.prepare(`UPDATE rehearsals SET reminders_sent = ? WHERE id = ?`).run(
    JSON.stringify([...current, entry]),
    rehearsalId
  );
}

async function processRehearsalReminder(
  db: AppDatabase,
  rehearsalRow: Record<string, unknown>,
  state: AppState,
  offsetsHours: number[],
  now: Date
): Promise<void> {
  const rehearsal = state.rehearsals.find((item) => item.id === String(rehearsalRow.id));
  if (!rehearsal || rehearsal.reminderOptOut) return;

  const date = String(rehearsalRow.date);
  const startTime = String(rehearsalRow.start_time);
  if (!isRehearsalInFuture(date, startTime, now, UTC_OFFSET_HOURS)) return;

  const rehearsalStart = parseRehearsalStartUtc(date, startTime, UTC_OFFSET_HOURS);
  const config = getTelegramConfig();
  if (!config) return;

  for (const offsetHours of offsetsHours) {
    if (!isReminderDue(rehearsalStart, offsetHours, now, WINDOW_MINUTES)) continue;

    const kind = getReminderKind(offsetHours);
    if (hasReminderBeenSent(rehearsal.remindersSent, kind, offsetHours)) continue;

    const html = buildRehearsalTelegramBotMessage(state, rehearsal);
    await sendTelegramHtmlMessage(config, html);

    const entry: RehearsalReminderSent = {
      kind,
      at: now.toISOString(),
      ...(kind === 'custom' ? { offsetHours } : {}),
    };
    appendReminderSent(db, rehearsal.id, entry);
    rehearsal.remindersSent = [...(rehearsal.remindersSent ?? []), entry];

    console.log(
      `[reminders] sent ${kind} for rehearsal ${rehearsal.id} (${date} ${startTime})`
    );
  }
}

export async function runReminderTick(db: AppDatabase = getDb()): Promise<void> {
  const config = getTelegramConfig();
  if (!config) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const rows = db
    .prepare(`SELECT * FROM rehearsals WHERE date >= ? ORDER BY date, start_time`)
    .all(today) as Array<Record<string, unknown>>;

  const stateCache = new Map<string, AppState>();
  const settingsCache = new Map<string, ReturnType<typeof resolveReminderSettings>>();

  for (const row of rows) {
    const theaterId = (row.theater_id as string | null) ?? undefined;
    const ownerId = getTheaterOwnerUserId(db, theaterId);
    if (!ownerId) continue;

    let settings = settingsCache.get(ownerId);
    if (!settings) {
      settings = loadOwnerReminderSettings(db, ownerId);
      settingsCache.set(ownerId, settings);
    }
    if (!settings.enabled) continue;

    let state = stateCache.get(ownerId);
    if (!state) {
      const theaterIds = getOwnerTheaterIds(db, ownerId);
      const loaded = loadState(db, { userId: ownerId, theaterIds });
      if (!loaded) continue;
      state = loaded;
      stateCache.set(ownerId, state);
    }

    try {
      await processRehearsalReminder(db, row, state, settings.offsetsHours, now);
    } catch (error) {
      console.error(`[reminders] failed for rehearsal ${row.id}`, error);
    }
  }
}

export function startReminderScheduler(db: AppDatabase = getDb()): () => void {
  const config = getTelegramConfig();
  if (!config) {
    console.log('[reminders] Telegram bot not configured — scheduler disabled');
    return () => undefined;
  }

  console.log(
    `[reminders] scheduler every ${TICK_MS / 60000} min, window ${WINDOW_MINUTES} min, UTC offset +${UTC_OFFSET_HOURS}`
  );

  const tick = () => {
    void runReminderTick(db).catch((error) => {
      console.error('[reminders] tick failed', error);
    });
  };

  tick();
  const timer = setInterval(tick, TICK_MS);
  return () => clearInterval(timer);
}
