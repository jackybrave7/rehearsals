import type { AppState } from '../types';

export type ReminderKind = 'T-24h' | 'T-2h' | 'custom';

export interface RehearsalReminderSent {
  kind: ReminderKind;
  at: string;
  /** Для kind === 'custom' — смещение в часах */
  offsetHours?: number;
}

export interface ReminderSettings {
  enabled: boolean;
  offsetsHours: number[];
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  offsetsHours: [24, 2],
};

export function resolveReminderSettings(
  appMeta: AppState['appMeta']
): ReminderSettings {
  const raw = appMeta?.reminders;
  return {
    enabled: raw?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
    offsetsHours:
      raw?.offsetsHours?.length && raw.offsetsHours.every((h) => h > 0)
        ? [...raw.offsetsHours].sort((a, b) => b - a)
        : DEFAULT_REMINDER_SETTINGS.offsetsHours,
  };
}

export function getReminderKind(offsetHours: number): ReminderKind {
  if (offsetHours === 24) return 'T-24h';
  if (offsetHours === 2) return 'T-2h';
  return 'custom';
}

export function reminderSentKey(kind: ReminderKind, offsetHours: number): string {
  if (kind === 'custom') return `custom:${offsetHours}`;
  return kind;
}

export function hasReminderBeenSent(
  sent: RehearsalReminderSent[] | undefined,
  kind: ReminderKind,
  offsetHours: number
): boolean {
  const key = reminderSentKey(kind, offsetHours);
  return (sent ?? []).some(
    (entry) => reminderSentKey(entry.kind, entry.offsetHours ?? 0) === key
  );
}

export function formatReminderKindLabel(kind: ReminderKind, offsetHours?: number): string {
  if (kind === 'T-24h') return 'за 24 ч';
  if (kind === 'T-2h') return 'за 2 ч';
  return `за ${offsetHours ?? '?'} ч`;
}

export const DEFAULT_REHEARSAL_UTC_OFFSET_HOURS = 3;

export function parseRehearsalStartUtc(
  date: string,
  startTime: string,
  utcOffsetHours = DEFAULT_REHEARSAL_UTC_OFFSET_HOURS
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = startTime.split(':').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours - utcOffsetHours, minutes, 0, 0)
  );
}

export function isReminderDue(
  rehearsalStart: Date,
  offsetHours: number,
  now = new Date(),
  windowMinutes = 10
): boolean {
  const targetMs = rehearsalStart.getTime() - offsetHours * 60 * 60 * 1000;
  const nowMs = now.getTime();
  return nowMs >= targetMs && nowMs < targetMs + windowMinutes * 60 * 1000;
}

export function isRehearsalInFuture(
  date: string,
  startTime: string,
  now = new Date(),
  utcOffsetHours = DEFAULT_REHEARSAL_UTC_OFFSET_HOURS
): boolean {
  return parseRehearsalStartUtc(date, startTime, utcOffsetHours).getTime() > now.getTime();
}

export function clearRemindersOnScheduleChange<T extends { date: string; startTime: string; remindersSent?: RehearsalReminderSent[] }>(
  next: T,
  prev?: Pick<T, 'date' | 'startTime' | 'remindersSent'>
): T {
  if (!prev) return next;
  if (prev.date === next.date && prev.startTime === next.startTime) return next;
  return { ...next, remindersSent: undefined };
}
