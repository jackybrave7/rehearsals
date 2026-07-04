import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppDatabase } from './db.js';
import { getDb } from './db.js';
import {
  answerTelegramCallbackQuery,
  getTelegramBotToken,
} from './telegram.js';
import type { RsvpStatus } from '../src/types/index.js';
import { rsvpLabels } from '../src/utils/rehearsalRsvp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const offsetPath = path.join(path.resolve(__dirname, '..'), 'data', 'telegram-update-offset.txt');

const RSVP_STATUSES = new Set<RsvpStatus>(['confirmed', 'declined', 'late']);

function readOffset(): number {
  try {
    const raw = fs.readFileSync(offsetPath, 'utf8').trim();
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeOffset(offset: number): void {
  fs.mkdirSync(path.dirname(offsetPath), { recursive: true });
  fs.writeFileSync(offsetPath, String(offset), 'utf8');
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function handleRsvpCallback(
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

  const actor = db
    .prepare(`SELECT id FROM actors WHERE telegram_chat_id = ?`)
    .get(String(chatId)) as { id: string } | undefined;
  if (!actor) {
    await answerTelegramCallbackQuery(callbackQueryId, 'Сначала привяжите Telegram в профиле участника', token);
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

export async function pollTelegramActorLinks(db: AppDatabase): Promise<number> {
  const token = getTelegramBotToken();
  if (!token) return 0;

  let offset = readOffset();
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=${offset}`
  );
  if (!response.ok) return 0;

  const payload = (await response.json()) as {
    ok?: boolean;
    result?: Array<{
      update_id: number;
      message?: {
        chat?: { id?: number };
        text?: string;
      };
      callback_query?: {
        id: string;
        data?: string;
        message?: { chat?: { id?: number } };
        from?: { id?: number };
      };
    }>;
  };

  if (!payload.ok || !payload.result?.length) return 0;

  let handled = 0;
  const updateActor = db.prepare(`UPDATE actors SET telegram_chat_id = ? WHERE id = ?`);

  for (const update of payload.result) {
    offset = Math.max(offset, update.update_id + 1);

    const callback = update.callback_query;
    if (callback?.data && callback.id) {
      const chatId =
        callback.message?.chat?.id ?? callback.from?.id;
      if (chatId != null) {
        const processed = await handleRsvpCallback(
          db,
          callback.id,
          String(chatId),
          callback.data,
          token
        );
        if (processed) handled += 1;
      }
      continue;
    }

    const text = update.message?.text?.trim() ?? '';
    const chatId = update.message?.chat?.id;
    const match = text.match(/^\/start(?:@\w+)?\s+link_([0-9a-f-]+)$/i);
    if (!match || chatId == null) continue;

    const actorId = match[1];
    const exists = db.prepare(`SELECT id FROM actors WHERE id = ?`).get(actorId);
    if (!exists) continue;

    updateActor.run(String(chatId), actorId);
    handled += 1;
    console.log(`[telegram] linked actor ${actorId} to chat ${chatId}`);
  }

  if (offset > 0) writeOffset(offset);
  return handled;
}

export function startTelegramLinkPoller(db: AppDatabase = getDb()): () => void {
  if (!getTelegramBotToken()) {
    return () => undefined;
  }

  const tick = () => {
    void pollTelegramActorLinks(db).catch((error) => {
      console.error('[telegram] link poll failed', error);
    });
  };

  tick();
  const timer = setInterval(tick, 15_000);
  return () => clearInterval(timer);
}
