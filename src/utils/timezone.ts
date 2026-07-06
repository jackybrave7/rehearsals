import type { Theater } from '../types';

export const DEFAULT_TIMEZONE = 'Europe/Moscow';

export interface TimezoneOption {
  value: string;
  label: string;
}

/** Часовые пояса России (фиксированное смещение, без перехода на летнее время). */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
];

export function resolveTheaterTimezone(theater?: Pick<Theater, 'timezone'> | null): string {
  const value = theater?.timezone?.trim();
  if (value && TIMEZONE_OPTIONS.some((option) => option.value === value)) {
    return value;
  }
  return DEFAULT_TIMEZONE;
}

export function getTimezoneLabel(timezone: string): string {
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone;
}

/** Смещение от UTC в часах для заданной IANA-зоны на указанный момент. */
export function getTimezoneOffsetHours(timezone: string, date = new Date()): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 3_600_000);
}

export function resolveTheaterUtcOffsetHours(theater?: Pick<Theater, 'timezone'> | null, date = new Date()): number {
  return getTimezoneOffsetHours(resolveTheaterTimezone(theater), date);
}

/** Календарная дата YYYY-MM-DD в часовом поясе театра. */
export function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
}
