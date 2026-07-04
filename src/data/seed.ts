import type { Actor, AppState, Play, Theater } from '../types';
import { generateId } from '../utils/id';
import { ACTOR_PHOTOS } from '../utils/actorPhotos';
import {
  STONE_HEART_ACTOR_NAMES,
  STONE_HEART_PLAY_META,
  buildStoneHeartCast,
} from './stoneHeartCast';
import { buildStoneHeartScenes } from './stoneHeartScenes';
import { createDefaultVenue } from './seedVenue';

export { createDefaultVenue, DEFAULT_VENUE_ID } from './seedVenue';

function createActor(name: string, theaterId: string): Actor {
  return {
    id: generateId(),
    theaterId,
    name,
    status: 'active',
    photoUrl: ACTOR_PHOTOS[name],
  };
}

export function createSeedState(): AppState {
  const theater: Theater = {
    id: generateId(),
    name: 'Каменное сердце',
  };
  const play: Play = {
    id: generateId(),
    theaterId: theater.id,
    ...STONE_HEART_PLAY_META,
  };

  const actors = STONE_HEART_ACTOR_NAMES.map((name) => createActor(name, theater.id));
  const actorByName = Object.fromEntries(actors.map((a) => [a.name, a]));
  const { playRoles, performances, castAssignments } = buildStoneHeartCast(play.id, actorByName);
  const scenes = buildStoneHeartScenes(play.id, playRoles);

  return {
    theaters: [theater],
    activeTheaterId: theater.id,
    actors,
    plays: [play],
    activePlayId: play.id,
    playRoles,
    performances,
    castAssignments,
    scenes,
    tasks: [],
    venues: [{ ...createDefaultVenue(), theaterId: theater.id }],
    rehearsals: [],
    rehearsalActorNotes: [],
  };
}
