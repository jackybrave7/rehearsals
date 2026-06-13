import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/chaikaScenes.generated.json'), 'utf8')
);
const rolesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/chaikaRoles.generated.json'), 'utf8')
);

const PLAY_TITLE = 'Чайка';
const API = process.env.REHEARSALS_API ?? 'http://localhost:3001/api/state';

function findRoleId(playRoles, playId, characterName) {
  const token = characterName.trim().toLowerCase();
  if (!token || token === 'никого' || token === 'театр в театре') return undefined;
  const roles = playRoles.filter((role) => role.playId === playId && role.kind === 'character');
  return (
    roles.find((role) => role.name.trim().toLowerCase() === token)?.id ??
    roles.find((role) => role.description?.toLowerCase().includes(token))?.id
  );
}

function buildSceneRoleIds(playRoles, playId, characters) {
  return [...new Set(characters.map((name) => findRoleId(playRoles, playId, name)).filter(Boolean))];
}

const res = await fetch(API);
const state = await res.json();

const play = state.plays.find((p) => p.title === PLAY_TITLE);
if (!play) {
  console.error('Play "Чайка" not found');
  process.exit(1);
}

const roleIdByName = new Map(
  state.playRoles.filter((role) => role.playId === play.id).map((role) => [role.name, role.id])
);

const playRoles = [
  ...state.playRoles.filter((role) => role.playId !== play.id),
  ...rolesData.map((entry) => ({
    id: roleIdByName.get(entry.name) ?? randomUUID(),
    playId: play.id,
    name: entry.name,
    kind: 'character',
    order: entry.order,
    description: entry.description,
  })),
];

const scenes = scenesData.map((entry, index) => ({
  id: randomUUID(),
  playId: play.id,
  number: index + 1,
  title: entry.title,
  description: entry.description,
  status: 'not_started',
  priority: 'medium',
  roleIds: buildSceneRoleIds(playRoles, play.id, entry.characters),
  estimatedMinutes: 15,
}));

const nextState = {
  ...state,
  activePlayId: play.id,
  playRoles,
  scenes: [...state.scenes.filter((s) => s.playId !== play.id), ...scenes],
};

const save = await fetch(API, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(nextState),
});

if (!save.ok) {
  console.error('Save failed', await save.text());
  process.exit(1);
}

console.log(
  `Updated ${scenes.length} scenes for «${play.title}», roles linked on ${scenes.filter((s) => s.roleIds.length).length} scenes`
);
