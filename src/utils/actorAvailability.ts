import { isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { Actor } from '../types';

export function isActorUnavailable(actor: Actor, date: string): boolean {
  if (actor.status === 'archived') return false;
  const day = startOfDay(parseISO(date));
  for (const period of actor.unavailability ?? []) {
    const from = startOfDay(parseISO(period.from));
    const to = startOfDay(parseISO(period.to));
    if (isWithinInterval(day, { start: from, end: to })) return true;
  }
  return false;
}

export function getActorUnavailabilityReason(actor: Actor, date: string): string | undefined {
  if (!isActorUnavailable(actor, date)) return undefined;
  const day = startOfDay(parseISO(date));
  const period = (actor.unavailability ?? []).find((entry) => {
    const from = startOfDay(parseISO(entry.from));
    const to = startOfDay(parseISO(entry.to));
    return isWithinInterval(day, { start: from, end: to });
  });
  return period?.reason?.trim() || undefined;
}

export function getActorUnavailabilityBadge(actor: Actor, today = startOfDay(new Date())): string | undefined {
  if (actor.status === 'archived') return undefined;
  let nearestEnd: string | null = null;
  for (const period of actor.unavailability ?? []) {
    const from = startOfDay(parseISO(period.from));
    const to = startOfDay(parseISO(period.to));
    if (to < today) continue;
    if (isWithinInterval(today, { start: from, end: to })) {
      return `Недоступен до ${period.to.split('-').reverse().join('.')}`;
    }
    if (from > today && (!nearestEnd || from < parseISO(nearestEnd))) {
      nearestEnd = period.from;
    }
  }
  if (nearestEnd) {
    return `Недоступен с ${nearestEnd.split('-').reverse().join('.')}`;
  }
  return undefined;
}

export function getUnavailableWarningId(actorId: string): string {
  return `unavailable:${actorId}`;
}
