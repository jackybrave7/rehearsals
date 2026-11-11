import type { AppState, Play, Theater } from '../types';
import { DEMO_THEATER_NAME } from '../data/demoTheater';

/** Учебные театры: флаг isDemo или унаследованные имена до Chaika / «Демо-театр». */
export function isDemoTheater(theater: Theater): boolean {
  if (theater.isDemo) return true;
  if (theater.name === DEMO_THEATER_NAME) return true;
  if (theater.name.startsWith('Пример:')) return true;
  return false;
}

export function findDemoTheater(state: Pick<AppState, 'theaters'>): Theater | undefined {
  return state.theaters.find(isDemoTheater);
}

function demoTheaterScore(theater: Theater, plays: Play[]): number {
  let score = 0;
  if (theater.isDemo) score += 10;
  if (theater.name === DEMO_THEATER_NAME) score += 20;
  const play = plays.find((p) => p.theaterId === theater.id);
  if (play?.title === 'Чайка') score += 15;
  return score;
}

export function pickCanonicalDemoTheater(
  theaters: Theater[],
  plays: Play[]
): Theater | null {
  const demos = theaters.filter(isDemoTheater);
  if (demos.length === 0) return null;
  if (demos.length === 1) return demos[0]!;
  return [...demos].sort((a, b) => demoTheaterScore(b, plays) - demoTheaterScore(a, plays))[0]!;
}

export function removeTheaterFromState(state: AppState, theaterId: string): AppState {
  const theaters = state.theaters.filter((theater) => theater.id !== theaterId);
  const activeTheaterId =
    state.activeTheaterId === theaterId ? theaters[0]?.id ?? null : state.activeTheaterId;
  const activePlayId =
    state.activePlayId &&
    state.plays.some((play) => play.id === state.activePlayId && play.theaterId === activeTheaterId)
      ? state.activePlayId
      : state.plays.find((play) => play.theaterId === activeTheaterId)?.id ?? null;
  const removedPlayIds = new Set(
    state.plays.filter((play) => play.theaterId === theaterId).map((play) => play.id)
  );
  return {
    ...state,
    theaters,
    activeTheaterId,
    activePlayId,
    actors: state.actors.filter((actor) => actor.theaterId !== theaterId),
    plays: state.plays.filter((play) => play.theaterId !== theaterId),
    playRoles: state.playRoles.filter((role) => !removedPlayIds.has(role.playId)),
    performances: state.performances.filter((performance) => !removedPlayIds.has(performance.playId)),
    castAssignments: state.castAssignments.filter((assignment) => !removedPlayIds.has(assignment.playId)),
    scenes: state.scenes.filter((scene) => !removedPlayIds.has(scene.playId)),
    tasks: state.tasks.filter((task) => task.theaterId !== theaterId),
    venues: state.venues.filter((venue) => venue.theaterId !== theaterId),
    rehearsals: state.rehearsals.filter((rehearsal) => rehearsal.theaterId !== theaterId),
    rehearsalActorNotes: (state.rehearsalActorNotes ?? []).filter((note) => note.theaterId !== theaterId),
    appMeta: {
      ...state.appMeta,
      rehearsalTemplates: (state.appMeta?.rehearsalTemplates ?? []).filter(
        (template) => template.theaterId !== theaterId
      ),
      rehearsalSeries: (state.appMeta?.rehearsalSeries ?? []).filter(
        (series) => series.theaterId !== theaterId
      ),
    },
  };
}

/** Один учебный театр в состоянии: лишние копии после повторных tryDemo убираем. */
export function dedupeDemoTheatersInState(state: AppState): AppState {
  const canonical = pickCanonicalDemoTheater(state.theaters, state.plays);
  if (!canonical) return state;

  const extraIds = state.theaters
    .filter(isDemoTheater)
    .map((t) => t.id)
    .filter((id) => id !== canonical.id);
  if (extraIds.length === 0) return state;

  let next = state;
  for (const id of extraIds) {
    next = removeTheaterFromState(next, id);
  }
  return next;
}

export function normalizeDemoTheaterFlags(state: AppState): AppState {
  let changed = false;
  const theaters = state.theaters.map((theater) => {
    if (!isDemoTheater(theater)) return theater;
    const next = {
      ...theater,
      isDemo: true as const,
      name: theater.name.startsWith('Пример:') ? DEMO_THEATER_NAME : theater.name,
    };
    if (next.name !== theater.name || !theater.isDemo) changed = true;
    return next;
  });
  return changed ? { ...state, theaters } : state;
}
