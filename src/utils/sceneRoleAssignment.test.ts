import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PlayRole } from '../types';
import {
  buildSceneRoleIdsFromScriptText,
  extractCharacterNamesFromScriptText,
  findCharacterRoleId,
  isCharacterLabelForRole,
} from './sceneRoleAssignment';
import { CHARACTER_DIALOGUE_INLINE_RE } from './scriptTextLines';

const PLAY_ID = 'play-comet';

function role(partial: Partial<PlayRole> & Pick<PlayRole, 'id' | 'name'>): PlayRole {
  return {
    playId: PLAY_ID,
    kind: 'character',
    order: 0,
    ...partial,
  };
}

const cast: PlayRole[] = [
  role({ id: 'gustav', name: 'Густав Рахманинов' }),
  role({ id: 'elena', name: 'Елена (Лена)' }),
  role({ id: 'igor', name: 'Игорь', description: 'её жених, около 30 лет' }),
  role({ id: 'man1', name: 'Мужчина 1' }),
  role({ id: 'man2', name: 'Мужчина 2' }),
  role({ id: 'girl', name: 'Девушка мотоциклиста', scriptAliases: ['Девушка'] }),
  role({ id: 'narrator', name: 'Диктор на ТВ', scriptAliases: ['Диктор'] }),
];

describe('numbered character cues', () => {
  it('parses Мужчина 1 / Мужчина 2 dialogue lines', () => {
    assert.equal('Мужчина 1. Ну, помянем Колю.'.match(CHARACTER_DIALOGUE_INLINE_RE)?.[1], 'Мужчина 1');
    assert.equal('Мужчина 2. Помянем.'.match(CHARACTER_DIALOGUE_INLINE_RE)?.[1], 'Мужчина 2');
    assert.equal(
      'Мужчина 1 (девушке). Вроде надо. Надо?'.match(CHARACTER_DIALOGUE_INLINE_RE)?.[1],
      'Мужчина 1'
    );
  });

  it('extracts both numbered men and does not collapse them', () => {
    const text = `За соседним столиком — двое мужчин.
Мужчина 1. Ну, помянем Колю.
Мужчина 2. Помянем.
Мужчина 1. Хороший был парень.
Появляется девушка в костюме Сейлор Мун.
Девушка. Девушка.
Диктор. Внимание! Ярмарка обуви.`;

    const names = extractCharacterNamesFromScriptText(text);
    assert.deepEqual(names.sort(), ['Девушка', 'Диктор', 'Мужчина 1', 'Мужчина 2'].sort());

    const roleIds = buildSceneRoleIdsFromScriptText(text, cast, PLAY_ID);
    assert.deepEqual(roleIds.sort(), ['girl', 'man1', 'man2', 'narrator'].sort());
  });

  it('does not map Мужчина to Мужчина 1 when number is missing', () => {
    assert.equal(findCharacterRoleId(cast, PLAY_ID, 'Мужчина'), undefined);
    assert.equal(findCharacterRoleId(cast, PLAY_ID, 'Мужчина 1'), 'man1');
    assert.equal(findCharacterRoleId(cast, PLAY_ID, 'Мужчина 2'), 'man2');
  });
});

describe('scene 3 false Игорь', () => {
  const scene3 = `Лена подсаживается обратно.
Лена. Мне кажется, ты ненормальный?
Густав. Ты? О, мы идём на сближение.
Лена. И если хочешь знать, у меня есть парень, жених. И сейчас я как раз еду на встречу с ним.
Густав. Это замечательно.`;

  it('maps Лена → Елена (Лена) and does not add Игорь via description «жених»', () => {
    const names = extractCharacterNamesFromScriptText(scene3);
    assert.deepEqual(names.sort(), ['Густав', 'Лена'].sort());

    const roleIds = buildSceneRoleIdsFromScriptText(scene3, cast, PLAY_ID);
    assert.deepEqual(roleIds.sort(), ['elena', 'gustav'].sort());
    assert.ok(!roleIds.includes('igor'));
  });

  it('stops at next scene heading so leaked Scene 4 text does not add Игорь', () => {
    const leaked = `${scene3}
Сцена 4. Кафе. Игорь.
За столиком сидит Игорь, лет тридцати.
Игорь. У вас действуют скидки?
Лена. Игорь, прости.`;

    const roleIds = buildSceneRoleIdsFromScriptText(leaked, cast, PLAY_ID);
    assert.deepEqual(roleIds.sort(), ['elena', 'gustav'].sort());
    assert.ok(!roleIds.includes('igor'));
  });
});

describe('role name forms', () => {
  it('matches parenthetical alias in role name', () => {
    assert.equal(findCharacterRoleId(cast, PLAY_ID, 'Лена'), 'elena');
    assert.equal(findCharacterRoleId(cast, PLAY_ID, 'Елена'), 'elena');
    assert.ok(isCharacterLabelForRole('Елена (Лена)', 'Лена'));
  });
});
