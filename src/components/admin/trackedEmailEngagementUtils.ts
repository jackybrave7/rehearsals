import { differenceInMinutes, parseISO } from 'date-fns';

/** Пиксель открытия не говорит «письмо открыто сейчас» — только недавняя активность. */
const RECENT_OPEN_MINUTES = 20;

export function isRecentlyOpened(lastOpenedAt: string | null | undefined): boolean {
  if (!lastOpenedAt) return false;
  const opened = parseISO(lastOpenedAt);
  if (!Number.isFinite(opened.getTime())) return false;
  const age = differenceInMinutes(new Date(), opened);
  return age >= 0 && age <= RECENT_OPEN_MINUTES;
}

export function openEngagementLabel(
  openCount: number,
  lastOpenedAt: string | null | undefined
): { tone: 'none' | 'recent' | 'opened'; text: string } {
  if (openCount <= 0) {
    return { tone: 'none', text: 'Не открывали' };
  }
  if (isRecentlyOpened(lastOpenedAt)) {
    return { tone: 'recent', text: 'Было открыто недавно' };
  }
  return { tone: 'opened', text: `Открывали · ${openCount}` };
}

export function shortenUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) return '—';
  const ua = userAgent.trim();
  if (ua.length <= 72) return ua;
  return `${ua.slice(0, 69)}…`;
}