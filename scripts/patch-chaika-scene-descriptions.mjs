import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAY_TITLE = 'Чайка';
const API = process.env.REHEARSALS_API ?? 'http://localhost:3001/api/state';

const scenesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/chaikaScenes.generated.json'), 'utf8')
);

const res = await fetch(API);
if (!res.ok) {
  console.error('Failed to load state', res.status);
  process.exit(1);
}

const state = await res.json();
const play = state.plays.find((p) => p.title === PLAY_TITLE);
if (!play) {
  console.error(`Постановка «${PLAY_TITLE}» не найдена`);
  process.exit(1);
}

const descriptionByTitle = new Map(scenesData.map((entry) => [entry.title, entry.description]));
const descriptionByNumber = new Map(
  scenesData.map((entry, index) => [index + 1, entry.description])
);
let updated = 0;

const scenes = state.scenes.map((scene) => {
  if (scene.playId !== play.id) return scene;
  const description =
    descriptionByTitle.get(scene.title) ?? descriptionByNumber.get(scene.number);
  if (!description || scene.description === description) return scene;
  updated += 1;
  return { ...scene, description };
});

const save = await fetch(API, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...state, scenes }),
});

if (!save.ok) {
  console.error('Save failed', await save.text());
  process.exit(1);
}

console.log(`Обновлено описаний: ${updated} из ${scenes.filter((s) => s.playId === play.id).length}`);
