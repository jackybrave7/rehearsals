import type { AppState, CastAssignment, Performance, PlayRole } from '../types';
import { ACTOR_PHOTOS } from '../utils/actorPhotos';
import { generateId } from '../utils/id';

/** Данные с https://libertad-theater.ru/stone-heart.html */
export const STONE_HEART_CHARACTERS: { role: string; actors: string[]; order: number }[] = [
  { order: 1, role: 'Петер Мунк', actors: ['Никита Дубинин', 'Александр Ерахтин'] },
  { order: 2, role: 'Барбара Мунк', actors: ['Юлия Масохина'] },
  { order: 3, role: 'Лисбет Вайс', actors: ['Диана Бакурова'] },
  { order: 4, role: 'Теодор Вайс', actors: ['Александр Алабин'] },
  { order: 5, role: 'Изекиль', actors: ['Михаил Никитин'] },
  { order: 6, role: 'Стеклянный человек', actors: ['Руслан Аршидинов'] },
  { order: 7, role: 'Михель-Голландец', actors: ['Дмитрий Корепанов'] },
  { order: 8, role: 'Илма, хозяйка трактира', actors: ['Анна Зубченко', 'Елена Бакал'] },
  { order: 9, role: 'Агнет, трактирщица', actors: ['Василина Рзянина'] },
  { order: 10, role: 'Тени, слуги Михеля', actors: ['Василина Рзянина', 'Варвара Гусак'] },
  { order: 11, role: 'Попрошайка', actors: [] },
  { order: 12, role: 'Живые деревья', actors: [] },
];

export const STONE_HEART_CREW: {
  role: string;
  actors: string[];
  order: number;
  description?: string;
}[] = [
  {
    order: 1,
    role: 'Режиссёр-постановщик',
    actors: ['Евгений Алферов'],
    description: 'Художник-постановщик',
  },
  {
    order: 2,
    role: 'Драматург, композитор',
    actors: ['Тами Айрис'],
    description: 'Автор инсценировки по мотивам Вильгельма Гауфа',
  },
  {
    order: 3,
    role: 'Звукорежиссёр, композитор',
    actors: ['Сергей Чугунов'],
    description: 'Звуковой дизайн спектакля',
  },
  {
    order: 4,
    role: 'Медиа-художник',
    actors: ['Елизавета Соловец'],
    description: 'Креатор, режиссёр мультимедиа',
  },
];

export const STONE_HEART_PLAY_META = {
  title: 'Каменное сердце',
  author: 'Тами Айрис (по мотивам Вильгельма Гауфа)',
  description:
    'Сказочная драма о Петере Мунке — угольщике из Шварцвальда, который в погоне за успехом отдаёт живое сердце.',
  year: 2026,
  documentUrl: 'https://libertad-theater.ru/stone-heart.html',
};

/** Все участники спектакля по данным с сайта Libertad */
export const STONE_HEART_ACTOR_NAMES = [
  ...new Set([
    ...Object.keys(ACTOR_PHOTOS),
    ...STONE_HEART_CHARACTERS.flatMap(({ actors }) => actors),
    ...STONE_HEART_CREW.flatMap(({ actors }) => actors),
  ]),
].sort((a, b) => a.localeCompare(b, 'ru'));

export const STONE_HEART_CAST_VERSION = '3';
export const STONE_HEART_EXPECTED_ROLE_COUNT =
  STONE_HEART_CHARACTERS.length + STONE_HEART_CREW.length;

function assign(
  playId: string,
  performanceId: string,
  roleId: string,
  actorId: string
): CastAssignment {
  return { id: generateId(), playId, performanceId, roleId, actorId };
}

function findActor(actorByName: Record<string, { id: string }>, name: string) {
  if (actorByName[name]) return actorByName[name];
  const normalized = name.trim().toLowerCase();
  const key = Object.keys(actorByName).find(
    (candidate) => candidate.trim().toLowerCase() === normalized
  );
  return key ? actorByName[key] : undefined;
}

function buildCastForPerformance(
  playId: string,
  performanceId: string,
  roleByName: Map<string, PlayRole>,
  actorByName: Record<string, { id: string }>,
  entries: { role: string; actors: string[] }[]
): CastAssignment[] {
  const assignments: CastAssignment[] = [];
  for (const entry of entries) {
    const role = roleByName.get(entry.role);
    if (!role) continue;
    for (const actorName of entry.actors) {
      const actor = findActor(actorByName, actorName);
      if (!actor) continue;
      assignments.push(assign(playId, performanceId, role.id, actor.id));
    }
  }
  return assignments;
}

export function buildStoneHeartCast(playId: string, actorByName: Record<string, { id: string }>) {
  const playRoles: PlayRole[] = [
    ...STONE_HEART_CHARACTERS.map(({ role, order }) => ({
      id: generateId(),
      playId,
      name: role,
      kind: 'character' as const,
      order,
    })),
    ...STONE_HEART_CREW.map(({ role, order, description }) => ({
      id: generateId(),
      playId,
      name: role,
      kind: 'crew' as const,
      order,
      description,
    })),
  ];

  const roleByName = new Map(playRoles.map((r) => [r.name, r]));

  const defaultPerformance: Performance = {
    id: generateId(),
    playId,
    name: 'Основной состав',
    isDefault: true,
  };

  const premierePerformance: Performance = {
    id: generateId(),
    playId,
    name: 'Премьера',
    date: '2026-07-11',
    startTime: '18:00',
    description: 'Библиотека им. Неверова',
  };

  const characterEntries = STONE_HEART_CHARACTERS.map(({ role, actors }) => ({ role, actors }));
  const crewEntries = STONE_HEART_CREW.map(({ role, actors }) => ({ role, actors }));
  const allEntries = [...characterEntries, ...crewEntries];

  const castAssignments = [
    ...buildCastForPerformance(playId, defaultPerformance.id, roleByName, actorByName, allEntries),
    ...buildCastForPerformance(playId, premierePerformance.id, roleByName, actorByName, allEntries),
  ];

  return {
    playRoles,
    performances: [defaultPerformance, premierePerformance],
    castAssignments,
  };
}

export function isStoneHeartPlay(title: string): boolean {
  return title.trim().toLowerCase() === STONE_HEART_PLAY_META.title.toLowerCase();
}

export function applyStoneHeartCastToState(
  state: AppState,
  playId: string,
  actorByName: Record<string, { id: string }>
): AppState {
  const existingRoles = state.playRoles.filter((r) => r.playId === playId);
  const existingPerformances = state.performances.filter((p) => p.playId === playId);
  const existingAssignments = state.castAssignments.filter((a) => a.playId === playId);

  if (
    existingRoles.length > 0 ||
    existingPerformances.length > 0 ||
    existingAssignments.length > 0
  ) {
    return state;
  }

  const { playRoles, performances, castAssignments } = buildStoneHeartCast(playId, actorByName);
  return {
    ...state,
    playRoles: [...state.playRoles.filter((r) => r.playId !== playId), ...playRoles],
    performances: [...state.performances.filter((p) => p.playId !== playId), ...performances],
    castAssignments: [
      ...state.castAssignments.filter((a) => a.playId !== playId),
      ...castAssignments,
    ],
  };
}
