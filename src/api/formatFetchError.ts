/** Браузерная ошибка, когда запрос к API не дошёл до сервера (нет ответа HTTP). */
export function formatFetchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  ) {
    return [
      'Нет связи с сервером rehears.ru — запрос не дошёл.',
      'Проверьте интернет и обновите страницу.',
      'Если включён VPN, попробуйте другой режим: сайт и Telegram часто «ломают» друг другу маршрутизацию.',
    ].join(' ');
  }
  return message || 'Не удалось выполнить запрос';
}