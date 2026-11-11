import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Scene } from '../types';
import { mergeMissingScenesFromImport } from './scriptDocument';

describe('mergeMissingScenesFromImport act numbering', () => {
  it('prefixes act and uses sequential numbers when «Сцена 1» repeats', () => {
    const anchors = [
      { type: 'heading' as const, id: 'a1', text: 'Действие первое', index: 0 },
      { type: 'heading' as const, id: 's1', text: 'Сцена 1 (Медведенко, Маша)', index: 1 },
      { type: 'heading' as const, id: 's2', text: 'Сцена 2 (Треплев, Нина)', index: 2 },
      { type: 'heading' as const, id: 'a2', text: 'Действие второе', index: 3 },
      { type: 'heading' as const, id: 's3', text: 'Сцена 1 (Маша, Медведенко)', index: 4 },
    ];

    const existing: Scene[] = [
      {
        id: 'e1',
        playId: 'play-1',
        number: 1,
        title: 'Акт 1, сц. 1 (Медведенко, Маша)',
        status: 'not_started',
        priority: 'medium',
        roleIds: [],
      },
      {
        id: 'e2',
        playId: 'play-1',
        number: 2,
        title: 'Акт 1, сц. 2 (Треплев, Нина)',
        status: 'not_started',
        priority: 'medium',
        roleIds: [],
      },
      {
        id: 'e3',
        playId: 'play-1',
        number: 3,
        title: 'Акт 2, сц. 1 (Маша, Медведенко)',
        status: 'not_started',
        priority: 'medium',
        roleIds: [],
      },
    ];

    const matches = [
      {
        sceneId: 'e1',
        anchor: { type: 'heading' as const, id: 's1' },
        anchorText: anchors[1]!.text,
        score: 80,
      },
      {
        sceneId: 'e2',
        anchor: { type: 'heading' as const, id: 's2' },
        anchorText: anchors[2]!.text,
        score: 80,
      },
      {
        sceneId: 'e3',
        anchor: { type: 'heading' as const, id: 's3' },
        anchorText: anchors[4]!.text,
        score: 80,
      },
    ];

    const { toUpdate } = mergeMissingScenesFromImport('play-1', existing, anchors, matches);
    assert.equal(toUpdate.length, 3);
    assert.match(toUpdate[0]!.title, /Действие первое\. Сцена 1/);
    assert.match(toUpdate[2]!.title, /Действие второе\. Сцена 1/);
    assert.deepEqual(
      toUpdate.map((scene) => scene.number),
      [1, 2, 3]
    );
  });
});
