import type { AppState, Rehearsal } from '../src/types/index.js';
import { getDb, type AppDatabase } from './db.js';
import { loadState } from './stateRepository.js';
import { getTelegramBotToken, sendTelegramHtmlMessage, sendTelegramMessageWithInlineKeyboard } from './telegram.js';
import { buildActorReminderTelegramBotMessage } from '../src/utils/rehearsalTelegramExport.js';
import { buildRsvpTelegramKeyboard } from '../src/utils/rehearsalRsvp.js';
import { getParticipatingActorIds } from '../src/utils/rehearsalActors.js';
import {
  hasReminderBeenSent,
  isRehearsalInFuture,
  isReminderTypeDue,
  resolveTheaterReminderSettings,
  type RehearsalReminderSent,
  type ReminderType,
} from '../src/utils/reminders.js';
import { getUserSubscriptionPlan } from './subscription.js';

const TICK_MS = Number(process.env.REMINDER_TICK_MINUTES ?? 5) * 60 * 1000;
const WINDOW_MINUTES = Number(process.env.REMINDER_WINDOW_MINUTES ?? 10);
const UTC_OFFSET_HOURS = Number(process.env.REHEARSAL_UTC_OFFSET_HOURS ?? 3);
const MORNING_HOUR = Number(process.env.REMINDER_MORNING_HOUR ?? 9);

export function getReminderSchedulerConfig() {
  return {
    active: Boolean(getTelegramBotToken()),
    tickMinutes: Number(process.env.REMINDER_TICK_MINUTES ?? 5),
    windowMinutes: WINDOW_MINUTES,
  };
}

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
  reminderTypes: ReminderType[],
  morningHour: number,
  now: Date
): Promise<void> {
  const rehearsal = state.rehearsals.find((item) => item.id === String(rehearsalRow.id));
  if (!rehearsal || rehearsal.reminderOptOut) return;

  const date = String(rehearsalRow.date);
  const startTime = String(rehearsalRow.start_time);
  if (!isRehearsalInFuture(date, startTime, now, UTC_OFFSET_HOURS)) return;

  const token = getTelegramBotToken();
  if (!token) return;

  const participatingActorIds = getParticipatingActorIds(state, rehearsal);

  for (const actorId of participatingActorIds) {
    const actor = state.actors.find((item) => item.id === actorId);
    const chatId = actor?.telegramChatId?.trim();
    if (!chatId) continue;

    for (const reminderType of reminderTypes) {
      if (
        !isReminderTypeDue(
          reminderType,
          date,
          startTime,
          now,
          WINDOW_MINUTES,
          UTC_OFFSET_HOURS,
          morningHour
        )
      ) {
        continue;
      }

      if (hasReminderBeenSent(rehearsal.remindersSent, reminderType, actorId)) continue;

      const html = buildActorReminderTelegramBotMessage(state, rehearsal, actorId);
      await sendTelegramHtmlMessage(chatId, html, token);

      const entry: RehearsalReminderSent = {
        kind: reminderType,
        at: now.toISOString(),
        actorId,
      };
      appendReminderSent(db, rehearsal.id, entry);
      rehearsal.remindersSent = [...(rehearsal.remindersSent ?? []), entry];

      console.log(
        `[reminders] sent ${reminderType} to actor ${actorId} for rehearsal ${rehearsal.id} (${date} ${startTime})`
      );

      if (!hasReminderBeenSent(rehearsal.remindersSent, 'rsvp_prompt', actorId)) {
        const rsvpHtml =
          `<b>Подтвердите участие</b>\n` +
          `Репетиция ${date} в ${startTime}. Нажмите кнопку ниже:`;
        await sendTelegramMessageWithInlineKeyboard(
          chatId,
          rsvpHtml,
          buildRsvpTelegramKeyboard(rehearsal.id),
          token
        );
        const rsvpEntry: RehearsalReminderSent = {
          kind: 'rsvp_prompt',
          at: now.toISOString(),
          actorId,
        };
        appendReminderSent(db, rehearsal.id, rsvpEntry);
        rehearsal.remindersSent = [...(rehearsal.remindersSent ?? []), rsvpEntry];
        console.log(`[reminders] sent rsvp_prompt to actor ${actorId} for rehearsal ${rehearsal.id}`);
      }
    }
  }
}

export async function runReminderTick(db: AppDatabase = getDb()): Promise<void> {
  if (!getTelegramBotToken()) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const rows = db
    .prepare(`SELECT * FROM rehearsals WHERE date >= ? ORDER BY date, start_time`)
    .all(today) as Array<Record<string, unknown>>;

  const stateCache = new Map<string, AppState>();

  for (const row of rows) {
    const theaterId = (row.theater_id as string | null) ?? undefined;
    const ownerId = getTheaterOwnerUserId(db, theaterId);
    if (!ownerId || !theaterId) continue;

    const ownerRow = db
      .prepare(`SELECT email FROM users WHERE id = ?`)
      .get(ownerId) as { email: string } | undefined;
    if (!ownerRow) continue;
    if (getUserSubscriptionPlan(db, ownerId, ownerRow.email) !== 'pro') continue;

    let state = stateCache.get(ownerId);
    if (!state) {
      const theaterIds = getOwnerTheaterIds(db, ownerId);
      const loaded = loadState(db, { userId: ownerId, theaterIds });
      if (!loaded) continue;
      state = loaded;
      stateCache.set(ownerId, state);
    }

    const theater = state.theaters.find((item) => item.id === theaterId);
    const settings = resolveTheaterReminderSettings(theater ?? {}, state.appMeta);
    if (!settings.enabled || settings.types.length === 0) continue;

    try {
      await processRehearsalReminder(
        db,
        row,
        state,
        settings.types,
        settings.morningHour ?? MORNING_HOUR,
        now
      );
    } catch (error) {
      console.error(`[reminders] failed for rehearsal ${row.id}`, error);
    }
  }
}

export function startReminderScheduler(db: AppDatabase = getDb()): () => void {
  const config = getReminderSchedulerConfig();
  if (!config.active) {
    console.log('[reminders] Telegram bot not configured — scheduler disabled');
    return () => undefined;
  }

  console.log(
    `[reminders] personal reminders every ${config.tickMinutes} min, window ${config.windowMinutes} min, UTC+${UTC_OFFSET_HOURS}, morning ${MORNING_HOUR}:00`
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
