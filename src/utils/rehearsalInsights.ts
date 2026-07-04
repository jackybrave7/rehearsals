import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { AppState, Actor, Rehearsal, Scene, Venue } from '../types';
import { getActorIdsForSceneIdsMultiPlay, resolvePerformanceIdForPlay } from './rehearsalActors';
import { getRehearsalPlayIds, getRehearsalPlayTitles } from './rehearsalPlays';
import { getScheduleEndTime, getScheduleTotalMinutes } from './schedulePlan';
import { getSceneIdsFromSchedule } from './scheduleSync';
import { timeToMinutes } from './time';
import { isRehearsalPast } from './rehearsalSort';
import { getSceneShortLabel } from './sceneLabels';
import { getUpcomingPremiere, isPremierePerformance } from './premiere';
import { isTaskOverdue } from './tasks';
import {
  getActorUnavailabilityReason,
  getUnavailableWarningId,
  isActorUnavailable,
} from './actorAvailability';

export type RehearsalWarningSeverity = 'info' | 'warn';

export interface RehearsalWarning {
  id: string;
  severity: RehearsalWarningSeverity;
  message: string;
}

export interface ExpectedAttendee {
  actor: Actor;
  hasTelegram: boolean;
  sources: string[];
}

export interface ActorScheduleConflict {
  actor: Actor;
  otherRehearsal: Rehearsal;
  otherPlayTitle: string;
}

export interface VenueScheduleConflict {
  venue: Venue;
  otherRehearsal: Rehearsal;
  otherPlayTitle: string;
}

