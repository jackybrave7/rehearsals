/** События прогресса онбординга (одна запись на тип на пользователя — дата первого достижения). */
export const ONBOARDING_EVENT_TYPES = [
  'theater_created',
  'demo_installed',
  'play_created',
  'scenes_created',
  'rehearsal_planned',
  'plan_formed',
  'plan_exported',
  'telegram_connected',
] as const;

export type OnboardingEventType = (typeof ONBOARDING_EVENT_TYPES)[number];

export const ONBOARDING_EVENT_LABELS: Record<OnboardingEventType, string> = {
  theater_created: 'Создал театр',
  demo_installed: 'Установил демо',
  play_created: 'Добавил постановку',
  scenes_created: 'Добавил сцены (≥3)',
  rehearsal_planned: 'Создал репетицию с планом',
  plan_formed: 'Сформировал план',
  plan_exported: 'Экспорт плана (.ics / Telegram)',
  telegram_connected: 'Подключил Telegram-чат театра',
};
