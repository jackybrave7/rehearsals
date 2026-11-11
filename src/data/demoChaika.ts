import type {
  Actor,
  CastAssignment,
  Performance,
  PlayRole,
  Scene,
} from '../types';
import { generateId } from '../utils/id';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { buildSceneRoleIds } from './chaikaCast';
import chaikaRolesData from './chaikaRoles.generated.json';
import chaikaScenesData from './chaikaScenes.generated.json';

type ChaikaRoleSeed = { order: number; name: string; description: string };
type ChaikaSceneSeed = {
  act: number;
  sceneInAct: number;
  title: string;
  characters: string[];
  description: string;
};

const ROLES = chaikaRolesData as ChaikaRoleSeed[];
const SCENES = chaikaScenesData as ChaikaSceneSeed[];

/** Вымышленные участники — без фото реальной труппы (только инициалы в UI). */
export const DEMO_CHAIKA_CHARACTER_ACTORS: Record<string, string> = {
  Аркадина: 'Вера Орлова',
  Треплев: 'Пётр Северов',
  Нина: 'Алина Заречная',
  'Полина Андреевна': 'Ольга Вяземская',
  Маша: 'Дарья Морская',
  Тригорин: 'Борис Литов',
  Дорн: 'Сергей Хин',
  Медведенко: 'Семён Горский',
};

export const DEMO_CHAIKA_ACTOR_NAMES = [...new Set(Object.values(DEMO_CHAIKA_CHARACTER_ACTORS))].sort(
  (a, b) => a.localeCompare(b, 'ru')
);

export const DEMO_CHAIKA_PLAY_META = {
  title: 'Чайка',
  author: 'А.П. Чехов · адаптация (демо)',
  description:
    'Учебный пример: инсценировка в Google Docs и .docx, сцены разобраны по тексту. Участники и имена вымышленные.',
  year: 2026,
};

export function buildDemoChaikaActors(theaterId: string): Actor[] {
  return DEMO_CHAIKA_ACTOR_NAMES.map((name) => ({
    id: generateId(),
    theaterId,
    name,
    status: 'active' as const,
  }));
}

export function buildDemoChaikaCast(
  playId: string,
  actorByName: Record<string, { id: string }>
): { playRoles: PlayRole[]; performances: Performance[]; castAssignments: CastAssignment[] } {
  const playRoles: PlayRole[] = ROLES.map((entry) => ({
    id: generateId(),
    playId,
    name: entry.name,
    kind: 'character' as const,
    order: entry.order,
    description: entry.description,
  }));

  const roleByName = new Map(playRoles.map((role) => [role.name, role]));

  const defaultPerformance: Performance = {
    id: generateId(),
    playId,
    name: 'Основной состав',
    isDefault: true,
  };

  const castAssignments: CastAssignment[] = [];
  for (const [roleName, actorName] of Object.entries(DEMO_CHAIKA_CHARACTER_ACTORS)) {
    const role = roleByName.get(roleName);
    const actor = actorByName[actorName];
    if (!role || !actor) continue;
    castAssignments.push({
      id: generateId(),
      playId,
      performanceId: defaultPerformance.id,
      roleId: role.id,
      actorId: actor.id,
    });
  }

  return {
    playRoles,
    performances: [defaultPerformance],
    castAssignments,
  };
}

export function buildDemoChaikaScenes(playId: string, playRoles: PlayRole[]): Scene[] {
  return SCENES.map((entry, index) => ({
    id: generateId(),
    playId,
    number: index + 1,
    title: entry.title,
    description: entry.description,
    estimatedMinutes: DEFAULT_SCENE_REHEARSAL_MINUTES,
    status: 'not_started' as const,
    priority: 'medium' as const,
    roleIds: buildSceneRoleIds(playRoles, playId, entry.characters),
  }));
}

/** Первые сцены 1-го акта — для короткого плана демо-репетиции. */
export function demoChaikaRehearsalSceneIds(scenes: Scene[]): string[] {
  return scenes
    .filter((scene) => {
      const match = scene.title.match(/^Акт\s+1,/i);
      return Boolean(match);
    })
    .slice()
    .sort((a, b) => a.number - b.number)
    .slice(0, 4)
    .map((scene) => scene.id);
}
