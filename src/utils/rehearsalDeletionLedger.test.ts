import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rehearsalIdsRemovedWithoutLedger } from '../../server/stateUserScope.js';

describe('rehearsalIdsRemovedWithoutLedger', () => {
  it('blocks save without ledger when rehearsal disappears', () => {
    const editable = new Set(['t1']);
    const previous = {
      rehearsals: [{ id: 'r1', theaterId: 't1', date: '2026-11-21' }],
    } as import('../types').AppState;
    const next = { rehearsals: [] } as import('../types').AppState;
    const removed = rehearsalIdsRemovedWithoutLedger(next, previous, editable, new Set());
    assert.deepEqual(removed, ['r1']);
  });

  it('allows removal when id is in deletion ledger', () => {
    const editable = new Set(['t1']);
    const previous = {
      rehearsals: [{ id: 'r1', theaterId: 't1', date: '2026-11-21' }],
    } as import('../types').AppState;
    const next = { rehearsals: [] } as import('../types').AppState;
    const removed = rehearsalIdsRemovedWithoutLedger(next, previous, editable, new Set(['r1']));
    assert.deepEqual(removed, []);
  });
});