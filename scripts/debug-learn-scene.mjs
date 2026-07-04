import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const { parseScriptFileBuffer } = await import('../server/scriptImport.ts');
const { matchScenesToDocAnchors } = await import('../src/utils/googleDocs.ts');
const { extractSceneBodyTextsFromPlainText } = await import('../src/utils/sceneDescription.ts');
const { parseSceneLearnLines } = await import('../src/utils/sceneLearnLines.ts');

const scene = {
  id: '5771ed2f-a418-4b5a-ae4d-83179150e3ba',
  playId: '604e470e-2987-41a2-afd0-1a9d6c4bffa3',
  number: 14,
  title: 'Акт 2, 1 часть, сц. 2 — ЛЕС, ПЕЩЕРА МИХЕЛЯ, ночь',
  scriptAnchor: { type: 'heading', id: 'h.cr0rd4wy856k' },
};

const filePath = path.join(projectRoot, 'data/uploads/44065a29-416e-4088-9423-65a93491d723');
const buffer = fs.readFileSync(filePath);
const t0 = Date.now();
const { text, anchors } = await parseScriptFileBuffer(
  buffer,
  'script.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);
console.log('parsed in', Date.now() - t0, 'ms');
console.log('anchors', anchors.length, 'text len', text.length);

const match = matchScenesToDocAnchors([scene], anchors).find((m) => m.sceneId === scene.id);
console.log('match', match);

let body = '';
if (match) {
  body =
    extractSceneBodyTextsFromPlainText(text, anchors, [{ ...scene, scriptAnchor: match.anchor }]).get(
      scene.id
    ) ?? '';
}

console.log('body len', body.length);
console.log('preview', JSON.stringify(body.slice(0, 300)));

if (body) {
  const roles = [
    { id: '7a8a820c-5e04-4087-ae56-4b0dad827a52', playId: scene.playId, name: 'Петер Мунк', kind: 'character' },
    { id: '2df71a4e-f2b4-474d-8d65-04667537d8f3', playId: scene.playId, name: 'Михель-Голландец', kind: 'character' },
  ];
  const lines = parseSceneLearnLines(
    body,
    roles,
    scene.playId,
    new Set(['7a8a820c-5e04-4087-ae56-4b0dad827a52'])
  );
  console.log('learn lines', lines.length, 'actor lines', lines.filter((l) => l.isActorLine).length);
  console.log(
    'sample',
    lines.slice(0, 8).map((l) => ({ k: l.kind, a: l.isActorLine, t: l.text.slice(0, 70) }))
  );
  const michelLines = parseSceneLearnLines(
    body,
    roles,
    scene.playId,
    new Set(['2df71a4e-f2b4-474d-8d65-04667537d8f3'])
  );
  console.log('michel actor lines', michelLines.filter((l) => l.isActorLine).length);
  console.log(
    michelLines
      .filter((l) => l.text.includes('Михель') || l.isActorLine)
      .slice(0, 10)
      .map((l) => ({ k: l.kind, a: l.isActorLine, t: l.text.slice(0, 90) }))
  );
}
