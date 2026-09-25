import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Scene } from '../types';
import {
  buildGoogleDocAnchorsForLinking,
  extractDocTextAnchorsFromGoogleHtml,
  extractSceneLearnTextFromGoogleHtml,
  findGoogleAnchorForScene,
  matchScenesToDocAnchors,
  parseActScene,
  prepareGoogleSceneLinkMatches,
  resolveSceneLinkAnchor,
  resolveSceneGoogleDocsUrl,
  resolveSceneScriptUrl,
} from './googleDocs';
import { mergeMissingScenesFromImport } from './scriptDocument';
import {
  compareScenesByScriptOrder,
  normalizeSceneNumbersFromTitles,
  resolveSceneNumberFromTitle,
} from './sceneNumbering';

function scene(partial: Partial<Scene> & Pick<Scene, 'id' | 'number' | 'title'>): Scene {
  return {
    playId: 'play-1',
    status: 'not_started',
    ...partial,
  };
}

const kometaAnchors = [
  { type: 'heading' as const, id: 'h.s1', text: 'Сцена 1. Метро', index: 0 },
  { type: 'heading' as const, id: 'h.s2', text: 'Сцена 2. Метро', index: 1 },
  { type: 'heading' as const, id: 'h.s3', text: 'Сцена 3. Метро', index: 2 },
  { type: 'heading' as const, id: 'h.s4', text: 'Сцена 4. Кафе', index: 3 },
  { type: 'heading' as const, id: 'h.s5', text: 'Сцена 5. Кафе', index: 4 },
  { type: 'heading' as const, id: 'h.s6', text: 'Сцена 6. Кафе', index: 5 },
  { type: 'heading' as const, id: 'h.s7', text: 'Сцена 7. Кафе.', index: 6 },
];

describe('parseActScene', () => {
  it('reads scene number from «Сцена N. Место»', () => {
    assert.equal(parseActScene('Сцена 1. Метро').scene, 1);
    assert.equal(parseActScene('Сцена 4. Кафе').scene, 4);
    assert.equal(parseActScene('Сцена 7. Кафе.').scene, 7);
  });
});

describe('scene numbering', () => {
  it('uses title scene number instead of import index', () => {
    assert.equal(resolveSceneNumberFromTitle('Сцена 5. Кафе', 2), 5);
    assert.equal(resolveSceneNumberFromTitle('Сцена 4. Кафе', 3), 4);
  });

  it('never assigns scene number 0 from title', () => {
    assert.equal(resolveSceneNumberFromTitle('Сцена 0. Метро. Начало.', 1), 1);
  });

  it('renumbers script scenes 0,1,2 to continuous 1,2,3', () => {
    const scenes = [
      scene({ id: 'a', number: 0, title: 'Сцена 0. Метро. Начало.' }),
      scene({ id: 'b', number: 1, title: 'Сцена 1. Метро. Встреча.' }),
      scene({ id: 'c', number: 2, title: 'Сцена 2. Метро. Попутчики' }),
    ];
    const normalized = normalizeSceneNumbersFromTitles(scenes, 'play-1')
      .filter((item) => item.playId === 'play-1')
      .sort(compareScenesByScriptOrder)
      .map((item) => item.number);
    assert.deepEqual(normalized, [1, 2, 3]);
  });

  it('sorts scenes by script number', () => {
    const scenes = [
      scene({ id: 'a', number: 3, title: 'Сцена 5. Кафе' }),
      scene({ id: 'b', number: 2, title: 'Сцена 3. Метро' }),
      scene({ id: 'c', number: 4, title: 'Сцена 4. Кафе' }),
    ];
    const sorted = [...scenes].sort(compareScenesByScriptOrder).map((item) => item.title);
    assert.deepEqual(sorted, ['Сцена 3. Метро', 'Сцена 4. Кафе', 'Сцена 5. Кафе']);
  });

  it('normalizes duplicate/wrong numbers from titles', () => {
    const scenes = [
      scene({ id: 'a', number: 2, title: 'Сцена 3. Метро' }),
      scene({ id: 'b', number: 3, title: 'Сцена 5. Кафе' }),
      scene({ id: 'c', number: 4, title: 'Сцена 4. Кафе' }),
    ];
    const normalized = normalizeSceneNumbersFromTitles(scenes, 'play-1')
      .filter((item) => item.playId === 'play-1')
      .sort(compareScenesByScriptOrder)
      .map((item) => [item.title, item.number]);
    assert.deepEqual(normalized, [
      ['Сцена 3. Метро', 3],
      ['Сцена 4. Кафе', 4],
      ['Сцена 5. Кафе', 5],
    ]);
  });
});

