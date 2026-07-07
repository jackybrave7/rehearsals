import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.join(path.resolve(__dirname, '..'), 'data', 'telegram-group-chats.json');

export interface CachedTelegramGroupChat {
  id: string;
  title: string;
  type: 'group' | 'supergroup' | 'channel';
  seenAt: string;
}

interface CacheFile {
  chats: CachedTelegramGroupChat[];
}

function readCache(): CacheFile {
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as CacheFile;
    if (!Array.isArray(parsed.chats)) return { chats: [] };
    return parsed;
  } catch {
    return { chats: [] };
  }
}

function writeCache(data: CacheFile): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
}

export function rememberTelegramGroupChat(chat: {
  id: number | string;
  title?: string;
  type?: string;
}): void {
  const type = chat.type;
  if (type !== 'group' && type !== 'supergroup' && type !== 'channel') return;

  const id = String(chat.id);
  const title = chat.title?.trim() || id;
  const entry: CachedTelegramGroupChat = {
    id,
    title,
    type,
    seenAt: new Date().toISOString(),
  };

  const cache = readCache();
  const without = cache.chats.filter((item) => item.id !== id);
  writeCache({ chats: [entry, ...without].slice(0, 30) });
}

export function listRecentTelegramGroupChats(maxAgeDays = 90): CachedTelegramGroupChat[] {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return readCache()
    .chats.filter((chat) => Date.parse(chat.seenAt) >= cutoff)
    .sort((a, b) => Date.parse(b.seenAt) - Date.parse(a.seenAt));
}

export function rememberTelegramGroupChatFromUpdate(update: {
  message?: { chat?: { id?: number; title?: string; type?: string } };
  callback_query?: { message?: { chat?: { id?: number; title?: string; type?: string } } };
  my_chat_member?: { chat?: { id?: number; title?: string; type?: string } };
  channel_post?: { chat?: { id?: number; title?: string; type?: string } };
}): void {
  const candidates = [
    update.message?.chat,
    update.callback_query?.message?.chat,
    update.my_chat_member?.chat,
    update.channel_post?.chat,
  ];
  for (const chat of candidates) {
    if (chat?.id != null) rememberTelegramGroupChat(chat);
  }
}
