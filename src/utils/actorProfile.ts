import type { AppState, Actor, Play, PlayRole, Rehearsal, Scene } from '../types';
import type { AuthSessionPayload } from '../types/auth';

export function normalizeActorEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function normalizeActorName(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function filterActorsInTheater(state: AppState, theaterId?: string | null): Actor[] {
  return state.actors.filter(
    (actor) => actor.status === 'active' && (!theaterId || actor.theaterId === theaterId)
  );
}

function pickActorByName(candidates: Actor[], state: AppState): Actor | undefined {
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return undefined;

  const withCast = candidates.filter((actor) =>
    state.castAssignments.some((assignment) => assignment.actorId === actor.id)
  );
  if (withCast.length === 1) return withCast[0];

  const withoutEmail = candidates.filter((actor) => !normalizeActorEmail(actor.email));
  if (withoutEmail.length === 1) return withoutEmail[0];

  return undefined;
}

export function findLinkedActor(
  state: AppState,
  userEmail: string | null | undefined,
  theaterId?: string | null,
  userName?: string | null
): Actor | undefined {
  const normalizedEmail = normalizeActorEmail(userEmail);
  const candidates = filterActorsInTheater(state, theaterId);

  if (normalizedEmail) {
    const byEmail = candidates.filter(
      (actor) => normalizeActorEmail(actor.email) === normalizedEmail
    );
    if (byEmail.length === 1) return byEmail[0];
    if (byEmail.length > 1) return pickActorByName(byEmail, state);
  }

  const normalizedName = normalizeActorName(userName);
  if (!normalizedName) return undefined;

  const byName = candidates.filter((actor) => normalizeActorName(actor.name) === normalizedName);
  return pickActorByName(byName, state);
}

/** Театр, где у пользователя уже есть карточка участника (для подсказки переключения). */
export function findTheaterWithLinkedActor(
  state: AppState,
  userEmail: string | null | undefined,
  userName?: string | null
): { theaterId: string; theaterName: string } | null {
  const actor = findLinkedActor(state, userEmail, undefined, userName);
  if (!actor?.theaterId) return null;
  const theater = state.theaters.find((entry) => entry.id === actor.theaterId);
  if (!theater) return null;
  return { theaterId: theater.id, theaterName: theater.name };
}

export function getActorTheaterIds(session: AuthSessionPayload): string[] {
  return session.theaters.filter((entry) => entry.role === 'actor').map((entry) => entry.theaterId);
}

export function getActorRoleIds(state: AppState, actorId: string): Set<string> {
  const roleIds = new Set<string>();
  for (const assignment of state.castAssignments) {
    if (assignment.actorId === actorId) roleIds.add(assignment.roleId);
  }
  return roleIds;
}

export interface ActorCastEntry {
  play: Play;
  role: PlayRole;
}

export function getActorCastEntries(state: AppState, actorId: string): ActorCastEntry[] {
  const entries: ActorCastEntry[] = [];
  const seen = new Set<string>();

  for (const assignment of state.castAssignments) {
    if (assignment.actorId !== actorId) continue;
    const key = `${assignment.playId}:${assignment.roleId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const play = state.plays.find((item) => item.id === assignment.playId);
    const role = state.playRoles.find((item) => item.id === assignment.roleId);
    if (!play || !role) continue;
    entries.push({ play, role });
  }

  return entries.sort((a, b) => a.play.title.localeCompare(b.play.title, 'ru'));
}

export function getActorScenes(state: AppState, actorId: string): AppState['scenes'] {
  const roleIds = getActorRoleIds(state, actorId);
  if (roleIds.size === 0) return [];

  return state.scenes.filter((scene) => scene.roleIds?.some((roleId) => roleIds.has(roleId)));
}

export function getActorScenesInRehearsal(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string
): Scene[] {
  const mySceneIds = new Set(getActorScenes(state, actorId).map((scene) => scene.id));
  const inPlan = new Set<string>();

  for (const sceneId of rehearsal.sceneIds) {
    if (mySceneIds.has(sceneId)) inPlan.add(sceneId);
  }
  for (const block of rehearsal.schedule) {
    if (block.sceneId && mySceneIds.has(block.sceneId)) inPlan.add(block.sceneId);
  }

  return state.scenes
    .filter((scene) => inPlan.has(scene.id))
    .sort((a, b) => a.number - b.number);
}

export function getActorSceneNumbersInRehearsal(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string
): number[] {
  return getActorScenesInRehearsal(state, rehearsal, actorId).map((scene) => scene.number);
}
