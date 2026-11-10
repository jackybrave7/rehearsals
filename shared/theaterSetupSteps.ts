/** Единый источник шагов настройки театра (чеклист, справка, drip). */
export type TheaterSetupStepId =
  | 'theater'
  | 'actors'
  | 'play'
  | 'scenes'
  | 'cast'
  | 'venue'
  | 'rehearsal'
  | 'telegram'
  | 'telegram_bot';

export interface TheaterSetupStepDefinition {
  id: TheaterSetupStepId;
  label: string;
}

export const THEATER_SETUP_STEP_DEFINITIONS: readonly TheaterSetupStepDefinition[] = [
  { id: 'theater', label: 'Создать театр' },
  { id: 'actors', label: 'Участники театра' },
  { id: 'play', label: 'Добавить постановку' },
  { id: 'scenes', label: 'Добавить сцены (от 3)' },
  { id: 'cast', label: 'Роли в составе' },
  { id: 'venue', label: 'Добавить площадку' },
  { id: 'rehearsal', label: 'Создать репетицию с планом' },
  { id: 'telegram', label: 'Отправить план (Telegram или .ics) — необязательно' },
  { id: 'telegram_bot', label: 'Telegram-бот: чат и участники — необязательно' },
] as const;

export const THEATER_SETUP_STEP_COUNT = THEATER_SETUP_STEP_DEFINITIONS.length;

export function theaterSetupStepLabel(id: TheaterSetupStepId): string {
  return THEATER_SETUP_STEP_DEFINITIONS.find((s) => s.id === id)?.label ?? id;
}
