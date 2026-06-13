import { isAfter, parseISO, startOfDay } from 'date-fns';
import type { Rehearsal } from '../types';

/** Репетиция считается прошедшей после даты или после endTime в день репетиции. */
export function isRehearsalPast(rehearsal: Rehearsal, now = new Date()): boolean {
  const rehearsalDay = startOfDay(parseISO(rehearsal.date));
  const today = startOfDay(now);

  if (isAfter(today, rehearsalDay)) return true;
  if (isAfter(rehearsalDay, today)) return false;

  const [endH, endM = '0'] = rehearsal.endTime.split(':');
  const endMinutes = Number(endH) * 60 + Number(endM);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= endMinutes;
}

export function getUpcomingRehearsals(rehearsals: Rehearsal[], limit: number): Rehearsal[] {
  const today = startOfDay(new Date());

  return rehearsals
    .filter((rehearsal) => !isAfter(today, parseISO(rehearsal.date)))
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.localeCompare(b.startTime);
    })
    .slice(0, limit);
}
