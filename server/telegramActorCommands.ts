import { addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { AppDatabase } from './db.js';
import { loadState } from './stateRepository.js';
import {
  answerTelegramCallbackQuery,
  sendTelegramHtmlMessage,
  sendTelegramMessageWithInlineKeyboard,
  type InlineKeyboardButton,
} from './telegram.js';
import type { ActorUnavailability, AppState, Rehearsal } from '../src/types/index.js';
import { createWeekdayUnavailability } from '../src/utils/actorAvailability.js';
import { formatNotesTelegramHtml } from '../src/utils/rehearsalActorNotes.js';
import { buildActorPlanTelegramBotMessage } from '../src/utils/rehearsalTelegramExport.js';
import { getExpectedActorIds } from '../src/utils/rehearsalInsights.js';
import { isRehearsalPast } from '../src/utils/rehearsalSort.js';
import { rsvpLabels } from '../src/utils/rehearsalRsvp.js';
import type { RsvpStatus } from '../src/types/index.js';

const RSVP_STATUSES = new Set<RsvpStatus>(['confirmed', 'declined', 'late']);

type LinkedActorRow = {
  id: string;
  theater_id: string | null;
  name: string;
  unavailability: string;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function findLinkedActorByChatId(db: AppDatabase, chatId: string): LinkedActorRow | undefined {
  return db
    .prepare(
      `SELECT id, theater_id, name, unavailability FROM actors WHERE telegram_chat_id = ?`
    )
    .get(chatId) as LinkedActorRow | undefined;
}

function loadStateForActorTheater(
  db: AppDatabase,
  actor: LinkedActorRow
): AppState | null {
  if (!actor.theater_id) return null;

  const ownerRow = db
    .prepare(`SELECT owner_user_id FROM theaters WHERE id = ?`)
    .get(actor.theater_id) as { owner_user_id: string | null } | undefined;
  if (!ownerRow?.owner_user_id) return null;

  return loadState(db, {
    userId: ownerRow.owner_user_id,
    theaterIds: [actor.theater_id],
  });
}

function findNextActorRehearsal(state: AppState, actorId: string): Rehearsal | null {
  return (
    state.rehearsals
      .filter(
        (rehearsal) =>
          !isRehearsalPast(rehearsal) && getExpectedActorIds(state, rehearsal).includes(actorId)
      )
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return a.startTime.localeCompare(b.startTime);
      })[0] ?? null
  );
}

function buildBusyTelegramKeyboard(): InlineKeyboardButton[][] {
  return [
    [{ text: 'Сегодня весь день', callback_data: 'busy:today' }],
    [{ text: 'Завтра', callback_data: 'busy:tomorrow' }],
    [{ text: 'Будни (пн–пт)', callback_data: 'busy:weekdays' }],
    [{ text: 'Будни до 19:00', callback_data: 'busy:weekdays_until_19' }],
  ];
}

function appendUnavailability(
  current: ActorUnavailability[],
  entry: ActorUnavailability
): ActorUnavailability[] {
  return [...current, entry];
}

export async function handleTelegramActorCommand(
  db: AppDatabase,
  chatId: string,
  text: string,
  token: string
): Promise<boolean> {
  const command = text.match(/^\/(\w+)/)?.[1]?.toLowerCase();
  if (!command || command === 'start') return false;

  const actor = findLinkedActorByChatId(db, chatId);
  if (!actor) {
    await sendTelegramHtmlMessage(
      chatId,
      'Сначала привяжите Telegram в карточке участника (кнопка «Подключить бота»).',
      token
    );
    return true;
  }

  if (command === 'plan') {
    const state = loadStateForActorTheater(db, actor);
    if (!state) {
      await sendTelegramHtmlMessage(chatId, 'Не удалось загрузить данные театра.', token);
      return true;
    }

    const rehearsal = findNextActorRehearsal(state, actor.id);
    if (!rehearsal) {
      await sendTelegramHtmlMessage(chatId, 'Ближайших репетиций с вами в плане пока нет.', token);
      return true;
    }

    const html = buildActorPlanTelegramBotMessage(state, rehearsal, actor.id);
    await sendTelegramHtmlMessage(chatId, html, token);
    return true;
  }

  if (command === 'busy') {
    await sendTelegramMessageWithInlineKeyboard(
      chatId,
      '<b>Когда вы недоступны?</b>\nВыберите вариант:',
      buildBusyTelegramKeyboard(),
      token
    );
    return true;
  }

  if (command === 'notes') {
    const state = loadStateForActorTheater(db, actor);
    if (!state) {
      await sendTelegramHtmlMessage(chatId, 'Не удалось загрузить данные театра.', token);
      return true;
    }

    const notes = (state.rehearsalActorNotes ?? []).filter(
      (note) => note.actorId === actor.id && note.sentAt
    );
    const html = formatNotesTelegramHtml(state, notes, actor.id);

    const unsentAckNotes = notes.filter((note) => !note.acknowledgedAt).slice(0, 5);
    const keyboard: InlineKeyboardButton[][] = unsentAckNotes.map((note) => [
      { text: '✓ Учтено', callback_data: `note_ack:${note.id}` },
    ]);

    if (keyboard.length > 0) {
      await sendTelegramMessageWithInlineKeyboard(chatId, html, keyboard, token);
    } else {
      await sendTelegramHtmlMessage(chatId, html, token);
    }
    return true;
  }

  return false;
}

