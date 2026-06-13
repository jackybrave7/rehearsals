import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState, AttendanceStatus, Rehearsal, ScheduleBlock } from '../types';
import { isRehearsalPast } from './rehearsalSort';
import { getSceneIdsFromSchedule } from './scheduleSync';

function getSceneIdsInRehearsal(rehearsal: Rehearsal): Set<string> {
  const ids = new Set<string>();
  for (const sceneId of rehearsal.sceneIds) {
    ids.add(sceneId);
  }
  for (const sceneId of getSceneIdsFromSchedule(rehearsal.schedule)) {
    ids.add(sceneId);
  }
  return ids;
}

function formatRehearsalDateLabel(isoDate: string): string {
  const date = parseISO(isoDate);
  const currentYear = new Date().getFullYear();
  if (date.getFullYear() !== currentYear) {
    return format(date, 'd MMM yyyy', { locale: ru });
  }
  return format(date, 'd MMM', { locale: ru });
}

export interface SceneRehearsalHistoryOptions {
  playId?: string;
  excludeRehearsalId?: string;
}

/** sceneId → даты прошлых репетиций (отсортированы, без дубликатов) */
export function buildSceneRehearsalDatesMap(
  rehearsals: Rehearsal[],
  options: SceneRehearsalHistoryOptions = {}
): Map<string, string[]> {
  const datesByScene = new Map<string, Set<string>>();

  for (const rehearsal of rehearsals) {
    if (options.excludeRehearsalId && rehearsal.id === options.excludeRehearsalId) continue;
    if (options.playId && rehearsal.playId !== options.playId) continue;
    if (!isRehearsalPast(rehearsal)) continue;

    for (const sceneId of getSceneIdsInRehearsal(rehearsal)) {
      const dates = datesByScene.get(sceneId) ?? new Set<string>();
      dates.add(rehearsal.date);
      datesByScene.set(sceneId, dates);
    }
  }

  const result = new Map<string, string[]>();
  for (const [sceneId, dates] of datesByScene) {
    const sorted = [...dates].sort();
    result.set(sceneId, sorted.map(formatRehearsalDateLabel));
  }
  return result;
}

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: 'был(а)',
  late: 'опоздал(а)',
  absent: 'отсутствовал(а)',
  substitute: 'замена',
};

export interface SceneWorkHistoryEntry {
  rehearsal: Rehearsal;
  block: ScheduleBlock;
  participants: { label: string; text: string } | null;
}

export function formatRehearsalParticipantsForHistory(
  state: AppState,
  rehearsal: Rehearsal
): { label: string; text: string } | null {
  const actorIds = rehearsal.participantOrder?.length
    ? rehearsal.participantOrder
    : rehearsal.actorIds;
  const attendance = rehearsal.attendance ?? {};
  const hasExplicitAttendance = Object.keys(attendance).length > 0;

  if (hasExplicitAttendance) {
    const parts: string[] = [];
    for (const actorId of actorIds) {
      const actor = state.actors.find((item) => item.id === actorId);
      if (!actor) continue;
      const status = attendance[actorId];
      if (!status) continue;
      if (status === 'absent' && !rehearsal.actorIds.includes(actorId)) continue;
      parts.push(
        status === 'present' ? actor.name : `${actor.name} (${attendanceLabels[status]})`
      );
    }
    return parts.length > 0 ? { label: 'Кто был', text: parts.join(', ') } : null;
  }

  const names = actorIds
    .filter((actorId) => rehearsal.actorIds.includes(actorId))
    .map((actorId) => state.actors.find((item) => item.id === actorId)?.name)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? { label: 'Участники', text: names.join(', ') } : null;
}

export function buildSceneWorkHistory(
  state: AppState,
  sceneId: string,
  limit = 4
): SceneWorkHistoryEntry[] {
  return state.rehearsals
    .filter((rehearsal) => isRehearsalPast(rehearsal))
    .flatMap((rehearsal) =>
      rehearsal.schedule
        .filter((block) => block.type === 'scene' && block.sceneId === sceneId)
        .map((block) => ({
          rehearsal,
          block,
          participants: formatRehearsalParticipantsForHistory(state, rehearsal),
        }))
    )
    .sort((a, b) => {
      const dateCmp = b.rehearsal.date.localeCompare(a.rehearsal.date);
      if (dateCmp !== 0) return dateCmp;
      return b.block.startTime.localeCompare(a.block.startTime);
    })
    .slice(0, limit);
}
