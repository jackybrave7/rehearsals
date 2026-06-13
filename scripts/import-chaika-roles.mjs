import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rolesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/chaikaRoles.generated.json'), 'utf8')
);
const scenesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/chaikaScenes.generated.json'), 'utf8')
);

const PLAY_TITLE = 'Чайка';
const API = process.env.REHEARSALS_API ?? 'http://localhost:3001/api/state';

function loadStateFromBackup() {
  const backupDir = path.join(__dirname, '../data/backups');
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return JSON.parse(fs.readFileSync(path.join(backupDir, files[0]), 'utf8'));
}

async function loadState() {
  try {
    const res = await fetch(API);
    if (res.ok) return res.json();
  } catch {
    // fallback below
  }
  const backup = loadStateFromBackup();
  if (!backup) throw new Error('Не удалось загрузить состояние');
  return backup;
}

function findRoleId(playRoles, playId, characterName) {
  const token = characterName.trim().toLowerCase();
  if (!token || token === 'никого' || token === 'театр в театре') return undefined;

  const roles = playRoles.filter((role) => role.playId === playId && role.kind === 'character');
  const exact = roles.find((role) => role.name.trim().toLowerCase() === token);
  if (exact) return exact.id;

  return roles.find((role) => role.description?.toLowerCase().includes(token))?.id;
}

function buildSceneRoleIds(playRoles, playId, characters) {
  return [...new Set(characters.map((name) => findRoleId(playRoles, playId, name)).filter(Boolean))];
}

function parseCharactersFromTitle(title) {
  const match = title.match(/\(([^)]+)\)\s*$/);
  if (!match) return [];
  const raw = match[1].trim();
  if (!raw || raw.toLowerCase() === 'никого') return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.toLowerCase() !== 'театр в театре');
}

const state = await loadState();
const play = state.plays.find((item) => item.title === PLAY_TITLE);
if (!play) {
  console.error(`Постановка «${PLAY_TITLE}» не найдена`);
  process.exit(1);
}

const existingRoles = state.playRoles.filter((role) => role.playId === play.id);
const roleIdByName = new Map(existingRoles.map((role) => [role.name, role.id]));

const importedRoles = rolesData.map((entry) => {
  const existingId = roleIdByName.get(entry.name);
  return {
    id: existingId ?? randomUUID(),
    playId: play.id,
    name: entry.name,
    kind: 'character',
    order: entry.order,
    description: entry.description,
  };
});

const playRoles = [
  ...state.playRoles.filter((role) => role.playId !== play.id),
  ...importedRoles,
];

const scenesByTitle = new Map(scenesData.map((entry) => [entry.title, entry.characters]));
const updatedScenes = state.scenes.map((scene) => {
  if (scene.playId !== play.id) return scene;

  const characters =
    scenesByTitle.get(scene.title) ??
    parseCharactersFromTitle(scene.title);

  return {
    ...scene,
    roleIds: buildSceneRoleIds(playRoles, play.id, characters),
  };
});

const nextState = {
  ...state,
  activePlayId: play.id,
  playRoles,
  scenes: updatedScenes,
};

const saveRes = await fetch(API, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(nextState),
});

if (!saveRes.ok) {
  console.error('Save failed', await saveRes.text());
  process.exit(1);
}

const playScenes = updatedScenes.filter((scene) => scene.playId === play.id);
const linkedScenes = playScenes.filter((scene) => scene.roleIds?.length);
console.log(
  JSON.stringify(
    {
      play: play.title,
      roles: importedRoles.length,
      scenesWithRoles: linkedScenes.length,
      totalScenes: playScenes.length,
      emptyScenes: playScenes
        .filter((scene) => !scene.roleIds?.length)
        .map((scene) => scene.title),
    },
    null,
    2
  )
);
