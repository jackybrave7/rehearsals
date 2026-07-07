import type { AppDatabase } from './db.js';
import {
  listRecentTelegramGroupChats,
  rememberTelegramGroupChatFromUpdate,
  type CachedTelegramGroupChat,
} from './telegramGroupChatCache.js';
import { buildTelegramGetUpdatesUrl } from './telegramUpdates.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const updateOffsetPath = path.join(path.resolve(__dirname, '..'), 'data', 'telegram-update-offset.txt');

function readTelegramUpdateOffset(): number {
  try {
    const raw = fs.readFileSync(updateOffsetPath, 'utf8').trim();
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export type { CachedTelegramGroupChat };

export interface TelegramBotInfo {
  configured: boolean;
  username: string | null;
}

export function getTelegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

/** @deprecated Используйте getTelegramBotToken + getTheaterTelegramChatId */
export function getLegacyTelegramChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID?.trim() || null;
}

export function getTheaterTelegramChatId(
  db: AppDatabase,
  theaterId: string | null | undefined
): string | null {
  if (theaterId) {
    const row = db.prepare(`SELECT telegram_chat_id FROM theaters WHERE id = ?`).get(theaterId) as
      | { telegram_chat_id: string | null }
      | undefined;
    const chatId = row?.telegram_chat_id?.trim();
    if (chatId) return chatId;
  }
  return getLegacyTelegramChatId();
}

let cachedBotUsername: string | null | undefined;

export async function getTelegramBotUsername(): Promise<string | null> {
  if (cachedBotUsername !== undefined) return cachedBotUsername;
  const token = getTelegramBotToken();
  if (!token) {
    cachedBotUsername = null;
    return null;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!response.ok) {
      cachedBotUsername = null;
      return null;
    }
    const data = (await response.json()) as { ok?: boolean; result?: { username?: string } };
    cachedBotUsername = data.ok && data.result?.username ? data.result.username : null;
    return cachedBotUsername;
  } catch {
    cachedBotUsername = null;
    return null;
  }
}

export async function getTelegramBotInfo(): Promise<TelegramBotInfo> {
  const token = getTelegramBotToken();
  if (!token) return { configured: false, username: null };
  return { configured: true, username: await getTelegramBotUsername() };
}

/** Подтянуть группы из getUpdates (не сдвигает offset) + кэш недавних чатов. */
export async function discoverTelegramGroupChats(): Promise<CachedTelegramGroupChat[]> {
  const token = getTelegramBotToken();
  if (!token) throw new Error('BOT_NOT_CONFIGURED');

  const offset = readTelegramUpdateOffset();
  const response = await fetch(buildTelegramGetUpdatesUrl(token, offset));
  if (response.ok) {
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: Array<{
        message?: { chat?: { id?: number; title?: string; type?: string } };
        callback_query?: { message?: { chat?: { id?: number; title?: string; type?: string } } };
        my_chat_member?: { chat?: { id?: number; title?: string; type?: string } };
        channel_post?: { chat?: { id?: number; title?: string; type?: string } };
      }>;
    };
    if (payload.ok && payload.result?.length) {
      for (const update of payload.result) {
        rememberTelegramGroupChatFromUpdate(update);
      }
    }
  }

  return listRecentTelegramGroupChats();
}

export async function sendTelegramHtmlMessage(
  chatId: string,
  html: string,
  token: string = getTelegramBotToken() ?? ''
): Promise<void> {
  if (!token) throw new Error('BOT_NOT_CONFIGURED');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatTelegramApiError(body) || `Telegram API ${response.status}`);
  }
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export async function sendTelegramMessageWithInlineKeyboard(
  chatId: string,
  html: string,
  keyboard: InlineKeyboardButton[][],
  token: string = getTelegramBotToken() ?? ''
): Promise<void> {
  if (!token) throw new Error('BOT_NOT_CONFIGURED');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: keyboard },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatTelegramApiError(body) || `Telegram API ${response.status}`);
  }
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text: string,
  token: string = getTelegramBotToken() ?? ''
): Promise<void> {
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });
}

function formatTelegramApiError(body: string): string {
  try {
    const data = JSON.parse(body) as { description?: string };
    const description = data.description ?? '';
    if (description.includes('chat not found')) {
      return 'Чат не найден: добавьте бота в группу, напишите в чат и скопируйте актуальный chat.id из getUpdates (у супергрупп id начинается с -100).';
    }
    if (description.includes('bot was kicked') || description.includes('bot is not a member')) {
      return 'Бот не в группе или был удалён — добавьте @rehears_bot снова и дайте право писать сообщения.';
    }
    if (description.includes('not enough rights')) {
      return 'У бота нет права отправлять сообщения в этой группе.';
    }
    return description || body;
  } catch {
    return body;
  }
}

export async function sendTelegramHtmlToTheater(
  db: AppDatabase,
  theaterId: string,
  html: string
): Promise<void> {
  const token = getTelegramBotToken();
  const chatId = getTheaterTelegramChatId(db, theaterId);
  if (!token) throw new Error('BOT_NOT_CONFIGURED');
  if (!chatId) throw new Error('CHAT_NOT_CONFIGURED');
  await sendTelegramHtmlMessage(chatId, html, token);
}

/** @deprecated */
export function getTelegramConfig(): { token: string; chatId: string } | null {
  const token = getTelegramBotToken();
  const chatId = getLegacyTelegramChatId();
  if (!token || !chatId) return null;
  return { token, chatId };
}
