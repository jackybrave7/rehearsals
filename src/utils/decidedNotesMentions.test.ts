import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppState } from '../types';
import { formatDecidedNotesLineForDecisionsExport, formatMention } from './decidedNotesMentions';

const state = {
  theaters: [{ id: 'th1', name: 'Театр' }],
  activeTheaterId: 'th1',
  actors: [
    { id: 'actor-1', theaterId: 'th1', name: 'Юлия Масохина', status: 'active', telegramUsername: 'yulia_pertseptsia' },
    { id: 'actor-2', theaterId: 'th1', name: 'Александр Ерахтин', status: 'active', telegramUsername: 'maestro2801' },
  ],
  plays: [{ id: 'play-1', theaterId: 'th1', title: 'Каменное сердце', author: 'Автор' }],
  playRoles: [
    { id: 'role-barbara', playId: 'play-1', name: 'Барбара Мунк', kind: 'character', order: 1 },
    { id: 'role-wanderer', playId: 'play-1', name: 'Путник', kind: 'character', order: 2 },
  ],
  performances: [{ id: 'perf-1', playId: 'play-1', name: 'Основной', isDefault: true }],
  castAssignments: [
    { id: 'cast-1', playId: 'play-1', performanceId: 'perf-1', roleId: 'role-barbara', actorId: 'actor-1' },
    { id: 'cast-2', playId: 'play-1', performanceId: 'perf-1', roleId: 'role-wanderer', actorId: 'actor-2' },
  ],
  scenes: [],
  tasks: [],
  venues: [],
  rehearsals: [
    {
      id: 'reh-1',
      theaterId: 'th1',
      date: '2026-10-21',
      startTime: '18:00',
      endTime: '21:00',
      playId: 'play-1',
      performanceId: 'perf-1',
      sceneIds: [],
      taskIds: [],
      schedule: [],
      actorIds: [],
    },
  ],
  rehearsalActorNotes: [],
  appMeta: {},
} satisfies AppState;

const rehearsal = state.rehearsals[0]!;

describe('formatDecidedNotesLineForDecisionsExport', () => {
  it('formats role mention without leading @', () => {
    const line = `${formatMention('Барбара Мунк', 'role', 'role-barbara')} такое решение`;
    const plain = formatDecidedNotesLineForDecisionsExport(state, rehearsal, line);
    assert.equal(plain, 'Барбара Мунк — Юлия Масохина @yulia_pertseptsia такое решение');
  });

  it('uses role name bold segment in html', () => {
    const line = formatMention('Путник', 'role', 'role-wanderer');
    const html = formatDecidedNotesLineForDecisionsExport(state, rehearsal, line, undefined, true);
    assert.match(html, /^<b>Путник<\/b> — Александр Ерахтин/);
    assert.match(html, /t\.me\/maestro2801/);
  });
});
