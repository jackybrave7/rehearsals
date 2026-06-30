import { addDays, addWeeks, format, getDay, isAfter, parseISO } from 'date-fns';
import type { Rehearsal, RehearsalSeries, RehearsalTemplate, ScheduleBlock } from '../types';
import { generateId } from './id';
import { recalculateScheduleStartTimes } from './schedulePlan';

export function getSeriesWeekdayLabel(weekday: number): string {
  return ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][weekday];
}

export function createTemplateFromRehearsal(
  rehearsal: Rehearsal,
  name: string,
  theaterId?: string
): RehearsalTemplate {
  return {
    id: generateId(),
    theaterId,
    playId: rehearsal.playId,
    name,
    startTime: rehearsal.startTime,
    endTime: rehearsal.endTime,
    sceneIds: [...rehearsal.sceneIds],
    taskIds: [...rehearsal.taskIds],
    blocks: rehearsal.schedule.map(({ startTime: _start, id: _id, ...block }) => block),
  };
}

export function applyTemplateToRehearsal(
  template: RehearsalTemplate,
  startTime: string
): Pick<Rehearsal, 'schedule' | 'startTime' | 'endTime'> {
  const schedule: ScheduleBlock[] = template.blocks.map((block) => ({
    ...block,
    id: generateId(),
    startTime: '00:00',
  }));

  return {
    startTime: template.startTime || startTime,
    endTime: template.endTime,
    schedule: recalculateScheduleStartTimes(schedule, template.startTime || startTime),
  };
}

function nextWeekdayOnOrAfter(date: Date, weekday: number): Date {
  let current = date;
  for (let step = 0; step < 7; step += 1) {
    if (getDay(current) === weekday) return current;
    current = addDays(current, 1);
  }
  return current;
}

export function generateSeriesDates(series: RehearsalSeries, maxCount = 16): string[] {
  const dates: string[] = [];
  const until = series.untilDate ? parseISO(series.untilDate) : addWeeks(parseISO(series.fromDate), 12);
  let current = nextWeekdayOnOrAfter(parseISO(series.fromDate), series.weekday);

  while (!isAfter(current, until) && dates.length < maxCount) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addWeeks(current, 1);
  }

  return dates;
}

export function buildRehearsalsFromSeries(
  series: RehearsalSeries,
  template: RehearsalTemplate | undefined,
  existingDates: Set<string>
): Rehearsal[] {
  const dates = generateSeriesDates(series).filter((date) => !existingDates.has(date));
  return dates.map((date) => {
    const base: Rehearsal = {
      id: generateId(),
      theaterId: series.theaterId,
      seriesId: series.id,
      date,
      startTime: series.startTime,
      endTime: series.endTime,
      venueId: series.venueId,
      location: series.location,
      playId: series.playId,
      performanceId: series.performanceId,
      sceneIds: template ? [...template.sceneIds] : [],
      taskIds: template ? [...template.taskIds] : [],
      schedule: [],
      actorIds: [],
      attendance: {},
    };

    if (template) {
      const applied = applyTemplateToRehearsal(template, series.startTime);
      return { ...base, ...applied };
    }

    return base;
  });
}
