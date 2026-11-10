import type { Rehearsal, ScheduleBlock } from '../types';
import { formatDuration } from './time';

const blockTypeLabels: Record<ScheduleBlock['type'], string> = {
  scene: 'Сцена',
  task: 'Задача',
  break: 'Перерыв',
  warmup: 'Тренинг',
  custom: 'Другое',
  etude: 'Этюд',
};

export function formatRehearsalPlanForCalendar(rehearsal: Rehearsal): string {
  if (rehearsal.schedule.length === 0) return '';
  return rehearsal.schedule
    .map((block) => {
      const kind = blockTypeLabels[block.type];
      const duration = formatDuration(block.durationMinutes);
      return `${block.startTime} · ${kind}: ${block.title} (${duration})`;
    })
    .join('\n');
}
