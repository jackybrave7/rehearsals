import { parseISO, startOfDay } from 'date-fns';
import type { Rehearsal, ScheduleBlock } from '../types';
import { addMinutes } from './time';

function getScheduleBlockEndDate(rehearsalDate: string, block: ScheduleBlock): Date {
  const [year, month, day] = rehearsalDate.split('-').map(Number);
  const endTime = addMinutes(block.startTime, block.durationMinutes);
  const [hours, minutes] = endTime.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** Можно отмечать пункты плана с даты репетиции (включительно) и позже. */
export function canMarkScheduleCompletion(rehearsal: Rehearsal, now = new Date()): boolean {
  const rehearsalDay = startOfDay(parseISO(rehearsal.date));
  const today = startOfDay(now);
  return rehearsalDay.getTime() <= today.getTime();
}

/** Итог блока — только после его запланированного окончания в день репетиции. */
export function canMarkBlockCompletion(
  rehearsal: Rehearsal,
  block: ScheduleBlock,
  now = new Date()
): boolean {
  if (!canMarkScheduleCompletion(rehearsal, now)) return false;
  if (!isScheduleBlockCompletable(block)) return false;

  const rehearsalDay = startOfDay(parseISO(rehearsal.date));
  const today = startOfDay(now);
  if (today.getTime() > rehearsalDay.getTime()) return true;

  return now.getTime() >= getScheduleBlockEndDate(rehearsal.date, block).getTime();
}

export function isScheduleBlockCompletable(block: ScheduleBlock): boolean {
  return block.type !== 'break';
}

export function getCompletableScheduleBlocks(schedule: ScheduleBlock[]): ScheduleBlock[] {
  return schedule.filter(isScheduleBlockCompletable);
}

export function getScheduleCompletionStats(schedule: ScheduleBlock[]): {
  total: number;
  marked: number;
  done: number;
} {
  const blocks = getCompletableScheduleBlocks(schedule);
  const marked = blocks.filter((block) => block.completed !== undefined).length;
  const done = blocks.filter((block) => block.completed === true).length;
  return { total: blocks.length, marked, done };
}
