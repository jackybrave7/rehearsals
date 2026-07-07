import { sendTelegramHtmlMessage } from './telegram.js';

let cachedBotUserId: number | null | undefined;

export async function getTelegramBotUserId(token: string): Promise<number | null> {
  if (cachedBotUserId !== undefined) return cachedBotUserId;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!response.ok) {
      cachedBotUserId = null;
      return null;
    }
    const data = (await response.json()) as { ok?: boolean; result?: { id?: number } };
    cachedBotUserId = data.ok && data.result?.id ? data.result.id : null;
    return cachedBotUserId;
  } catch {
    cachedBotUserId = null;
    return null;
  }
}

function settingsUrl(): string {
  const appUrl = process.env.APP_URL?.trim() || 'https://rehears.ru';
  return `${appUrl.replace(/\/$/, '')}/app/settings`;
}

function buildWelcomeHtml(chatId: string, reason: 'joined' | 'migrated'): string {
  const settingsLink = settingsUrl();
  if (reason === 'migrated') {
    return [
      '<b>Группа стала супергруппой</b> — Chat ID изменился.',
      '',
      `Новый Chat ID: <code>${chatId}</code>`,
      '',
      `Обновите его в <a href="${settingsLink}">настройках театра</a> → <b>Telegram чат театра</b> → <b>Сохранить</b> → <b>Проверить</b>.`,
      'Старый id больше не работает.',
    ].join('\n');
  }

  return [
    '<b>Бот «Репетиции» подключён к этому чату</b>',
    '',
    `Chat ID: <code>${chatId}</code>`,
    '',
    `Скопируйте его в <a href="${settingsLink}">настройки театра</a> → <b>Telegram чат театра</b> → вставьте в поле Chat ID → <b>Сохранить</b> → <b>Проверить</b>.`,
    '',
    'Если группа станет супергруппой, Chat ID может измениться (обычно начинается с <code>-100</code>) — бот пришлёт новый номер автоматически.',
  ].join('\n');
}

function isBotJoinedGroup(member: {
  old_chat_member?: { status?: string };
  new_chat_member?: { status?: string; user?: { id?: number } };
}): boolean {
  const newStatus = member.new_chat_member?.status;
  const oldStatus = member.old_chat_member?.status;
  if (newStatus !== 'member' && newStatus !== 'administrator') return false;
  return oldStatus === 'left' || oldStatus === 'kicked' || oldStatus === 'restricted';
}

export async function sendGroupChatIdWelcomeMessage(
  chatId: string,
  token: string,
  reason: 'joined' | 'migrated' = 'joined'
): Promise<void> {
  await sendTelegramHtmlMessage(chatId, buildWelcomeHtml(chatId, reason), token);
}

export type TelegramGroupWelcomeUpdate = {
  message?: {
    chat?: { id?: number; title?: string; type?: string };
    migrate_to_chat_id?: number;
    new_chat_members?: Array<{ id?: number; is_bot?: boolean }>;
    text?: string;
  };
  my_chat_member?: {
    chat?: { id?: number; title?: string; type?: string };
    old_chat_member?: { status?: string };
    new_chat_member?: { status?: string; user?: { id?: number } };
  };
};

async function wasBotAddedViaServiceMessage(
  update: TelegramGroupWelcomeUpdate,
  token: string
): Promise<string | null> {
  const chat = update.message?.chat;
  const members = update.message?.new_chat_members;
  if (!chat?.id || !members?.length) return null;
  if (chat.type !== 'group' && chat.type !== 'supergroup') return null;

  const botId = await getTelegramBotUserId(token);
  if (!botId) return null;
  if (!members.some((member) => member.is_bot && member.id === botId)) return null;
  return String(chat.id);
}

/** Отправить в группу Chat ID при добавлении бота, миграции или команде /chatid. */
export async function handleTelegramGroupChatWelcome(
  update: TelegramGroupWelcomeUpdate,
  token: string
): Promise<boolean> {
  const migratedTo = update.message?.migrate_to_chat_id;
  if (migratedTo != null) {
    const chatId = String(migratedTo);
    try {
      await sendGroupChatIdWelcomeMessage(chatId, token, 'migrated');
      console.log('[telegram] sent supergroup chat id', chatId);
      return true;
    } catch (error) {
      console.warn('[telegram] supergroup welcome failed', chatId, error);
      return false;
    }
  }

  const addedChatId = await wasBotAddedViaServiceMessage(update, token);
  if (addedChatId) {
    try {
      await sendGroupChatIdWelcomeMessage(addedChatId, token, 'joined');
      console.log('[telegram] sent group chat id (new_chat_members)', addedChatId);
      return true;
    } catch (error) {
      console.warn('[telegram] group welcome failed', addedChatId, error);
      return false;
    }
  }

  const member = update.my_chat_member;
  const chat = member?.chat;
  if (!chat?.id) return false;
  if (chat.type !== 'group' && chat.type !== 'supergroup') return false;
  if (!isBotJoinedGroup(member)) return false;

  const botId = await getTelegramBotUserId(token);
  if (!botId || member.new_chat_member?.user?.id !== botId) return false;

  const chatId = String(chat.id);
  try {
    await sendGroupChatIdWelcomeMessage(chatId, token, 'joined');
    console.log('[telegram] sent group chat id (my_chat_member)', chatId);
    return true;
  } catch (error) {
    console.warn('[telegram] group welcome failed', chatId, error);
    return false;
  }
}

export async function handleTelegramGroupChatIdCommand(
  update: TelegramGroupWelcomeUpdate,
  token: string
): Promise<boolean> {
  const text = update.message?.text?.trim() ?? '';
  if (!/^\/chatid(?:@\w+)?$/i.test(text)) return false;

  const chat = update.message?.chat;
  if (!chat?.id) return false;
  if (chat.type !== 'group' && chat.type !== 'supergroup') return false;

  const chatId = String(chat.id);
  try {
    await sendGroupChatIdWelcomeMessage(chatId, token, 'joined');
    console.log('[telegram] sent group chat id (/chatid)', chatId);
    return true;
  } catch (error) {
    console.warn('[telegram] /chatid failed', chatId, error);
    return false;
  }
}
