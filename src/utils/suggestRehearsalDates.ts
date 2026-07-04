import { addDays, format, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState, Rehearsal } from '../types';
import { isActorUnavailable } from './actorAvailability';
import { getActorScheduleConflicts, getExpectedActorIds } from './rehearsalInsights';

export interface SuggestedRehearsalSlot {
  date: string;
  label: string;
  weekdayLabel: string;
  availableCount: number;
  totalCount: number;
}

export function suggestRehearsalDates(
  state: AppState,
  draft: Pick<
    Rehearsal,
    | 'playId'
    | 'performanceId'
    | 'sceneIds'
    | 'taskIds'
    | 'schedule'
    | 'startTime'
    | 'endTime'
    | 'theaterId'
    | 'actorIds'
  >,
  options?: { count?: number; fromDate?: Date; horizonDays?: number }
): SuggestedRehearsalSlot[] {
  const count = options?.count ?? 5;
  const horizonDays = options?.horizonDays ?? 56;
  const from = startOfDay(options?.fromDate ?? new Date());

  const probeBase: Rehearsal = {
    id: '__suggest_probe__',
    theaterId: draft.theaterId,
    date: format(from, 'yyyy-MM-dd'),
    startTime: draft.startTime,
    endTime: draft.endTime,
    location: '',
    notes: '',
    playId: draft.playId,
    performanceId: draft.performanceId,
    sceneIds: draft.sceneIds,
    taskIds: draft.taskIds,
    schedule: draft.schedule,
    actorIds: draft.actorIds,
    attendance: {},
  };

  const expectedIds = getExpectedActorIds(state, probeBase);
  const totalCount = expectedIds.length;
  if (totalCount === 0) return [];

  const suggestions: SuggestedRehearsalSlot[] = [];

  for (let offset = 0; offset < horizonDays && suggestions.length < count; offset++) {
    const day = addDays(from, offset);
    const dateStr = format(day, 'yyyy-MM-dd');
    const probe: Rehearsal = { ...probeBase, date: dateStr };

    let availableCount = 0;
    let allAvailable = true;
    for (const actorId of expectedIds) {
      const actor = state.actors.find((item) => item.id === actorId);
      if (!actor) continue;
      if (isActorUnavailable(actor, dateStr, { startTime: draft.startTime, endTime: draft.endTime })) {
        allAvailable = false;
        break;
      }
      availableCount += 1;
    }
    if (!allAvailable) continue;
    if (getActorScheduleConflicts(state, probe).length > 0) continue;

    suggestions.push({
      date: dateStr,
      label: format(day, 'd MMMM', { locale: ru }),
      weekdayLabel: format(day, 'EEEE', { locale: ru }),
      availableCount,
      totalCount,
    });
  }

  return suggestions;
}
