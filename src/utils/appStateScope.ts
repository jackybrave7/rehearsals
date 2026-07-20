import type { AppState, ScheduleBlock } from '../types';
import { getSceneIdsFromSchedule } from './scheduleSync';
import { scoreAppState } from './appStateScore';

export function createEmptyAppState(appMeta: AppState['appMeta'] = {}): AppState {
  return {
    theaters: [],
    activeTheaterId: null,
    actors: [],
    plays: [],
    activePlayId: null,
    selectedPerformanceByPlayId: {},
    playRoles: [],
    performances: [],
    castAssignments: [],
    scenes: [],
    tasks: [],
    venues: [],
    rehearsals: [],
    rehearsalActorNotes: [],
    appMeta,
  };
}

export function isScopedAppStateEmpty(state: AppState): boolean {
  return (
    state.theaters.length === 0 &&
    state.actors.length === 0 &&
    state.plays.length === 0 &&
    state.scenes.length === 0 &&
    state.tasks.length === 0 &&
    state.rehearsals.length === 0 &&
    state.venues.length === 0 &&
    state.playRoles.length === 0 &&
    state.performances.length === 0 &&
    state.castAssignments.length === 0
  );
}

export function filterAppStateByTheaterIds(state: AppState, theaterIds: Set<string>): AppState {
  if (theaterIds.size === 0) {
    return {
      theaters: [],
      activeTheaterId: null,
      actors: [],
      plays: [],
      activePlayId: null,
      selectedPerformanceByPlayId: {},
      playRoles: [],
      performances: [],
      castAssignments: [],
      scenes: [],
      tasks: [],
      venues: [],
      rehearsals: [],
      rehearsalActorNotes: [],
      appMeta: state.appMeta,
    };
  }

  const playIds = new Set(
    state.plays.filter((play) => play.theaterId && theaterIds.has(play.theaterId)).map((play) => play.id)
  );

  const activeTheaterId =
    state.activeTheaterId && theaterIds.has(state.activeTheaterId) ? state.activeTheaterId : null;
  const activePlayId =
    state.activePlayId && playIds.has(state.activePlayId) ? state.activePlayId : null;

  return {
    theaters: state.theaters.filter((theater) => theaterIds.has(theater.id)),
    activeTheaterId,
    actors: state.actors.filter((actor) => actor.theaterId && theaterIds.has(actor.theaterId)),
    plays: state.plays.filter((play) => play.theaterId && theaterIds.has(play.theaterId)),
    activePlayId,
    selectedPerformanceByPlayId: Object.fromEntries(
      Object.entries(state.selectedPerformanceByPlayId ?? {}).filter(([playId]) => playIds.has(playId))
    ),
    playRoles: state.playRoles.filter((role) => playIds.has(role.playId)),
    performances: state.performances.filter((performance) => playIds.has(performance.playId)),
    castAssignments: state.castAssignments.filter((assignment) => playIds.has(assignment.playId)),
    scenes: state.scenes.filter((scene) => playIds.has(scene.playId)),
    tasks: state.tasks.filter((task) => task.theaterId && theaterIds.has(task.theaterId)),
    venues: state.venues.filter((venue) => venue.theaterId && theaterIds.has(venue.theaterId)),
    rehearsals: state.rehearsals
      .filter((rehearsal) => rehearsal.theaterId && theaterIds.has(rehearsal.theaterId))
      .map((rehearsal) => ({ ...rehearsal, schedule: rehearsal.schedule ?? [] })),
    rehearsalActorNotes: (state.rehearsalActorNotes ?? []).filter(
      (note) => note.theaterId && theaterIds.has(note.theaterId)
    ),
    appMeta: state.appMeta,
  };
}

/** Берёт самый полный план по каждой репетиции из всех источников (SQLite, localStorage, бэкап). */
export function mergeRehearsalSchedulesFromSources(
  base: AppState,
  ...sources: Array<AppState | null | undefined>
): AppState {
  const bestScheduleByRehearsalId = new Map<string, ScheduleBlock[]>();

  for (const source of [base, ...sources]) {
    if (!source) continue;
    for (const rehearsal of source.rehearsals) {
      const schedule = rehearsal.schedule ?? [];
      const current = bestScheduleByRehearsalId.get(rehearsal.id);
      if (!current || schedule.length > current.length) {
        bestScheduleByRehearsalId.set(rehearsal.id, schedule);
      }
    }
  }

  let changed = false;
  const rehearsals = base.rehearsals.map((rehearsal) => {
    const schedule = bestScheduleByRehearsalId.get(rehearsal.id);
    if (!schedule || schedule.length <= (rehearsal.schedule?.length ?? 0)) {
      return rehearsal;
    }
    changed = true;
    const sceneIds =
      rehearsal.sceneIds.length > 0 ? rehearsal.sceneIds : getSceneIdsFromSchedule(schedule);
    return { ...rehearsal, schedule, sceneIds };
  });

  return changed ? { ...base, rehearsals } : base;
}

export function pickAccessibleAppState(
  accessibleTheaterIds: Set<string>,
  remote: AppState | null,
  local: AppState | null,
  backup: AppState | null
): AppState | null {
  const filter = (state: AppState | null) =>
    state ? filterAppStateByTheaterIds(state, accessibleTheaterIds) : null;

  const filteredRemote = filter(remote);
  const filteredLocal = filter(local);
  const filteredBackup = filter(backup);

  let picked: AppState | null = null;

  if (filteredRemote && !isScopedAppStateEmpty(filteredRemote)) {
    picked = filteredRemote;
  } else {
    let best: AppState | null = null;
    let bestScore = -1;
    for (const candidate of [filteredLocal, filteredBackup]) {
      if (!candidate || isScopedAppStateEmpty(candidate)) continue;
      const score = scoreAppState(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    picked = best;
  }

  if (!picked) return null;

  return mergeRehearsalSchedulesFromSources(
    picked,
    filteredRemote,
    filteredLocal,
    filteredBackup
  );
}
