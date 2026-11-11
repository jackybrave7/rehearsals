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
import { createDefaultVenue } from './seedVenue';
import { buildScheduleFromRehearsalItems } from '../utils/schedulePlan';
import { mergeActorsForSceneIds } from '../utils/rehearsalActors';
import {
  buildDemoChaikaActors,
  buildDemoChaikaCast,
  buildDemoChaikaScenes,
  demoChaikaRehearsalSceneIds,
  DEMO_CHAIKA_PLAY_META,
} from './demoChaika';

export const DEMO_THEATER_NAME = 'Пример: Чайка (демо)';

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

  const actors = buildDemoChaikaActors(theaterId);
  const actorByName = Object.fromEntries(actors.map((actor) => [actor.name, actor]));

  const play: Play = {
    id: generateId(),
    theaterId,
    ...DEMO_CHAIKA_PLAY_META,
  };

  const { playRoles, performances, castAssignments } = buildDemoChaikaCast(play.id, actorByName);
  const scenes = buildDemoChaikaScenes(play.id, playRoles);
  const venues: Venue[] = [
    {
      ...createDefaultVenue(),
      theaterId,
      name: 'Зал примера (демо)',
      address: 'Учебная площадка — адрес можно заменить своим',
    },
  ];

  const sceneIdsForRehearsal = demoChaikaRehearsalSceneIds(scenes);

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
    notes:
      'Демо-репетиция: план по первым сценам 1-го акта «Чайки» (адаптация разобрана по сценам, участники вымышленные).',
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
    performances,
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
    performances,
    castAssignments,
    scenes,
    venues,
    rehearsal,
  };
}
