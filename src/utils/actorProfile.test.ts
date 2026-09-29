import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppState } from '../types';
import { getActorScenes, isActorInScene } from './actorProfile';

const PLAY_ID = 'play-kometa';
const PREMIERE_ID = 'perf-premiere';
const SECOND_ID = 'perf-second';

function kometaState(): AppState {
  return {
    theaters: [{ id: 't1', name: 'Libertad' }],
    activeTheaterId: 't1',
    actors: [
      { id: 'igor', theaterId: 't1', name: 'Игорь', status: 'active' },
      { id: 'other', theaterId: 't1', name: 'Другой', status: 'active' },
    ],
    plays: [{ id: PLAY_ID, theaterId: 't1', title: 'Комета', author: '—' }],
    activePlayId: PLAY_ID,
    selectedPerformanceByPlayId: { [PLAY_ID]: PREMIERE_ID },
    playRoles: [
      { id: 'role-igor', playId: PLAY_ID, name: 'Игорь', kind: 'character', order: 0 },
      { id: 'role-guest', playId: PLAY_ID, name: 'Гость', kind: 'character', order: 1 },
    ],
    performances: [
      { id: PREMIERE_ID, playId: PLAY_ID, name: 'Премьера', isDefault: true },
      { id: SECOND_ID, playId: PLAY_ID, name: 'Второй состав', isDefault: false },
    ],
    castAssignments: [
      {
        id: 'c1',
        playId: PLAY_ID,
        performanceId: PREMIERE_ID,
        roleId: 'role-guest',
        actorId: 'other',
      },
      {
        id: 'c2',
        playId: PLAY_ID,
        performanceId: SECOND_ID,
        roleId: 'role-guest',
        actorId: 'igor',
      },
    ],
    scenes: [
      {
        id: 'scene-3',
        playId: PLAY_ID,
        number: 3,
        title: 'Сцена 3',
        status: 'in_progress',
        roleIds: ['role-guest'],
      },
    ],
    tasks: [],
    venues: [],
    rehearsals: [],
    rehearsalActorNotes: [],
    appMeta: {},
  };
}

describe('isActorInScene / getActorScenes', () => {
  it('includes scene when actor is cast on a performance for a role in the scene', () => {
    const state = kometaState();
    assert.equal(isActorInScene(state, 'igor', state.scenes[0]), true);
    assert.deepEqual(getActorScenes(state, 'igor').map((s) => s.number), [3]);
  });

  it('excludes scene when actor roles in cast do not appear in scene.roleIds', () => {
    const state = kometaState();
    state.castAssignments = [
      {
        id: 'c3',
        playId: PLAY_ID,
        performanceId: PREMIERE_ID,
        roleId: 'role-igor',
        actorId: 'igor',
      },
    ];
    state.scenes[0].roleIds = ['role-guest'];
    assert.equal(isActorInScene(state, 'igor', state.scenes[0]), false);
    assert.deepEqual(getActorScenes(state, 'igor'), []);
  });

  it('does not treat premiere cast as in scene when only another performance has the matching role', () => {
    const state = kometaState();
    state.castAssignments = [
      {
        id: 'c1',
        playId: PLAY_ID,
        performanceId: PREMIERE_ID,
        roleId: 'role-igor',
        actorId: 'igor',
      },
      {
        id: 'c2',
        playId: PLAY_ID,
        performanceId: SECOND_ID,
        roleId: 'role-guest',
        actorId: 'igor',
      },
    ];
    state.scenes[0].roleIds = ['role-guest'];
    assert.equal(isActorInScene(state, 'igor', state.scenes[0]), true);
    state.scenes[0].roleIds = ['role-igor'];
    assert.equal(isActorInScene(state, 'igor', state.scenes[0]), true);
    state.scenes[0].roleIds = ['role-guest'];
    state.castAssignments = state.castAssignments.filter((c) => c.performanceId !== SECOND_ID);
    assert.equal(isActorInScene(state, 'igor', state.scenes[0]), false);
  });
});
