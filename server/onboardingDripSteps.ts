/** Шаги чек-листа — условия отправки писем цепочки. */
export type ChecklistStepId =
  | 'theater'
  | 'actors'
  | 'play'
  | 'scenes'
  | 'cast'
  | 'venue'
  | 'rehearsal'
  | 'telegram';

export type DripConditionType = 'checklist_pending' | 'checklist_done' | 'always';

export const CHECKLIST_STEP_OPTIONS: Array<{ id: ChecklistStepId; label: string }> = [
  { id: 'theater', label: 'Создать театр' },
  { id: 'actors', label: 'Участники театра' },
  { id: 'play', label: 'Добавить постановку' },
  { id: 'scenes', label: 'Добавить сцены (от 3)' },
  { id: 'cast', label: 'Роли в составе' },
  { id: 'venue', label: 'Добавить площадку' },
  { id: 'rehearsal', label: 'Репетиция с планом' },
  { id: 'telegram', label: 'Telegram или план' },
];

export const DRIP_ACTION_PATH_OPTIONS = [
  { value: '/app/overview', label: 'Обзор / театр' },
  { value: '/app/actors', label: 'Участники' },
  { value: '/app/play', label: 'Постановки' },
  { value: '/app/scenes', label: 'Сцены' },
  { value: '/app/play#cast', label: 'Состав' },
  { value: '/app/venues', label: 'Площадки' },
  { value: '/app/rehearsals', label: 'Репетиции' },
  { value: '/app/settings', label: 'Настройки' },
  { value: '/app/guide', label: 'Руководство' },
];

export const DRIP_CONDITION_LABELS: Record<DripConditionType, string> = {
  checklist_pending: 'Пока шаг чек-листа не выполнен',
  checklist_done: 'Когда шаг чек-листа выполнен',
  always: 'Без условия (всегда по очереди)',
};

export interface DefaultDripTemplate {
  title: string;
  checklistStepId: ChecklistStepId;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  actionLabel: string;
  actionPath: string;
}

export {
  DEFAULT_DRIP_STEP_TEMPLATES,
  DRIP_TEMPLATES_CONTENT_VERSION,
} from './onboardingDripDefaultContent.js';