describe('mergeMissingScenesFromImport', () => {
  it('assigns numbers from titles, not file index', () => {
    const existing = [
      scene({ id: 's3', number: 2, title: 'Сцена 3. Метро' }),
      scene({ id: 's5', number: 3, title: 'Сцена 5. Кафе' }),
    ];
    const fileAnchors = kometaAnchors.map((anchor, index) => ({
      ...anchor,
      id: `file-${index}`,
    }));
    const matches = [
      {
        sceneId: 's3',
        anchor: { type: 'heading' as const, id: 'file-2' },
        anchorText: 'Сцена 3. Метро',
        score: 100,
      },
      {
        sceneId: 's5',
        anchor: { type: 'heading' as const, id: 'file-4' },
        anchorText: 'Сцена 5. Кафе',
        score: 100,
      },
    ];

    const { toUpdate } = mergeMissingScenesFromImport('play-1', existing, fileAnchors, matches);
    assert.deepEqual(
      toUpdate.map((item) => [item.title, item.number]),
      [
        ['Сцена 3. Метро', 3],
        ['Сцена 5. Кафе', 5],
      ]
    );
  });
});

describe('google scene links', () => {
  it('does not pair scene 1 with scene 2 when scene 1 heading is missing', () => {
    const docWithoutScene1 = kometaAnchors.filter((anchor) => anchor.id !== 'h.s1');
    const scene1 = scene({ id: 's1', number: 1, title: 'Сцена 1. Метро' });
    assert.equal(findGoogleAnchorForScene(scene1, docWithoutScene1), null);
    const matches = matchScenesToDocAnchors([scene1], docWithoutScene1);
    assert.equal(matches.length, 0);
  });

  it('maps each scene to the same-number heading', () => {
    const scenes = kometaAnchors.map((anchor, index) =>
      scene({
        id: `s${index + 1}`,
        number: index + 1,
        title: anchor.text,
      })
    );
    const { matches } = prepareGoogleSceneLinkMatches(scenes, kometaAnchors);
    assert.equal(matches.length, 7);
    for (const match of matches) {
      const sceneItem = scenes.find((item) => item.id === match.sceneId)!;
      const expected = kometaAnchors.find((anchor) => anchor.text === sceneItem.title)!;
      assert.equal(match.anchor.id, expected.id);
    }
  });

  it('builds google docs url from stored anchors without scene.scriptAnchor', () => {
    const play = {
      id: 'play-1',
      title: 'Комета',
      author: 'test',
      documentUrl: 'https://docs.google.com/document/d/abc123/edit',
      googleDocumentId: 'abc123',
      scriptGoogleSceneAnchors: kometaAnchors,
    };
    const scene4 = scene({
      id: 's4',
      number: 4,
      title: 'Сцена 4. Кафе',
      scriptAnchor: { type: 'heading', id: 'file-3' },
    });
    const url = resolveSceneScriptUrl(play, scene4);
    assert.equal(url, 'https://docs.google.com/document/d/abc123/edit#heading=h.s4');
    assert.equal(resolveSceneLinkAnchor(play, scene4)?.id, 'h.s4');
  });

  it('hides google doc scene link without play document url', () => {
    const scene1 = scene({ id: 's1', number: 1, title: 'Сцена 1' });
    const playWithFileOnly = {
      id: 'play-1',
      title: 'Test',
      author: 'a',
      scriptFileUrl: '/api/files/abc',
    };
    assert.equal(resolveSceneScriptUrl(playWithFileOnly, scene1), '/api/files/abc');
    assert.equal(resolveSceneGoogleDocsUrl(playWithFileOnly, scene1), null);
  });

  it('parses anchors from public google html export', () => {
    const html = `
      <p id="h.s1"><span>Сцена 1. Метро</span></p>
      <p id="h.s2"><span>Сцена 2. Метро</span></p>
      <p id="h.s4"><span>Сцена 4. Кафе</span></p>
    `;
    const anchors = extractDocTextAnchorsFromGoogleHtml(html);
    assert.deepEqual(
      anchors.map((anchor) => [anchor.id, anchor.text]),
      [
        ['h.s1', 'Сцена 1. Метро'],
        ['h.s2', 'Сцена 2. Метро'],
        ['h.s4', 'Сцена 4. Кафе'],
      ]
    );
  });

  it('parses anchors from google html with numeric entities', () => {
    const html = `
      <h2 id="h.s1"><span>&#1057;&#1094;&#1077;&#1085;&#1072; 1. &#1052;&#1086;&#1088;&#1077;</span></h2>
      <h2 id="h.s2"><span>&#1057;&#1094;&#1077;&#1085;&#1072; 2. &#1041;&#1077;&#1088;&#1077;&#1075;</span></h2>
    `;
    const anchors = extractDocTextAnchorsFromGoogleHtml(html);
    assert.deepEqual(
      anchors.map((anchor) => [anchor.id, anchor.text]),
      [
        ['h.s1', 'Сцена 1. Море'],
        ['h.s2', 'Сцена 2. Берег'],
      ]
    );
  });

  it('extracts scene body from public google html export', () => {
    const html = `
      <p id="h.s1"><span>Сцена 1. Метро</span></p>
      <p><span>Реплика первой сцены.</span></p>
      <p id="h.s2"><span>Сцена 2. Метро</span></p>
      <p><span>Реплика второй сцены.</span></p>
    `;
    assert.equal(
      extractSceneLearnTextFromGoogleHtml(html, 'h.s1'),
      'Реплика первой сцены.'
    );
    assert.equal(
      extractSceneLearnTextFromGoogleHtml(html, 'h.s2'),
      'Реплика второй сцены.'
    );
  });

  it('imports h2 scene headings without google heading ids', () => {
    const html = `
      <h2><span>&#1057;&#1094;&#1077;&#1085;&#1072; 1. &#1052;&#1077;&#1090;&#1088;&#1086;</span></h2>
      <h2 id="h.s2"><span>&#1057;&#1094;&#1077;&#1085;&#1072; 2. &#1052;&#1077;&#1090;&#1088;&#1086;</span></h2>
      <h2 id="h.s3"><span>&#1057;&#1094;&#1077;&#1085;&#1072; 3. &#1052;&#1077;&#1090;&#1088;&#1086;</span></h2>
      <h2><span>&#1057;&#1094;&#1077;&#1085;&#1072; 4. &#1050;&#1072;&#1092;&#1077;</span></h2>
      <h2 id="h.s5"><span>&#1057;&#1094;&#1077;&#1085;&#1072; 5. &#1050;&#1072;&#1092;&#1077;</span></h2>
    `;
    const anchors = extractDocTextAnchorsFromGoogleHtml(html);
    assert.deepEqual(
      anchors.map((anchor) => [anchor.id, anchor.text]),
      [
        ['html.unlinked.0', 'Сцена 1. Метро'],
        ['h.s2', 'Сцена 2. Метро'],
        ['h.s3', 'Сцена 3. Метро'],
        ['html.unlinked.1', 'Сцена 4. Кафе'],
        ['h.s5', 'Сцена 5. Кафе'],
      ]
    );
    assert.deepEqual(
      buildGoogleDocAnchorsForLinking(anchors).map((anchor) => anchor.id),
      ['h.s2', 'h.s3', 'h.s5']
    );
  });

  it('adds missing scene 1 from google html without heading id', () => {
    const html = `
      <h2><span>Сцена 1. Метро. Встреча.</span></h2>
      <h2 id="h.s2"><span>Сцена 2. Метро</span></h2>
      <h2 id="h.s3"><span>Сцена 3. Метро</span></h2>
    `;
    const anchors = extractDocTextAnchorsFromGoogleHtml(html);
    const existing = [
      scene({ id: 's2', number: 2, title: 'Сцена 2. Метро' }),
      scene({ id: 's3', number: 3, title: 'Сцена 3. Метро' }),
    ];
    const matches = matchScenesToDocAnchors(existing, anchors);
    const { toAdd } = mergeMissingScenesFromImport('play-1', existing, anchors, matches);
    assert.deepEqual(
      toAdd.map((item) => [item.number, item.title]),
      [[1, 'Сцена 1. Метро. Встреча.']]
    );
  });
});
