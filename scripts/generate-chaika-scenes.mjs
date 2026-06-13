import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAIKA_SCENE_SYNOPSES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/chaikaSceneSynopses.json'), 'utf8')
);
const text = fs.readFileSync(path.join(__dirname, '../temp-chaika-text.txt'), 'utf8').split('\n');

const actNames = {
  'Действие первое': 1,
  'Действие второе': 2,
  'Действие третье': 3,
  'Действие четвертое': 4,
};

const sceneRe = /^Сцена (\d+) \((.+)\)$/;
const actRe = /^Действие (?:первое|второе|третье|четвертое)$/;

let act = 0;
let current = null;
const scenes = [];

function firstSentence(value) {
  return value.split(/(?<=[.!?…])\s+/)[0]?.replace(/\.$/, '') ?? value;
}

function buildDescription(body) {
  const lines = body.filter((line) => !line.startsWith('ЗАВИСИТ ОТ'));
  const setting = lines.find(
    (line) =>
      line.length > 25 &&
      line.length < 180 &&
      /(парк|комнат|дом|террас|озер|алле|эстрад|столов|площад|сад|берег|камень|буфет|диван|окн)/i.test(line)
  );
  const enter = lines.find((line) => /^(Входит|Входят|Появляются|Поднимается|Открывается|Слышен|Направо)/i.test(line));
  const dialogue = lines.find((line) => /^[А-ЯA-Z][^.:]{1,40}[.:]/.test(line));

  if (setting && enter) {
    return `${firstSentence(setting)}. ${firstSentence(enter)}.`;
  }
  if (setting) return `${firstSentence(setting)}.`;
  if (enter) return `${firstSentence(enter)}.`;
  if (dialogue) return `${dialogue.replace(/[.:]$/, '')}.`;
  return lines[0]?.slice(0, 120) ?? '';
}

function pushCurrent() {
  if (!current) return;
  const synopsisKey = `${current.act}:${current.sceneInAct}`;
  scenes.push({
    act: current.act,
    sceneInAct: current.sceneInAct,
    title: `Акт ${current.act}, сц. ${current.sceneInAct} (${current.characters})`,
    characters: current.characters.split(',').map((c) => c.trim()).filter(Boolean),
    description: CHAIKA_SCENE_SYNOPSES[synopsisKey] ?? buildDescription(current.body),
  });
}

for (const rawLine of text) {
  const line = rawLine.trim();
  if (!line) continue;
  if (actRe.test(line)) {
    pushCurrent();
    current = null;
    act = actNames[line];
    continue;
  }
  const sceneMatch = line.match(sceneRe);
  if (sceneMatch && act) {
    pushCurrent();
    current = {
      act,
      sceneInAct: Number(sceneMatch[1]),
      characters: sceneMatch[2],
      body: [],
    };
    continue;
  }
  if (current) current.body.push(line);
}
pushCurrent();

const out = path.join(__dirname, '../src/data/chaikaScenes.generated.json');
fs.writeFileSync(out, JSON.stringify(scenes, null, 2), 'utf8');
console.log('Generated', scenes.length, 'scenes ->', out);
