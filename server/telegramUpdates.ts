/** Типы апдейтов для long polling (без webhook). */
export const TELEGRAM_ALLOWED_UPDATES = [
  'message',
  'my_chat_member',
  'callback_query',
  'channel_post',
] as const;

export function buildTelegramGetUpdatesUrl(token: string, offset: number): string {
  const params = new URLSearchParams({
    timeout: '0',
    offset: String(offset),
    allowed_updates: JSON.stringify(TELEGRAM_ALLOWED_UPDATES),
  });
  return `https://api.telegram.org/bot${token}/getUpdates?${params}`;
}

let pollingModeEnsured = false;

/** getUpdates не работает, пока активен webhook — отключаем один раз при старте. */
export async function ensureTelegramPollingMode(token: string): Promise<void> {
  if (pollingModeEnsured) return;
  pollingModeEnsured = true;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
    });
    if (response.ok) {
      console.log('[telegram] polling mode: webhook cleared');
    }
  } catch (error) {
    console.warn('[telegram] deleteWebhook failed', error);
  }
}
