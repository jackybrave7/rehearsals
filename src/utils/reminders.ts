import type { AppState, Theater } from '../types';

export type ReminderType = 'day_before' | 'morning_of' | 'two_hours';

export interface TheaterReminderSettings {
  enabled: boolean;
  types: ReminderType[];
  /** Час «утра» в день репетиции (локальное время театра), по умолчанию 9 */
  morningHour?: number;
}

export interface RehearsalReminderSent {
  kind: ReminderType | 'T-24h' | 'T-2h' | 'custom';
  at: string;
  actorId?: string;
  offsetHours?: number;
}

export const REMINDER_TYPES: ReminderType[] = ['day_before', 'morning_of', 'two_hours'];

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  day_before: 'За сутки',
  morning_of: 'Утром в день репетиции',
  two_hours: 'За 2 часа',
};

export const DEFAULT_THEATER_REMINDER_SETTINGS: TheaterReminderSettings = {
  enabled: false,
  types: ['day_before', 'two_hours'],
  morningHour: 9,
};

export const DEFAULT_REHEARSAL_UTC_OFFSET_HOURS = 3;

export const DEFAULT_REMINDER_MORNING_HOUR = 9;

function normalizeTypes(types: ReminderType[] | undefined): ReminderType[] {
  const unique = REMINDER_TYPES.filter((type) => types?.includes(type));
  return unique.length > 0 ? unique : DEFAULT_THEATER_REMINDER_SETTINGS.types;
}

export function resolveTheaterReminderSettings(
  theater: Pick<Theater, 'reminderSettings'>,
  appMeta?: AppState['appMeta']
): TheaterReminderSettings {
  if (theater.reminderSettings) {
    return {
      enabled: theater.reminderSettings.enabled,
      types: normalizeTypes(theater.reminderSettings.types),
      morningHour:
        theater.reminderSettings.morningHour ?? DEFAULT_THEATER_REMINDER_SETTINGS.morningHour,
    };
  }

  const legacy = appMeta?.reminders;
  if (legacy) {
    const types: ReminderType[] = [];
    if (legacy.offsetsHours?.includes(24)) types.push('day_before');
    if (legacy.offsetsHours?.includes(2)) types.push('two_hours');
    return {
      enabled: legacy.enabled,
      types: normalizeTypes(types),
      morningHour: DEFAULT_THEATER_REMINDER_SETTINGS.morningHour,
    };
  }

  return { ...DEFAULT_THEATER_REMINDER_SETTINGS };
}

/** @deprecated используйте resolveTheaterReminderSettings */
export function resolveReminderSettings(appMeta: AppState['appMeta']) {
  const legacy = resolveTheaterReminderSettings({}, appMeta);
  const offsetsHours: number[] = [];
  if (legacy.types.includes('day_before')) offsetsHours.push(24);
  if (legacy.types.includes('two_hours')) offsetsHours.push(2);
  return {
    enabled: legacy.enabled,
    offsetsHours: offsetsHours.length > 0 ? offsetsHours : [24, 2],
  };
}

export function reminderSentKey(kind: ReminderType, actorId: string): string {
  return `${kind}:${actorId}`;
}

export function hasReminderBeenSent(
  sent: RehearsalReminderSent[] | undefined,
  kind: ReminderType,
  actorId: string
): boolean {
  const key = reminderSentKey(kind, actorId);
  return (sent ?? []).some((entry) => {
    if (entry.actorId !== actorId) return false;
    if (entry.kind === kind) return true;
    if (kind === 'day_before' && entry.kind === 'T-24h') return true;
    if (kind === 'two_hours' && entry.kind === 'T-2h') return true;
    return reminderSentKey(entry.kind as ReminderType, entry.actorId ?? '') === key;
  });
}

export function formatReminderKindLabel(kind: RehearsalReminderSent['kind'], offsetHours?: number): string {
  if (kind === 'day_before' || kind === 'T-24h') return 'за сутки';
  if (kind === 'morning_of') return 'утром в день репетиции';
  if (kind === 'two_hours' || kind === 'T-2h') return 'за 2 ч';
  if (kind === 'custom') return `за ${offsetHours ?? '?'} ч`;
  return String(kind);
}

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

function localDateString(now: Date, utcOffsetHours: number): string {
  const shifted = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localMinutesSinceMidnight(now: Date, utcOffsetHours: number): number {
  const shifted = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function isOffsetReminderDue(
  rehearsalStart: Date,
  offsetHours: number,
  now: Date,
  windowMinutes: number
): boolean {
  const targetMs = rehearsalStart.getTime() - offsetHours * 60 * 60 * 1000;
  const nowMs = now.getTime();
  return nowMs >= targetMs && nowMs < targetMs + windowMinutes * 60 * 1000;
}

export function isReminderTypeDue(
  type: ReminderType,
  date: string,
  startTime: string,
  now: Date,
  windowMinutes: number,
  utcOffsetHours = DEFAULT_REHEARSAL_UTC_OFFSET_HOURS,
  morningHour = DEFAULT_REMINDER_MORNING_HOUR
): boolean {
  const rehearsalStart = parseRehearsalStartUtc(date, startTime, utcOffsetHours);

  if (type === 'day_before') {
    return isOffsetReminderDue(rehearsalStart, 24, now, windowMinutes);
  }
  if (type === 'two_hours') {
    return isOffsetReminderDue(rehearsalStart, 2, now, windowMinutes);
  }

  if (localDateString(now, utcOffsetHours) !== date) return false;
  const startMinutes = (morningHour ?? DEFAULT_REMINDER_MORNING_HOUR) * 60;
  const nowMinutes = localMinutesSinceMidnight(now, utcOffsetHours);
  return nowMinutes >= startMinutes && nowMinutes < startMinutes + windowMinutes;
}

export function isRehearsalInFuture(
  date: string,
  startTime: string,
  now = new Date(),
  utcOffsetHours = DEFAULT_REHEARSAL_UTC_OFFSET_HOURS
): boolean {
  return parseRehearsalStartUtc(date, startTime, utcOffsetHours).getTime() > now.getTime();
}

export function clearRemindersOnScheduleChange<
  T extends { date: string; startTime: string; remindersSent?: RehearsalReminderSent[] },
>(next: T, prev?: Pick<T, 'date' | 'startTime' | 'remindersSent'>): T {
  if (!prev) return next;
  if (prev.date === next.date && prev.startTime === next.startTime) return next;
  return { ...next, remindersSent: undefined };
}
