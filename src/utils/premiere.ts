import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import type { AppState, Performance } from '../types';

export interface UpcomingPremiere {
  performance: Performance;
  date: string;
  daysLeft: number;
}

export function getUpcomingPremiere(
  state: AppState,
  playId: string,
  today = startOfDay(new Date())
): UpcomingPremiere | undefined {
  const candidates = state.performances
    .filter((performance) => performance.playId === playId && performance.date)
    .map((performance) => ({
      performance,
      parsed: parseISO(performance.date!),
    }))
    .filter(({ parsed }) => parsed >= today)
    .sort((a, b) => a.parsed.getTime() - b.parsed.getTime());

  const next = candidates[0];
  if (!next) return undefined;

  return {
    performance: next.performance,
    date: next.performance.date!,
    daysLeft: differenceInCalendarDays(next.parsed, today),
  };
}

export type PremiereBadgeTone = 'neutral' | 'gold' | 'urgent';

export function getPremiereBadgeTone(daysLeft: number): PremiereBadgeTone {
  if (daysLeft <= 3) return 'urgent';
  if (daysLeft <= 14) return 'gold';
  return 'neutral';
}

export function formatPremiereCountdown(daysLeft: number): string {
  if (daysLeft === 0) return 'сегодня';
  if (daysLeft === 1) return 'завтра';
  return `через ${daysLeft} дн.`;
}
