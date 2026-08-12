/**
 * Локальный сид для ручной проверки сценария «две постановки одновременно».
 * Не для продакшена: создаёт Pro-пользователя с подтверждённой почтой.
 *
 *   npx tsx scripts/seed-two-productions.ts
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../server/db.js';
import { deleteUserCompletely } from '../server/adminDeleteUser.js';
import { saveStateForUser } from '../server/stateUserScope.js';
import type { AppState } from '../src/types/index.js';

const EMAIL = 'director@example.com';
const PASSWORD = 'rehearsals123';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const db = getDb();
const now = new Date().toISOString();

// Повторный запуск: сносим прошлого пользователя вместе с театром, иначе мешают внешние ключи.
const previous = db.prepare(`SELECT id FROM users WHERE email = ?`).get(EMAIL) as
  | { id: string }
  | undefined;
if (previous) deleteUserCompletely(previous.id, db);

const userId = uuidv4();
db.prepare(
  `INSERT INTO users (
     id, email, name, password_hash, google_sub, created_at, terms_accepted_at,
     email_verified_at, registration_approved_at, subscription_plan
   ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 'pro')`
).run(userId, EMAIL, 'Режиссёр', hashPassword(PASSWORD), now, now, now, now);

const theaterId = uuidv4();
const grozaId = uuidv4();
const chaikaId = uuidv4();
const venueId = uuidv4();

const actorNames = [
  'Анна Ветрова',
  'Борис Кленов',
  'Вера Соловьёва',
  'Глеб Морозов',
  'Дарья Липина',
  'Егор Тихонов',
  // Ни в одной сцене не занят: его добавляют в репетицию вручную.
  'Технарь Пультов',
];
const actors = actorNames.map((name) => ({
  id: uuidv4(),
  theaterId,
  name,
  status: 'active' as const,
}));

const grozaPerformanceId = uuidv4();
const grozaTourPerformanceId = uuidv4();
const chaikaPerformanceId = uuidv4();

/**
 * Занятость участников считается по составу сцен (getExpectedActorIds), поэтому нужны роли
 * и распределение — без них сетка доступности честно показывает, что все свободны.
 */
function rolesFor(playId: string, names: string[]) {
  return names.map((name, index) => ({
    id: uuidv4(),
    playId,
    name,
    kind: 'character' as const,
    order: index,
  }));
}

const grozaRoles = rolesFor(grozaId, ['Катерина', 'Кабаниха', 'Тихон', 'Борис']);
const chaikaRoles = rolesFor(chaikaId, ['Нина', 'Аркадина', 'Треплёв', 'Тригорин']);

// Анна Ветрова занята в обеих постановках — это и есть проверяемый случай.
const grozaCast = [0, 2, 1, 3];
const chaikaCast = [0, 2, 4, 5];

// Второй состав «Грозы»: Катерину играет другая актриса — видно, что показ переключает состав.
const grozaTourCast = [2, 1, 3, 0];

const castAssignments = [
  ...grozaRoles.map((role, index) => ({
    id: uuidv4(),
    playId: grozaId,
    performanceId: grozaPerformanceId,
    roleId: role.id,
    actorId: actors[grozaCast[index]].id,
  })),
  ...grozaRoles.map((role, index) => ({
    id: uuidv4(),
    playId: grozaId,
    performanceId: grozaTourPerformanceId,
    roleId: role.id,
    actorId: actors[grozaTourCast[index]].id,
  })),
  ...chaikaRoles.map((role, index) => ({
    id: uuidv4(),
    playId: chaikaId,
    performanceId: chaikaPerformanceId,
    roleId: role.id,
    actorId: actors[chaikaCast[index]].id,
  })),
];

function scenesFor(
  playId: string,
  entries: { title: string; roleIds: string[] }[],
  offset: number
) {
  return entries.map((entry, index) => ({
    id: uuidv4(),
    playId,
    number: index + 1,
    title: entry.title,
    status: (['ready', 'in_progress', 'not_started'] as const)[(index + offset) % 3],
    roleIds: entry.roleIds,
  }));
}

const grozaScenes = scenesFor(
  grozaId,
  [
    { title: 'Бульвар над Волгой', roleIds: [grozaRoles[0].id, grozaRoles[3].id] },
    { title: 'Дом Кабановых', roleIds: [grozaRoles[0].id, grozaRoles[1].id, grozaRoles[2].id] },
    { title: 'Ключ', roleIds: [grozaRoles[0].id] },
    { title: 'Свидание в овраге', roleIds: [grozaRoles[0].id, grozaRoles[3].id] },
    { title: 'Гроза', roleIds: [grozaRoles[0].id, grozaRoles[1].id] },
  ],
  0
);
const chaikaScenes = scenesFor(
  chaikaId,
  [
    { title: 'Парк у эстрады', roleIds: [chaikaRoles[0].id, chaikaRoles[2].id] },
    { title: 'Пьеса Треплёва', roleIds: [chaikaRoles[0].id, chaikaRoles[1].id] },
    { title: 'После провала', roleIds: [chaikaRoles[1].id, chaikaRoles[3].id] },
    { title: 'Лото', roleIds: [chaikaRoles[1].id, chaikaRoles[3].id] },
  ],
  1
);

