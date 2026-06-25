import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppDatabase } from './db.js';
import { getDb } from './db.js';
import { getTelegramBotToken } from './telegram.js';

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
    }>;
  };

  if (!payload.ok || !payload.result?.length) return 0;

  let linked = 0;
  const updateActor = db.prepare(`UPDATE actors SET telegram_chat_id = ? WHERE id = ?`);

  for (const update of payload.result) {
    offset = Math.max(offset, update.update_id + 1);
    const text = update.message?.text?.trim() ?? '';
    const chatId = update.message?.chat?.id;
    const match = text.match(/^\/start(?:@\w+)?\s+link_([0-9a-f-]+)$/i);
    if (!match || chatId == null) continue;

    const actorId = match[1];
    const exists = db.prepare(`SELECT id FROM actors WHERE id = ?`).get(actorId);
    if (!exists) continue;

    updateActor.run(String(chatId), actorId);
    linked += 1;
    console.log(`[telegram] linked actor ${actorId} to chat ${chatId}`);
  }

  if (offset > 0) writeOffset(offset);
  return linked;
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
