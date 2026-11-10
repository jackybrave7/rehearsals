import {
  THEATER_SETUP_STEP_DEFINITIONS,
  type TheaterSetupStepId,
} from '../shared/theaterSetupSteps.js';

/** Шаги чек-листа — условия отправки писем цепочки. */
export type ChecklistStepId = TheaterSetupStepId;

export type DripConditionType =
  | 'checklist_pending'
  | 'checklist_done'
  | 'days_after_checklist_done'
  | 'always';

export const CHECKLIST_STEP_OPTIONS: Array<{ id: ChecklistStepId; label: string }> =
  THEATER_SETUP_STEP_DEFINITIONS.map((step) => ({ id: step.id, label: step.label }));

export const DRIP_ACTION_PATH_OPTIONS = [
  { value: '/app/overview', label: 'Сейчас / театр' },
  { value: '/app/overview?tryDemo=1', label: 'Демо-постановка (tryDemo)' },
  { value: '/app/actors', label: 'Участники' },
  { value: '/app/play', label: 'Постановки' },
  { value: '/app/scenes', label: 'Сцены' },
  { value: '/app/play#cast', label: 'Состав' },
  { value: '/app/venues', label: 'Площадки' },
  { value: '/app/rehearsals', label: 'Репетиции' },
  { value: '/app/settings', label: 'Настройки' },
  { value: '/app/settings?tab=theater&focus=telegram', label: 'Настройки → Telegram театра' },
  { value: '/app/rehearsals?planShare=1', label: 'Репетиция → поделиться планом' },
  { value: '/app/guide', label: 'Руководство' },
  { value: '/app/support', label: 'Поддержка' },
];

export const DRIP_CONDITION_LABELS: Record<DripConditionType, string> = {
  checklist_pending: 'Пока шаг чек-листа не выполнен',
  checklist_done: 'Когда шаг чек-листа выполнен',
  days_after_checklist_done:
    'Через N дней после выполнения шага (не ждёт очереди других писем)',
  always: 'Без условия (всегда по очереди)',
};

export interface DefaultDripTemplate {
  title: string;
  checklistStepId: ChecklistStepId;
  conditionType?: DripConditionType;
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
