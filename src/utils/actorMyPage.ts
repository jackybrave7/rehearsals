import type { AppState, MemorizationStatus, Play, Rehearsal, Scene } from '../types';
import { getActorScenes, getActorRoleIds } from './actorProfile';
import { getExpectedActorIds } from './rehearsalInsights';
import { getScenePlayId } from './rehearsalPlays';
import { isRehearsalPast } from './rehearsalSort';
import { countMemorizationProgress, getMemorizationStatus } from './memorization';

export function getActorUpcomingRehearsals(
  state: AppState,
  actorId: string,
  theaterId?: string | null
): Rehearsal[] {
  return state.rehearsals
    .filter(
      (rehearsal) =>
        (!theaterId || rehearsal.theaterId === theaterId) &&
        !isRehearsalPast(rehearsal) &&
        getExpectedActorIds(state, rehearsal).includes(actorId)
    )
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.localeCompare(b.startTime);
    });
}

export interface ActorPlaySummary {
  play: Play;
  roleName: string;
  sceneCount: number;
  memorization: { known: number; learning: number; total: number };
  nextRehearsal: Rehearsal | null;
}

export function buildActorPlaySummaries(
  state: AppState,
  actorId: string,
  theaterId?: string | null
): ActorPlaySummary[] {
  const roleIds = getActorRoleIds(state, actorId);
  const playIds = new Set<string>();
  for (const assignment of state.castAssignments) {
    if (assignment.actorId === actorId) playIds.add(assignment.playId);
  }

  const upcoming = getActorUpcomingRehearsals(state, actorId, theaterId);
  const myScenes = getActorScenes(state, actorId);
  const actor = state.actors.find((item) => item.id === actorId);
  const memorizationMap = actor?.memorizationByScene;

  const summaries: ActorPlaySummary[] = [];

  for (const playId of playIds) {
    const play = state.plays.find((item) => item.id === playId);
    if (!play) continue;

    const roles = state.playRoles.filter(
      (role) => role.playId === playId && roleIds.has(role.id)
    );
    const roleName = roles.map((role) => role.name).join(', ') || '—';
    const playSceneIds = myScenes
      .filter((scene) => getScenePlayId(state, scene.id) === playId)
      .map((scene) => scene.id);

    const nextRehearsal =
      upcoming.find((rehearsal) =>
        rehearsal.playId === playId ||
        playSceneIds.some((sceneId) => rehearsal.sceneIds.includes(sceneId))
      ) ?? null;

    summaries.push({
      play,
      roleName,
      sceneCount: playSceneIds.length,
      memorization: countMemorizationProgress(playSceneIds, memorizationMap),
      nextRehearsal,
    });
  }

  return summaries.sort((a, b) => a.play.title.localeCompare(b.play.title, 'ru'));
}

export function formatMemorizationProgressLabel(
  progress: { known: number; learning: number; total: number }
): string {
  if (progress.total === 0) return 'нет сцен';
  if (progress.known === progress.total) return `все ${progress.total} знаю`;
  const parts: string[] = [];
  if (progress.known > 0) parts.push(`${progress.known} знаю`);
  if (progress.learning > 0) parts.push(`${progress.learning} учу`);
  const rest = progress.total - progress.known - progress.learning;
  if (rest > 0) parts.push(`${rest} не начал`);
  return parts.join(', ');
}

export function getSceneMemorizationForActor(
  actorId: string,
  sceneId: string,
  state: AppState
): MemorizationStatus {
  const actor = state.actors.find((item) => item.id === actorId);
  return getMemorizationStatus(actor?.memorizationByScene, sceneId);
}

export function groupActorScenesByPlay(
  state: AppState,
  scenes: Scene[]
): Array<{ play: Play | null; scenes: Scene[] }> {
  const order: string[] = [];
  const map = new Map<string, Scene[]>();

  for (const scene of scenes) {
    const playId = getScenePlayId(state, scene.id) ?? '';
    if (!map.has(playId)) {
      map.set(playId, []);
      order.push(playId);
    }
    map.get(playId)!.push(scene);
  }

  return order.map((playId) => ({
    play: playId ? (state.plays.find((item) => item.id === playId) ?? null) : null,
    scenes: map.get(playId) ?? [],
  }));
}
