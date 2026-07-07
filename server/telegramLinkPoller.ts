import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppDatabase } from './db.js';
import { getDb } from './db.js';
import { getTelegramBotToken } from './telegram.js';
import {
  handleTelegramActorCommand,
  handleTelegramBusyCallback,
  handleTelegramNoteAckCallback,
  handleTelegramRsvpCallback,
  handleTelegramRsvpMenuCallback,
} from './telegramActorCommands.js';
import { propagateTelegramChatIdByEmail } from './actorTelegramLink.js';
import { rememberTelegramGroupChatFromUpdate } from './telegramGroupChatCache.js';
import {
  handleTelegramGroupChatIdCommand,
  handleTelegramGroupChatWelcome,
} from './telegramGroupWelcome.js';
import { buildTelegramGetUpdatesUrl, ensureTelegramPollingMode } from './telegramUpdates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const offsetPath = path.join(path.resolve(__dirname, '..'), 'data', 'telegram-update-offset.txt');

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

async function pollTelegramActorLinks(db: AppDatabase): Promise<number> {
  const token = getTelegramBotToken();
  if (!token) return 0;

  let offset = readOffset();
  const response = await fetch(buildTelegramGetUpdatesUrl(token, offset));
  if (!response.ok) return 0;

  const payload = (await response.json()) as {
    ok?: boolean;
    result?: Array<{
      update_id: number;
      message?: {
        chat?: { id?: number; title?: string; type?: string };
        text?: string;
        migrate_to_chat_id?: number;
        new_chat_members?: Array<{ id?: number; is_bot?: boolean }>;
      };
      my_chat_member?: {
        chat?: { id?: number; title?: string; type?: string };
        old_chat_member?: { status?: string };
        new_chat_member?: { status?: string; user?: { id?: number } };
      };
      channel_post?: {
        chat?: { id?: number; title?: string; type?: string };
      };
      callback_query?: {
        id: string;
        data?: string;
        message?: { chat?: { id?: number; title?: string; type?: string } };
        from?: { id?: number };
      };
    }>;
  };

  if (!payload.ok || !payload.result?.length) return 0;

  let handled = 0;
  const updateActor = db.prepare(`UPDATE actors SET telegram_chat_id = ? WHERE id = ?`);

  for (const update of payload.result) {
    offset = Math.max(offset, update.update_id + 1);
    rememberTelegramGroupChatFromUpdate(update);

    if (await handleTelegramGroupChatWelcome(update, token)) {
      handled += 1;
      continue;
    }

    if (await handleTelegramGroupChatIdCommand(update, token)) {
      handled += 1;
      continue;
    }

    const callback = update.callback_query;
    if (callback?.data && callback.id) {
      const chatId = callback.message?.chat?.id ?? callback.from?.id;
      if (chatId != null) {
        const chatIdStr = String(chatId);
        const processed =
          (await handleTelegramRsvpCallback(db, callback.id, chatIdStr, callback.data, token)) ||
          (await handleTelegramRsvpMenuCallback(db, callback.id, chatIdStr, callback.data, token)) ||
          (await handleTelegramBusyCallback(db, callback.id, chatIdStr, callback.data, token)) ||
          (await handleTelegramNoteAckCallback(db, callback.id, chatIdStr, callback.data, token));
        if (processed) handled += 1;
      }
      continue;
    }

    const text = update.message?.text?.trim() ?? '';
    const chatId = update.message?.chat?.id;
    if (chatId == null) continue;

    const chatIdStr = String(chatId);
    const linkMatch = text.match(/^\/start(?:@\w+)?\s+link_([0-9a-f-]+)$/i);
    if (linkMatch) {
      const actorId = linkMatch[1];
      const actorRow = db
        .prepare(`SELECT id, email FROM actors WHERE id = ?`)
        .get(actorId) as { id: string; email: string | null } | undefined;
      if (!actorRow) continue;

      updateActor.run(chatIdStr, actorId);

      const email = actorRow.email?.trim();
      if (email) {
        const linkedPeers = propagateTelegramChatIdByEmail(db, actorId, chatIdStr, email);
        if (linkedPeers > 0) {
          console.log(`[telegram] propagated chat ${chatIdStr} to ${linkedPeers} actor(s) with email ${email}`);
        }
      }

      handled += 1;
      console.log(`[telegram] linked actor ${actorId} to chat ${chatIdStr}`);
      continue;
    }

    if (text.startsWith('/')) {
      const processed = await handleTelegramActorCommand(db, chatIdStr, text, token);
      if (processed) handled += 1;
    }
  }

  if (offset > 0) writeOffset(offset);
  return handled;
}

export function startTelegramLinkPoller(db: AppDatabase = getDb()): () => void {
  const token = getTelegramBotToken();
  if (!token) {
    return () => undefined;
  }

  void ensureTelegramPollingMode(token);

  const tick = () => {
    void pollTelegramActorLinks(db).catch((error) => {
      console.error('[telegram] link poll failed', error);
    });
  };

  tick();
  const timer = setInterval(tick, 15_000);
  return () => clearInterval(timer);
}