const today = new Date();
const day = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd');

const state: AppState = {
  theaters: [{ id: theaterId, name: 'Театр на Набережной', ownerUserId: userId }],
  activeTheaterId: theaterId,
  actors,
  plays: [
    {
      id: grozaId,
      theaterId,
      title: 'Гроза',
      author: 'А. Н. Островский',
      year: 1859,
    },
    {
      id: chaikaId,
      theaterId,
      title: 'Чайка',
      author: 'А. П. Чехов',
      year: 1896,
    },
  ],
  activePlayId: grozaId,
  selectedPerformanceByPlayId: {},
  playRoles: [...grozaRoles, ...chaikaRoles],
  performances: [
    {
      id: grozaPerformanceId,
      playId: grozaId,
      name: 'Премьера',
      isDefault: true,
      date: day(38),
      startTime: '19:00',
    },
    {
      id: grozaTourPerformanceId,
      playId: grozaId,
      name: 'Выездной показ',
      date: day(54),
      startTime: '18:00',
    },
    {
      id: chaikaPerformanceId,
      playId: chaikaId,
      name: 'Премьера',
      isDefault: true,
      date: day(72),
      startTime: '19:00',
    },
  ],
  castAssignments,
  scenes: [...grozaScenes, ...chaikaScenes],
  tasks: [
    {
      id: uuidv4(),
      theaterId,
      playId: grozaId,
      title: 'Костюмы Катерины',
      done: false,
      priority: 'high',
      assigneeIds: [],
      dueDate: day(10),
    },
    {
      id: uuidv4(),
      theaterId,
      playId: chaikaId,
      title: 'Чучело чайки',
      done: false,
      priority: 'medium',
      assigneeIds: [],
    },
    {
      id: uuidv4(),
      theaterId,
      title: 'Починить софит в зале',
      done: false,
      priority: 'low',
      assigneeIds: [],
    },
  ],
  venues: [{ id: venueId, theaterId, name: 'Малый зал', address: 'Набережная, 12' }],
  rehearsals: [
    // Тот же день, две постановки — главный проверяемый случай.
    {
      id: uuidv4(),
      theaterId,
      playId: grozaId,
      date: day(1),
      startTime: '13:00',
      endTime: '16:00',
      venueId,
      sceneIds: [grozaScenes[0].id, grozaScenes[1].id],
      taskIds: [],
      schedule: [],
      // Технарь ни в одной сцене не занят — попадает в занятость только как ручной участник.
      actorIds: [actors[0].id, actors[1].id, actors[6].id],
      attendance: {},
    },
    {
      id: uuidv4(),
      theaterId,
      playId: chaikaId,
      date: day(1),
      startTime: '18:00',
      endTime: '21:00',
      venueId,
      sceneIds: [chaikaScenes[0].id],
      taskIds: [],
      schedule: [],
      actorIds: [actors[0].id, actors[2].id, actors[6].id],
      attendance: {},
    },
    // Смешанная репетиция: сцены из двух постановок.
    {
      id: uuidv4(),
      theaterId,
      playId: grozaId,
      date: day(3),
      startTime: '18:00',
      endTime: '22:00',
      venueId,
      sceneIds: [grozaScenes[2].id, chaikaScenes[1].id],
      taskIds: [],
      schedule: [],
      actorIds: [actors[1].id, actors[3].id],
      attendance: {},
    },
    // Забронированы дата и зал, плана ещё нет — раньше такая репетиция была «без постановки».
    {
      id: uuidv4(),
      theaterId,
      playId: chaikaId,
      date: day(5),
      startTime: '19:00',
      endTime: '22:00',
      venueId,
      sceneIds: [],
      taskIds: [],
      schedule: [],
      actorIds: [],
      attendance: {},
    },
    {
      id: uuidv4(),
      theaterId,
      playId: grozaId,
      date: day(-4),
      startTime: '18:00',
      endTime: '21:00',
      venueId,
      sceneIds: [grozaScenes[3].id],
      taskIds: [],
      schedule: [],
      actorIds: [actors[4].id, actors[5].id],
      attendance: {},
    },
  ],
  rehearsalActorNotes: [],
  appMeta: {},
};

saveStateForUser(
  state,
  {
    user: { id: userId, email: EMAIL, name: 'Режиссёр' },
    theaters: [{ theaterId, role: 'owner' }],
  } as Parameters<typeof saveStateForUser>[1],
  db
);

console.log(`Seeded. Login: ${EMAIL} / ${PASSWORD}`);
console.log(`Theater ${theaterId}, plays: Гроза ${grozaId}, Чайка ${chaikaId}`);