export async function handleTelegramBusyCallback(
  db: AppDatabase,
  callbackQueryId: string,
  chatId: string,
  data: string,
  token: string
): Promise<boolean> {
  const match = data.match(/^busy:(today|tomorrow|weekdays|weekdays_until_19)$/);
  if (!match) return false;

  const preset = match[1];
  const actor = findLinkedActorByChatId(db, chatId);
  if (!actor) {
    await answerTelegramCallbackQuery(
      callbackQueryId,
      'Сначала привяжите Telegram в профиле участника',
      token
    );
    return true;
  }

  const current = parseJson<ActorUnavailability[]>(actor.unavailability, []);
  let entry: ActorUnavailability;
  const today = format(new Date(), 'yyyy-MM-dd');

  switch (preset) {
    case 'today':
      entry = { id: uuidv4(), from: today, to: today, reason: 'Сегодня' };
      break;
    case 'tomorrow': {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      entry = { id: uuidv4(), from: tomorrow, to: tomorrow, reason: 'Завтра' };
      break;
    }
    case 'weekdays':
      entry = createWeekdayUnavailability([1, 2, 3, 4, 5], 'Будни (пн–пт)', uuidv4());
      break;
    case 'weekdays_until_19':
      entry = createWeekdayUnavailability([1, 2, 3, 4, 5], 'Будни до 19:00', uuidv4(), {
        startTime: '00:00',
        endTime: '19:00',
      });
      break;
    default:
      return false;
  }

  const updated = appendUnavailability(current, entry);
  db.prepare(`UPDATE actors SET unavailability = ? WHERE id = ?`).run(
    JSON.stringify(updated),
    actor.id
  );

  const label =
    preset === 'weekdays'
      ? 'Будни (пн–пт) добавлены'
      : preset === 'weekdays_until_19'
        ? 'Будни до 19:00 добавлены'
        : preset === 'today'
          ? 'Сегодня отмечено как недоступный день'
          : 'Завтра отмечено как недоступный день';

  await answerTelegramCallbackQuery(callbackQueryId, label, token);
  console.log(`[telegram] busy:${preset} from actor ${actor.id}`);
  return true;
}

export async function handleTelegramNoteAckCallback(
  db: AppDatabase,
  callbackQueryId: string,
  chatId: string,
  data: string,
  token: string
): Promise<boolean> {
  const match = data.match(/^note_ack:(.+)$/);
  if (!match) return false;

  const noteId = match[1];
  const actor = findLinkedActorByChatId(db, chatId);
  if (!actor) {
    await answerTelegramCallbackQuery(
      callbackQueryId,
      'Сначала привяжите Telegram в профиле участника',
      token
    );
    return true;
  }

  const row = db
    .prepare(
      `SELECT id, actor_id, sent_at, acknowledged_at FROM rehearsal_actor_notes WHERE id = ?`
    )
    .get(noteId) as
    | { id: string; actor_id: string; sent_at: string | null; acknowledged_at: string | null }
    | undefined;

  if (!row || row.actor_id !== actor.id || !row.sent_at) {
    await answerTelegramCallbackQuery(callbackQueryId, 'Замечание не найдено', token);
    return true;
  }

  if (row.acknowledged_at) {
    await answerTelegramCallbackQuery(callbackQueryId, 'Уже отмечено', token);
    return true;
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE rehearsal_actor_notes SET acknowledged_at = ? WHERE id = ?`).run(now, noteId);

  await answerTelegramCallbackQuery(callbackQueryId, 'Отмечено как учтено', token);
  console.log(`[telegram] note_ack from actor ${actor.id} for note ${noteId}`);
  return true;
}

export async function handleTelegramRsvpCallback(
  db: AppDatabase,
  callbackQueryId: string,
  chatId: string,
  data: string,
  token: string
): Promise<boolean> {
  const match = data.match(/^rsvp:([^:]+):(confirmed|declined|late)$/);
  if (!match) return false;

  const rehearsalId = match[1];
  const status = match[2] as RsvpStatus;
  if (!RSVP_STATUSES.has(status)) return false;

  const actor = findLinkedActorByChatId(db, chatId);
  if (!actor) {
    await answerTelegramCallbackQuery(
      callbackQueryId,
      'Сначала привяжите Telegram в профиле участника',
      token
    );
    return true;
  }

  const rehearsal = db
    .prepare(`SELECT id, rsvp FROM rehearsals WHERE id = ?`)
    .get(rehearsalId) as { id: string; rsvp: string } | undefined;
  if (!rehearsal) {
    await answerTelegramCallbackQuery(callbackQueryId, 'Репетиция не найдена', token);
    return true;
  }

  const current = parseJson<Record<string, RsvpStatus>>(rehearsal.rsvp, {});
  current[actor.id] = status;
  db.prepare(`UPDATE rehearsals SET rsvp = ? WHERE id = ?`).run(JSON.stringify(current), rehearsalId);

  await answerTelegramCallbackQuery(callbackQueryId, rsvpLabels[status], token);
  console.log(`[telegram] RSVP ${status} from actor ${actor.id} for rehearsal ${rehearsalId}`);
  return true;
}
