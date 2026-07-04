import { addYears, format, getDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { Actor, ActorUnavailability } from '../types';
import { timeToMinutes } from './time';

export interface ActorTimeRange {
  startTime: string;
  endTime: string;
}

function matchesUnavailabilityPeriod(period: ActorUnavailability, day: Date): boolean {
  const from = startOfDay(parseISO(period.from));
  const to = startOfDay(parseISO(period.to));
  if (day < from || day > to) return false;

  if (period.recurrence === 'weekly' && period.weekdays?.length) {
    return period.weekdays.includes(getDay(day));
  }

  return isWithinInterval(day, { start: from, end: to });
}

export function isFullDayUnavailability(period: ActorUnavailability): boolean {
  return !period.startTime?.trim() && !period.endTime?.trim();
}

export function timeRangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

function periodBlocksTime(
  period: ActorUnavailability,
  day: Date,
  timeRange?: ActorTimeRange
): boolean {
  if (!matchesUnavailabilityPeriod(period, day)) return false;
  if (!timeRange?.startTime || !timeRange?.endTime) return true;
  if (isFullDayUnavailability(period)) return true;
  if (period.startTime && period.endTime) {
    return timeRangesOverlap(timeRange.startTime, timeRange.endTime, period.startTime, period.endTime);
  }
  return true;
}

function findMatchingPeriods(
  actor: Actor,
  date: string,
  timeRange?: ActorTimeRange
): ActorUnavailability[] {
  if (actor.status === 'archived') return [];
  const day = startOfDay(parseISO(date));
  return (actor.unavailability ?? []).filter((period) => periodBlocksTime(period, day, timeRange));
}

export function getActorDayUnavailabilityKind(
  actor: Actor,
  date: string
): 'none' | 'full' | 'partial' {
  if (actor.status === 'archived') return 'none';
  const day = startOfDay(parseISO(date));
  const matching = (actor.unavailability ?? []).filter((period) =>
    matchesUnavailabilityPeriod(period, day)
  );
  if (matching.length === 0) return 'none';
  if (matching.some(isFullDayUnavailability)) return 'full';
  return 'partial';
}

export function isActorUnavailable(
  actor: Actor,
  date: string,
  timeRange?: ActorTimeRange
): boolean {
  return findMatchingPeriods(actor, date, timeRange).length > 0;
}

export function formatUnavailabilityTimeRange(period: ActorUnavailability): string {
  if (isFullDayUnavailability(period)) return 'весь день';
  if (period.startTime && period.endTime) return `${period.startTime}–${period.endTime}`;
  if (period.endTime) return `до ${period.endTime}`;
  if (period.startTime) return `с ${period.startTime}`;
  return 'весь день';
}

export function getActorUnavailabilityReason(
  actor: Actor,
  date: string,
  timeRange?: ActorTimeRange
): string | undefined {
  const periods = findMatchingPeriods(actor, date, timeRange);
  if (periods.length === 0) return undefined;

  const period = periods[0];
  const timeLabel = formatUnavailabilityTimeRange(period);
  const reason = period.reason?.trim();
  if (reason) return `${reason} (${timeLabel})`;
  return timeLabel === 'весь день' ? 'Недоступен' : `Недоступен: ${timeLabel}`;
}

export function getActorUnavailabilityBadge(actor: Actor, today = startOfDay(new Date())): string | undefined {
  if (actor.status === 'archived') return undefined;

  for (const period of actor.unavailability ?? []) {
    if (period.recurrence === 'weekly' && period.weekdays?.length) {
      const from = startOfDay(parseISO(period.from));
      const to = startOfDay(parseISO(period.to));
      if (to < today) continue;
      if (today >= from && today <= to && period.weekdays.includes(getDay(today))) {
        const timeLabel = formatUnavailabilityTimeRange(period);
        const reason = period.reason?.trim();
        if (reason) return reason;
        return timeLabel === 'весь день' ? 'Недоступен по расписанию' : `Недоступен ${timeLabel}`;
      }
      if (from > today) {
        return `Недоступен с ${period.from.split('-').reverse().join('.')}`;
      }
      continue;
    }

    const from = startOfDay(parseISO(period.from));
    const to = startOfDay(parseISO(period.to));
    if (to < today) continue;
    if (isWithinInterval(today, { start: from, end: to })) {
      const timeLabel = formatUnavailabilityTimeRange(period);
      if (timeLabel !== 'весь день') return `Недоступен ${timeLabel}`;
      return `Недоступен до ${period.to.split('-').reverse().join('.')}`;
    }
    if (from > today) {
      return `Недоступен с ${period.from.split('-').reverse().join('.')}`;
    }
  }

  return undefined;
}

export function getUnavailableWarningId(actorId: string): string {
  return `unavailable:${actorId}`;
}

export function createWeekdayUnavailability(
  weekdays: number[],
  reason?: string,
  id?: string,
  timeRange?: Pick<ActorUnavailability, 'startTime' | 'endTime'>
): ActorUnavailability {
  const today = format(new Date(), 'yyyy-MM-dd');
  const until = format(addYears(new Date(), 1), 'yyyy-MM-dd');
  return {
    id: id ?? `weekday-${Date.now()}`,
    from: today,
    to: until,
    recurrence: 'weekly',
    weekdays,
    reason: reason ?? 'Будни',
    startTime: timeRange?.startTime,
    endTime: timeRange?.endTime,
  };
}
