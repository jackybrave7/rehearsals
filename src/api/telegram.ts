import { API_BASE } from './apiBase';

export interface TelegramStatus {
  configured: boolean;
  botConfigured: boolean;
  botUsername: string | null;
  chatConfigured: boolean;
  remindersSchedulerActive: boolean;
  reminderTickMinutes: number;
  reminderWindowMinutes: number;
}

export async function fetchTelegramStatus(theaterId: string): Promise<TelegramStatus> {
  try {
    const response = await fetch(
      `${API_BASE}/telegram/config?theaterId=${encodeURIComponent(theaterId)}`,
      { credentials: 'include' }
    );
    if (!response.ok) {
      return {
        configured: false,
        botConfigured: false,
        botUsername: null,
        chatConfigured: false,
        remindersSchedulerActive: false,
        reminderTickMinutes: 5,
        reminderWindowMinutes: 10,
      };
    }
    return response.json() as Promise<TelegramStatus>;
  } catch {
    return {
      configured: false,
      botConfigured: false,
      botUsername: null,
      chatConfigured: false,
      remindersSchedulerActive: false,
      reminderTickMinutes: 5,
      reminderWindowMinutes: 10,
    };
  }
}

/** @deprecated Используйте fetchTelegramStatus */
export async function fetchTelegramConfigured(theaterId?: string): Promise<boolean> {
  if (!theaterId) return false;
  const status = await fetchTelegramStatus(theaterId);
  return status.configured;
}

export interface TelegramGroupChat {
  id: string;
  title: string;
  type: 'group' | 'supergroup' | 'channel';
  seenAt: string;
}

export async function fetchTelegramGroupChats(
  theaterId: string,
  options?: { refresh?: boolean }
): Promise<TelegramGroupChat[]> {
  const params = new URLSearchParams({ theaterId });
  if (options?.refresh) params.set('refresh', '1');

  const response = await fetch(`${API_BASE}/telegram/group-chats?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new Error(data?.message ?? data?.error ?? `GROUP_CHATS_FAILED_${response.status}`);
  }

  const payload = (await response.json()) as { chats?: TelegramGroupChat[] };
  return payload.chats ?? [];
}

export async function sendTelegramHtmlMessage(theaterId: string, html: string): Promise<void> {
  const response = await fetch(`${API_BASE}/telegram/send`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theaterId, html }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new Error(data?.message ?? data?.error ?? `SEND_FAILED_${response.status}`);
  }
}

export async function sendTelegramTestMessage(theaterId: string, chatId?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/telegram/test`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theaterId, chatId: chatId?.trim() || undefined }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new Error(data?.message ?? data?.error ?? `TEST_FAILED_${response.status}`);
  }
}
