import { addDays, format } from 'date-fns';
import type {
  Actor,
  AppState,
  Performance,
  Play,
  Rehearsal,
  Scene,
  Theater,
  Venue,
} from '../types';
import { generateId } from '../utils/id';
import { buildStoneHeartCast, STONE_HEART_PLAY_META } from './stoneHeartCast';
import { buildStoneHeartScenes } from './stoneHeartScenes';
import { createDefaultVenue } from './seedVenue';
import { buildScheduleFromRehearsalItems } from '../utils/schedulePlan';
import { mergeActorsForSceneIds } from '../utils/rehearsalActors';
import { ACTOR_PHOTOS } from '../utils/actorPhotos';
import { STONE_HEART_ACTOR_NAMES } from './stoneHeartCast';

export const DEMO_THEATER_NAME = 'Пример: Каменное сердце';

export interface DemoInstallBundle {
  theater: Theater;
  actors: Actor[];
  play: Play;
  playRoles: AppState['playRoles'];
  performances: Performance[];
  castAssignments: AppState['castAssignments'];
  scenes: Scene[];
  venues: Venue[];
  rehearsal: Rehearsal;
}

export function buildDemoTheaterBundle(): DemoInstallBundle {
  const theaterId = generateId();
  const theater: Theater = {
    id: theaterId,
    name: DEMO_THEATER_NAME,
    isDemo: true,
    timezone: 'Europe/Moscow',
  };

  const actors: Actor[] = STONE_HEART_ACTOR_NAMES.map((name) => ({
    id: generateId(),
    theaterId,
    name,
    status: 'active',
    photoUrl: ACTOR_PHOTOS[name],
  }));

  const actorByName = Object.fromEntries(actors.map((actor) => [actor.name, actor]));

  const play: Play = {
    id: generateId(),
    theaterId,
    ...STONE_HEART_PLAY_META,
  };

  const { playRoles, performances, castAssignments: rawCast } = buildStoneHeartCast(
    play.id,
    actorByName
  );
  const defaultPerformance = performances.find((p) => p.isDefault) ?? performances[0]!;
  const performancesFiltered = [defaultPerformance];
  const castAssignments = rawCast.filter((a) => a.performanceId === defaultPerformance.id);

  const scenes = buildStoneHeartScenes(play.id, playRoles);
  const venues: Venue[] = [{ ...createDefaultVenue(), theaterId }];

  const sceneIdsForRehearsal = scenes
    .slice()
    .sort((a, b) => a.number - b.number)
    .slice(0, 4)
    .map((scene) => scene.id);

  const rehearsalDate = format(addDays(new Date(), 3), 'yyyy-MM-dd');
  const startTime = '18:00';
  const endTime = '21:00';
  const schedule = buildScheduleFromRehearsalItems(
    startTime,
    sceneIdsForRehearsal,
    [],
    scenes.filter((s) => sceneIdsForRehearsal.includes(s.id)),
    []
  );

  const rehearsalDraft: Rehearsal = {
    id: generateId(),
    theaterId,
    playId: play.id,
    date: rehearsalDate,
    startTime,
    endTime,
    location: venues[0]!.name,
    venueId: venues[0]!.id,
    notes: 'Демо-репетиция: пример плана по первым сценам «Каменного сердца».',
    sceneIds: sceneIdsForRehearsal,
    taskIds: [],
    schedule,
    actorIds: [],
    attendance: {},
    rsvp: {},
  };

  const partialState = {
    theaters: [theater],
    actors,
    plays: [play],
    playRoles,
    performances: performancesFiltered,
    castAssignments,
    scenes,
    venues,
    rehearsals: [],
    tasks: [],
    rehearsalActorNotes: [],
    activeTheaterId: theaterId,
    activePlayId: play.id,
  } as AppState;

  const actorIds = mergeActorsForSceneIds(partialState, rehearsalDraft, sceneIdsForRehearsal);

  const rehearsal: Rehearsal = {
    ...rehearsalDraft,
    actorIds,
    participantOrder: actorIds,
  };

  return {
    theater,
    actors,
    play,
    playRoles,
    performances: performancesFiltered,
    castAssignments,
    scenes,
    venues,
    rehearsal,
  };
}
