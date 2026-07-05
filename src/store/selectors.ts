import type { AppState, Performance, PlayRole, RehearsalTemplate, Scene } from '../types';
import { normalizeTask, getOverdueTasks, getTasksByPlay } from '../utils/tasks';
import { rehearsalInvolvesPlay } from '../utils/rehearsalPlays';

export function getActivePlay(state: AppState) {
  if (!state.activePlayId) return null;
  return state.plays.find((p) => p.id === state.activePlayId && p.theaterId === state.activeTheaterId) ?? null;
}

export function getActiveTheater(state: AppState) {
  if (!state.activeTheaterId) return null;
  return state.theaters.find((theater) => theater.id === state.activeTheaterId) ?? null;
}

export function getTheaterPlays(state: AppState) {
  return state.plays.filter((play) => play.theaterId === state.activeTheaterId);
}

export function getActiveTheaterPlays(state: AppState) {
  return getTheaterPlays(state).filter((play) => !play.archivedAt);
}

export function getArchivedTheaterPlays(state: AppState) {
  return getTheaterPlays(state).filter((play) => Boolean(play.archivedAt));
}

export function getTheaterTasks(state: AppState) {
  return state.tasks
    .filter((task) => task.theaterId === state.activeTheaterId)
    .map(normalizeTask);
}

export { getOverdueTasks, getTasksByPlay };

export function getTheaterVenues(state: AppState) {
  if (!state.activeTheaterId) return [];
  return state.venues.filter((venue) => venue.theaterId === state.activeTheaterId);
}

export function getTheaterRehearsals(state: AppState) {
  return state.rehearsals.filter((rehearsal) => rehearsal.theaterId === state.activeTheaterId);
}

/** Репетиции выбранной постановки (есть хотя бы одна её сцена); без playId — все репетиции театра. */
export function getPlayRehearsals(state: AppState, playId?: string | null) {
  const theaterRehearsals = getTheaterRehearsals(state);
  if (!playId) return theaterRehearsals;
  return theaterRehearsals.filter((rehearsal) => rehearsalInvolvesPlay(state, rehearsal, playId));
}

export function getRehearsalTemplates(
  state: AppState,
  theaterId: string | null | undefined = state.activeTheaterId
): RehearsalTemplate[] {
  return (state.appMeta?.rehearsalTemplates ?? []).filter(
    (template) => !theaterId || template.theaterId === theaterId
  );
}

export function getShowRehearsalWarnings(state: AppState): boolean {
  return state.appMeta?.showRehearsalWarnings !== false;
}

export function getPlayScenes(state: AppState, playId: string | null | undefined) {
  if (!playId) return [];
  return state.scenes.filter((s) => s.playId === playId);
}

export function getSceneRoles(state: AppState, scene: Scene): PlayRole[] {
  if (!scene.roleIds?.length) return [];
  return scene.roleIds
    .map((roleId) => state.playRoles.find((r) => r.id === roleId))
    .filter((role): role is PlayRole => Boolean(role));
}

export function getActiveActors(state: AppState) {
  return state.actors.filter((a) => a.theaterId === state.activeTheaterId && a.status !== 'archived');
}

export function getArchivedActors(state: AppState) {
  return state.actors.filter((a) => a.theaterId === state.activeTheaterId && a.status === 'archived');
}

export function getPlayRoles(state: AppState, playId: string, kind?: PlayRole['kind']) {
  return state.playRoles
    .filter((r) => r.playId === playId && (kind ? r.kind === kind : true))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru'));
}

export function getPlayPerformances(state: AppState, playId: string) {
  return [...state.performances.filter((p) => p.playId === playId)].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return (a.date ?? '').localeCompare(b.date ?? '');
  });
}

export function getDefaultPerformance(state: AppState, playId: string) {
  return (
    state.performances.find((p) => p.playId === playId && p.isDefault) ??
    state.performances.find((p) => p.playId === playId)
  );
}

export function getSelectedPerformance(state: AppState, playId: string) {
  const savedId = state.selectedPerformanceByPlayId?.[playId];
  if (savedId) {
    const saved = state.performances.find((p) => p.id === savedId && p.playId === playId);
    if (saved) return saved;
  }
  return getDefaultPerformance(state, playId);
}

export function getActorNamesForRoleInPerformance(
  state: AppState,
  performanceId: string,
  roleId: string
): string[] {
  return getRoleAssignmentsForPerformance(state, performanceId, roleId)
    .map((assignment) => state.actors.find((actor) => actor.id === assignment.actorId)?.name)
    .filter((name): name is string => Boolean(name));
}

export function getPerformanceAssignments(state: AppState, performanceId: string) {
  return state.castAssignments.filter((a) => a.performanceId === performanceId);
}

export function getRoleAssignmentsForPerformance(
  state: AppState,
  performanceId: string,
  roleId: string
) {
  return state.castAssignments.filter(
    (a) => a.performanceId === performanceId && a.roleId === roleId
  );
}

export function getActorAssignments(state: AppState, actorId: string) {
  return state.castAssignments.filter((a) => a.actorId === actorId);
}

export function formatActorRolesSummary(state: AppState, actorId: string): string {
  const assignments = getActorAssignments(state, actorId);
  if (assignments.length === 0) return 'Роли не назначены';

  const byPerformance = new Map<string, string[]>();
  for (const assignment of assignments) {
    const performance = state.performances.find((p) => p.id === assignment.performanceId);
    const role = state.playRoles.find((r) => r.id === assignment.roleId);
    if (!role) continue;
    const label = performance?.name ?? 'Показ';
    const roles = byPerformance.get(label) ?? [];
    roles.push(role.name);
    byPerformance.set(label, roles);
  }

  return Array.from(byPerformance.entries())
    .map(([perf, roles]) => `${perf}: ${[...new Set(roles)].join(', ')}`)
    .join(' · ');
}

export function countActorRoles(state: AppState, actorId: string): number {
  const roleIds = new Set(getActorAssignments(state, actorId).map((a) => a.roleId));
  return roleIds.size;
}

export function isActorAssignedToRole(
  state: AppState,
  performanceId: string,
  roleId: string,
  actorId: string
): boolean {
  return state.castAssignments.some(
    (a) => a.performanceId === performanceId && a.roleId === roleId && a.actorId === actorId
  );
}

export function formatPerformanceLabel(performance: Performance): string {
  if (performance.date) {
    const date = performance.date.split('-').reverse().join('.');
    return performance.startTime
      ? `${performance.name} (${date} ${performance.startTime})`
      : `${performance.name} (${date})`;
  }
  return performance.name;
}