function rehearsalsOverlap(a: Rehearsal, b: Rehearsal): boolean {
  if (a.date !== b.date) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

export function getExpectedActorIds(state: AppState, rehearsal: Rehearsal): string[] {
  const sceneIds = new Set<string>([
    ...rehearsal.sceneIds,
    ...getSceneIdsFromSchedule(rehearsal.schedule),
  ]);
  for (const block of rehearsal.schedule) {
    if (block.sceneId) sceneIds.add(block.sceneId);
  }

  const actorIds = new Set(getActorIdsForSceneIdsMultiPlay(state, [...sceneIds]));
  for (const block of rehearsal.schedule) {
    if (block.type === 'etude') {
      block.actorIds?.forEach((id) => actorIds.add(id));
    }
  }

  const taskIds = new Set(rehearsal.taskIds);
  for (const block of rehearsal.schedule) {
    if (block.taskId) taskIds.add(block.taskId);
  }
  for (const taskId of taskIds) {
    const task = state.tasks.find((item) => item.id === taskId);
    task?.assignedActorIds.forEach((id) => actorIds.add(id));
  }

  return [...actorIds].filter((id) => {
    const actor = state.actors.find((item) => item.id === id);
    return actor?.status === 'active';
  });
}

export function getExpectedAttendees(state: AppState, rehearsal: Rehearsal): ExpectedAttendee[] {
  const byActor = new Map<string, Set<string>>();

  const addSceneActors = (scene: Scene) => {
    if (!scene.roleIds?.length) return;
    const performanceId = resolvePerformanceIdForPlay(state, scene.playId);
    if (!performanceId) return;
    for (const roleId of scene.roleIds) {
      for (const assignment of state.castAssignments) {
        if (assignment.performanceId === performanceId && assignment.roleId === roleId) {
          const sources = byActor.get(assignment.actorId) ?? new Set<string>();
          sources.add(getSceneShortLabel(scene));
          byActor.set(assignment.actorId, sources);
        }
      }
    }
  };

  for (const block of rehearsal.schedule) {
    if (block.sceneId) {
      const scene = state.scenes.find((item) => item.id === block.sceneId);
      if (scene) addSceneActors(scene);
    }
    if (block.type === 'etude') {
      block.actorIds?.forEach((actorId) => {
        const sources = byActor.get(actorId) ?? new Set<string>();
        sources.add(block.title || 'Этюд');
        byActor.set(actorId, sources);
      });
    }
    if (block.taskId) {
      const task = state.tasks.find((item) => item.id === block.taskId);
      task?.assignedActorIds.forEach((actorId) => {
        const sources = byActor.get(actorId) ?? new Set<string>();
        sources.add(task.title);
        byActor.set(actorId, sources);
      });
    }
  }

  for (const sceneId of rehearsal.sceneIds) {
    const scene = state.scenes.find((item) => item.id === sceneId);
    if (scene) addSceneActors(scene);
  }

  return [...byActor.entries()]
    .map(([actorId, sources]) => {
      const actor = state.actors.find((item) => item.id === actorId);
      if (!actor) return null;
      return {
        actor,
        hasTelegram: Boolean(actor.telegramUsername?.replace(/^@+/, '').trim()),
        sources: [...sources],
      };
    })
    .filter((item): item is ExpectedAttendee => Boolean(item))
    .sort((a, b) => a.actor.name.localeCompare(b.actor.name, 'ru'));
}

function getLastRehearsalDateForScene(
  state: AppState,
  sceneId: string,
  excludeRehearsalId?: string
): string | null {
  let latest: string | null = null;
  for (const rehearsal of state.rehearsals) {
    if (excludeRehearsalId && rehearsal.id === excludeRehearsalId) continue;
    if (!isRehearsalPast(rehearsal)) continue;
    const hasScene =
      rehearsal.sceneIds.includes(sceneId) ||
      rehearsal.schedule.some((block) => block.sceneId === sceneId);
    if (!hasScene) continue;
    if (!latest || rehearsal.date > latest) latest = rehearsal.date;
  }
  return latest;
}

export function getRehearsalWarnings(state: AppState, rehearsal: Rehearsal): RehearsalWarning[] {
  const warnings: RehearsalWarning[] = [];
  const expected = getExpectedAttendees(state, rehearsal);

  if (rehearsal.schedule.length === 0) {
    warnings.push({
      id: 'empty-plan',
      severity: 'warn',
      message: 'План по времени пуст — участникам нечего готовить.',
    });
  } else {
    const planEnd = getScheduleEndTime(rehearsal.schedule, rehearsal.startTime);
    if (timeToMinutes(planEnd) > timeToMinutes(rehearsal.endTime)) {
      warnings.push({
        id: 'plan-overflow',
        severity: 'warn',
        message: `План (${planEnd}) выходит за окно репетиции до ${rehearsal.endTime}.`,
      });
    }
    if (getScheduleTotalMinutes(rehearsal.schedule) === 0) {
      warnings.push({
        id: 'zero-duration',
        severity: 'warn',
        message: 'В плане нет блоков с длительностью.',
      });
    }
  }

  const withoutTelegram = expected.filter((item) => !item.hasTelegram);
  if (withoutTelegram.length > 0) {
    warnings.push({
      id: 'no-telegram',
      severity: 'warn',
      message: `${withoutTelegram.length} из ${expected.length} ожидаемых участников без Telegram: ${withoutTelegram
        .map((item) => item.actor.name.split(' ')[0])
        .join(', ')}.`,
    });
  }

  const staleDays = state.appMeta?.staleSceneDays ?? 21;
  const rehearsalScenes = new Map<string, Scene>();
  for (const sceneId of getSceneIdsFromSchedule(rehearsal.schedule)) {
    const scene = state.scenes.find((item) => item.id === sceneId);
    if (scene?.status === 'in_progress') rehearsalScenes.set(sceneId, scene);
  }
  for (const sceneId of rehearsal.sceneIds) {
    const scene = state.scenes.find((item) => item.id === sceneId);
    if (scene?.status === 'in_progress') rehearsalScenes.set(sceneId, scene);
  }

  for (const scene of rehearsalScenes.values()) {
    const lastDate = getLastRehearsalDateForScene(state, scene.id, rehearsal.id);
    const daysSince = lastDate
      ? differenceInCalendarDays(parseISO(rehearsal.date), parseISO(lastDate))
      : null;
    if (lastDate === null || (daysSince !== null && daysSince > staleDays)) {
      warnings.push({
        id: `stale-scene-${scene.id}`,
        severity: 'info',
        message: `«${getSceneShortLabel(scene)}» в работе, но не репетировалась ${lastDate ? `${daysSince} дн.` : 'ни разу'}.`,
      });
    }
  }

  const openTasks = state.tasks.filter(
    (task) =>
      !task.completed &&
      (task.rehearsalId === rehearsal.id ||
        rehearsal.taskIds.includes(task.id) ||
        rehearsal.schedule.some((block) => block.taskId === task.id))
  );
  if (openTasks.length > 0) {
    const overdueTitles = openTasks.filter((task) => isTaskOverdue(task)).map((task) => task.title);
    const base = openTasks.map((task) => task.title).join(', ');
    warnings.push({
      id: 'open-tasks',
      severity: 'info',
      message:
        overdueTitles.length > 0
          ? `Открытые задачи к репетиции: ${base}. Просрочено: ${overdueTitles.join(', ')}.`
          : `Открытые задачи к репетиции: ${base}.`,
    });
  }

  for (const playId of getRehearsalPlayIds(state, rehearsal)) {
    const premiere = getUpcomingPremiere(state, playId);
    if (!premiere || premiere.daysLeft > 14) continue;
    const notReady = state.scenes.filter(
      (scene) => scene.playId === playId && scene.status !== 'ready'
    );
    if (notReady.length === 0) continue;
    const playTitle = state.plays.find((play) => play.id === playId)?.title ?? 'постановка';
    const deadlineLabel = isPremierePerformance(premiere.performance)
      ? `до премьеры ${premiere.daysLeft} дн.`
      : `до показа «${premiere.performance.name}» ${premiere.daysLeft} дн.`;
    warnings.push({
      id: `premiere-not-ready-${playId}`,
      severity: 'info',
      message: `«${playTitle}»: ${deadlineLabel}, сцены ещё не готовы: ${notReady
        .slice(0, 5)
        .map((scene) => getSceneShortLabel(scene))
        .join(', ')}${notReady.length > 5 ? '…' : ''}.`,
    });
  }

  for (const actorId of getExpectedActorIds(state, rehearsal)) {
    const actor = state.actors.find((item) => item.id === actorId);
    if (!actor || !isActorUnavailable(actor, rehearsal.date, {
      startTime: rehearsal.startTime,
      endTime: rehearsal.endTime,
    })) continue;
    const reason = getActorUnavailabilityReason(actor, rehearsal.date, {
      startTime: rehearsal.startTime,
      endTime: rehearsal.endTime,
    });
    warnings.push({
      id: getUnavailableWarningId(actorId),
      severity: 'warn',
      message: `Ожидается ${actor.name}, но он(а) недоступен(а) на эту дату${reason ? `: ${reason}` : ''}.`,
    });
  }

  for (const attendee of expected) {
    if (rehearsal.rsvp?.[attendee.actor.id] !== 'declined') continue;
    const sceneLabels = attendee.sources.filter((source) => source !== 'Этюд');
    if (sceneLabels.length === 0) continue;
    const firstName = attendee.actor.name.split(' ')[0];
    warnings.push({
      id: `rsvp-declined-${attendee.actor.id}`,
      severity: 'warn',
      message: `${firstName} не придёт — в плане сцены: ${sceneLabels.join(', ')}. Заменить в плане?`,
    });
  }

  return warnings;
}

export function getActorScheduleConflicts(
  state: AppState,
  rehearsal: Rehearsal
): ActorScheduleConflict[] {
  const expectedIds = getExpectedActorIds(state, rehearsal);
  const conflicts: ActorScheduleConflict[] = [];

  for (const other of state.rehearsals) {
    if (other.id === rehearsal.id) continue;
    if (rehearsal.theaterId && other.theaterId && other.theaterId !== rehearsal.theaterId) continue;
    if (!rehearsalsOverlap(rehearsal, other)) continue;

    const otherExpected = new Set(getExpectedActorIds(state, other));
    const otherTitles = getRehearsalPlayTitles(state, other);
    const otherPlayTitle = otherTitles.length > 0 ? otherTitles.join(', ') : 'другой репетиции';
    for (const actorId of expectedIds) {
      if (!otherExpected.has(actorId)) continue;
      const actor = state.actors.find((item) => item.id === actorId);
      if (!actor) continue;
      conflicts.push({ actor, otherRehearsal: other, otherPlayTitle });
    }
  }

  return conflicts.sort((a, b) => a.actor.name.localeCompare(b.actor.name, 'ru'));
}

export function getVenueScheduleConflicts(
  state: AppState,
  rehearsal: Rehearsal
): VenueScheduleConflict[] {
  if (!rehearsal.venueId) return [];

  const venue = state.venues.find((item) => item.id === rehearsal.venueId);
  if (!venue) return [];

  const conflicts: VenueScheduleConflict[] = [];

  for (const other of state.rehearsals) {
    if (other.id === rehearsal.id) continue;
    if (other.venueId !== rehearsal.venueId) continue;
    if (rehearsal.theaterId && other.theaterId && other.theaterId !== rehearsal.theaterId) continue;
    if (!rehearsalsOverlap(rehearsal, other)) continue;

    const otherTitles = getRehearsalPlayTitles(state, other);
    const otherPlayTitle = otherTitles.length > 0 ? otherTitles.join(', ') : 'другой репетиции';
    conflicts.push({ venue, otherRehearsal: other, otherPlayTitle });
  }

  return conflicts.sort((a, b) =>
    a.otherRehearsal.startTime.localeCompare(b.otherRehearsal.startTime)
  );
}

export function getConflictWarningId(actorId: string, otherRehearsalId: string): string {
  return `conflict:${actorId}:${otherRehearsalId}`;
}

export function getVenueConflictWarningId(venueId: string, otherRehearsalId: string): string {
  return `venue-conflict:${venueId}:${otherRehearsalId}`;
}

export function filterVisibleRehearsalWarnings(
  warnings: RehearsalWarning[],
  conflicts: ActorScheduleConflict[],
  venueConflicts: VenueScheduleConflict[],
  dismissedIds: string[] | undefined
): {
  warnings: RehearsalWarning[];
  conflicts: ActorScheduleConflict[];
  venueConflicts: VenueScheduleConflict[];
} {
  const dismissed = new Set(dismissedIds ?? []);
  return {
    warnings: warnings.filter((warning) => !dismissed.has(warning.id)),
    conflicts: conflicts.filter(
      (conflict) =>
        !dismissed.has(getConflictWarningId(conflict.actor.id, conflict.otherRehearsal.id))
    ),
    venueConflicts: venueConflicts.filter(
      (conflict) =>
        !dismissed.has(getVenueConflictWarningId(conflict.venue.id, conflict.otherRehearsal.id))
    ),
  };
}

export function dismissRehearsalWarning(rehearsal: Rehearsal, warningId: string): Rehearsal {
  const dismissed = rehearsal.dismissedWarningIds ?? [];
  if (dismissed.includes(warningId)) return rehearsal;
  return { ...rehearsal, dismissedWarningIds: [...dismissed, warningId] };
}
