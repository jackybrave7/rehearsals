import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ScheduleBlock } from '../types';
import { formatMention } from './decidedNotesMentions';
import {
  buildRehearsalSummaryFromDecidedNotes,
  countScheduleBlocksWithDecidedNotes,
  getRehearsalExportNoteSections,
} from './rehearsalDecidedNotesSummary';
import type { Rehearsal } from '../types';

function block(partial: Partial<ScheduleBlock> & Pick<ScheduleBlock, 'id' | 'title'>): ScheduleBlock {
  return {
    startTime: '18:00',
    durationMinutes: 10,
    type: 'scene',
    ...partial,
  };
}

describe('buildRehearsalSummaryFromDecidedNotes', () => {
  it('skips blocks without decided notes', () => {
    const schedule = [
      block({ id: '1', title: 'Сцена 1', decidedNotes: '  ' }),
      block({ id: '2', title: 'Сцена 2' }),
    ];
    assert.equal(buildRehearsalSummaryFromDecidedNotes(schedule), '');
    assert.equal(countScheduleBlocksWithDecidedNotes(schedule), 0);
  });

  it('formats blocks in schedule order with readable mentions', () => {
    const schedule = [
      block({
        id: '1',
        startTime: '18:00',
        title: 'Сцена 0.',
        decidedNotes: `${formatMention('Женщина с биноклем', 'role', 'role-1')} подождать`,
      }),
      block({ id: '2', startTime: '18:10', title: 'Перерыв' }),
      block({
        id: '3',
        startTime: '18:15',
        title: 'Сцена 1',
        decidedNotes: 'Ускорить темп\nПауза длиннее',
      }),
    ];

    const summary = buildRehearsalSummaryFromDecidedNotes(schedule);
    assert.match(summary, /^18:00 · Сцена 0\.\n@Женщина с биноклем подождать/);
    assert.match(summary, /18:15 · Сцена 1\nУскорить темп\nПауза длиннее/);
    assert.equal(countScheduleBlocksWithDecidedNotes(schedule), 2);
  });
});

describe('getRehearsalExportNoteSections', () => {
  it('returns empty when only block decisions exist (they go to Telegram decisions)', () => {
    const rehearsal = {
      schedule: [block({ id: '1', title: 'Сцена 1', decidedNotes: 'Пауза' })],
    } as Rehearsal;
    assert.equal(getRehearsalExportNoteSections(rehearsal).length, 0);
  });

  it('returns manual rehearsal notes only', () => {
    const rehearsal = {
      notes: 'Общий итог',
      schedule: [block({ id: '1', title: 'Сцена 1', decidedNotes: 'Пауза' })],
    } as Rehearsal;

    const sections = getRehearsalExportNoteSections(rehearsal);
    assert.equal(sections.length, 1);
    assert.equal(sections[0]?.title, '📝 ЗАМЕТКИ');
    assert.equal(sections[0]?.body, 'Общий итог');
  });
});
