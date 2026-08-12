import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppState, Rehearsal } from '../types';
import { getActorScheduleConflicts, getExpectedActorIds } from './rehearsalInsights';

const PLAY_ID = 'play-groza';
const PERFORMANCE_ID = 'perf-1';

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    theaters: [{ id: 'theater-1', name: 'Театр' }],
    activeTheaterId: 'theater-1',
    actors: [
      { id: 'actor-lead', theaterId: 'theater-1', name: 'Анна Ветрова', status: 'active' },
      { id: 'actor-tech', theaterId: 'theater-1', name: 'Технарь Пультов', status: 'active' },
      { id: 'actor-archived', theaterId: 'theater-1', name: 'Ушедший', status: 'archived' },
    ],
    plays: [{ id: PLAY_ID, theaterId: 'theater-1', title: 'Гроза', author: 'Островский' }],
    activePlayId: PLAY_ID,
    selectedPerformanceByPlayId: {},
    playRoles: [
      { id: 'role-katerina', playId: PLAY_ID, name: 'Катерина', kind: 'character', order: 0 },
    ],
    performances: [
      { id: PERFORMANCE_ID, playId: PLAY_ID, name: 'Премьера', isDefault: true },
    ],
    castAssignments: [
      {
        id: 'cast-1',
        playId: PLAY_ID,
        performanceId: PERFORMANCE_ID,
        roleId: 'role-katerina',
        actorId: 'actor-lead',
      },
    ],
    scenes: [
      {
        id: 'scene-1',
        playId: PLAY_ID,
        number: 1,
        title: 'Бульвар',
        status: 'in_progress',
        roleIds: ['role-katerina'],
      },
    ],
    tasks: [],
    venues: [],
    rehearsals: [],
    rehearsalActorNotes: [],
    appMeta: {},
    ...overrides,
  };
}

function rehearsal(overrides: Partial<Rehearsal> & Pick<Rehearsal, 'id'>): Rehearsal {
  return {
    theaterId: 'theater-1',
    playId: PLAY_ID,
    date: '2026-09-01',
    startTime: '18:00',
    endTime: '21:00',
    sceneIds: [],
    taskIds: [],
    schedule: [],
    actorIds: [],
    attendance: {},
    ...overrides,
  };
}

describe('getExpectedActorIds', () => {
  it('includes actors derived from scene casting', () => {
    const state = baseState();
    const expected = getExpectedActorIds(state, rehearsal({ id: 'r1', sceneIds: ['scene-1'] }));
    assert.deepEqual(expected, ['actor-lead']);
  });

  it('includes manually added participants who are in no scene', () => {
    const state = baseState();
    const expected = getExpectedActorIds(
      state,
      rehearsal({ id: 'r1', sceneIds: ['scene-1'], actorIds: ['actor-tech'] })
    );
    assert.deepEqual([...expected].sort(), ['actor-lead', 'actor-tech']);
  });

  it('does not duplicate an actor present both in a scene and in actorIds', () => {
    const state = baseState();
    const expected = getExpectedActorIds(
      state,
      rehearsal({ id: 'r1', sceneIds: ['scene-1'], actorIds: ['actor-lead'] })
    );
    assert.deepEqual(expected, ['actor-lead']);
  });

  it('skips archived actors even when added manually', () => {
    const state = baseState();
    const expected = getExpectedActorIds(
      state,
      rehearsal({ id: 'r1', actorIds: ['actor-archived'] })
    );
    assert.deepEqual(expected, []);
  });
});

describe('getActorScheduleConflicts', () => {
  it('reports a manually added participant double-booked across two productions', () => {
    const otherPlayId = 'play-chaika';
    const overlapping = rehearsal({
      id: 'r-chaika',
      playId: otherPlayId,
      startTime: '19:00',
      endTime: '22:00',
      actorIds: ['actor-tech'],
    });
    const state = baseState({
      plays: [
        { id: PLAY_ID, theaterId: 'theater-1', title: 'Гроза', author: 'Островский' },
        { id: otherPlayId, theaterId: 'theater-1', title: 'Чайка', author: 'Чехов' },
      ],
      rehearsals: [overlapping],
    });

    const conflicts = getActorScheduleConflicts(
      state,
      rehearsal({ id: 'r-groza', actorIds: ['actor-tech'] })
    );

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].actor.id, 'actor-tech');
    assert.equal(conflicts[0].otherPlayTitle, 'Чайка');
  });

  it('stays silent when the rehearsals do not overlap in time', () => {
    const state = baseState({
      rehearsals: [
        rehearsal({ id: 'r-late', startTime: '21:00', endTime: '23:00', actorIds: ['actor-tech'] }),
      ],
    });

    const conflicts = getActorScheduleConflicts(
      state,
      rehearsal({ id: 'r-early', actorIds: ['actor-tech'] })
    );

    assert.deepEqual(conflicts, []);
  });
});
