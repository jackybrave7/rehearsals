import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppState } from '../types';
import { dedupeDemoTheatersInState, findDemoTheater, isDemoTheater } from './demoTheaterIdentity';

describe('demoTheaterIdentity', () => {
  it('treats legacy «Пример:» names as demo', () => {
    assert.equal(isDemoTheater({ id: '1', name: 'Пример: Каменное сердце' }), true);
  });

  it('dedupes multiple demo theaters keeping Chaika / Демо-театр when present', () => {
    const state = {
      theaters: [
        { id: 'old', name: 'Пример: Каменное сердце' },
        { id: 'new', name: 'Демо-театр', isDemo: true },
      ],
      plays: [
        { id: 'p1', theaterId: 'old', title: 'Каменное сердце' },
        { id: 'p2', theaterId: 'new', title: 'Чайка' },
      ],
      actors: [],
      scenes: [],
      rehearsals: [],
      venues: [],
      tasks: [],
      playRoles: [],
      performances: [],
      castAssignments: [],
      activeTheaterId: 'old',
      activePlayId: 'p1',
      selectedPerformanceByPlayId: {},
      rehearsalActorNotes: [],
      appMeta: {},
    } satisfies AppState;

    const next = dedupeDemoTheatersInState(state);
    assert.equal(next.theaters.length, 1);
    assert.equal(next.theaters[0]!.id, 'new');
    assert.equal(findDemoTheater(next)?.id, 'new');
  });
});
