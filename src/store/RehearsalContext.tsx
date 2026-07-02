import {
  createContext,
  useContext,
  useReducer,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Actor,
  AppState,
  CastAssignment,
  Performance,
  Play,
  PlayRole,
  Rehearsal,
  RehearsalSeries,
  RehearsalTemplate,
  Scene,
  ScheduleBlock,
  Task,
  Theater,
  Venue,
} from '../types';
import { normalizeTask } from '../utils/tasks';
import { clearRemindersOnScheduleChange } from '../utils/reminders';
import { createDefaultVenue } from '../data/seedVenue';
import {
  applyStoneHeartCastToState,
  isStoneHeartPlay,
  STONE_HEART_ACTOR_NAMES,
  STONE_HEART_CAST_VERSION,
  STONE_HEART_PLAY_META,
} from '../data/stoneHeartCast';
import {
  applyStoneHeartSceneDescriptionsToState,
  applyStoneHeartScenesToState,
  STONE_HEART_SCENES_VERSION,
} from '../data/stoneHeartScenes';
import { ACTOR_PHOTOS, enrichActorPhotos } from '../utils/actorPhotos';
import { enrichPlayDocumentMeta } from '../utils/googleDocs';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { estimateRehearsalMinutes, resolveSceneTimingSettings } from '../utils/sceneTiming';
import { generateId } from '../utils/id';
import {
  mergeActorsForNewScheduleBlocks,
  mergeActorsForNewScenes,
  mergeActorsForSceneIds,
  resolveParticipantOrder,
} from '../utils/rehearsalActors';
import {
  getSceneIdsFromSchedule,
  removeDeselectedScenesFromSchedule,
} from '../utils/scheduleSync';
import { fetchAppState, fetchBackupList, fetchLatestBackupState, restoreBackupState, saveAppStateWithRetry, checkApiHealth, type SaveStatus } from '../api/storage';
import { scoreAppState } from '../utils/appStateScore';
import { pickAccessibleAppState, createEmptyAppState } from '../utils/appStateScope';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'rehearsals-app';
/** Сохранённые данные пользователя. Миграции только добавляют, не перезаписывают сцены/показы/репетиции. */
const STONE_HEART_CAST_KEY = 'stone-heart-cast-version';
const STONE_HEART_SCENES_KEY = 'stone-heart-scenes-version';

function touchAppMeta(
  state: AppState,
  patch: NonNullable<AppState['appMeta']>
): AppState {
  return {
    ...state,
    appMeta: { ...state.appMeta, ...patch },
  };
}

function syncStoneHeartMigrationKeys(state: AppState): void {
  if (typeof window === 'undefined') return;
  if (state.appMeta?.stoneHeartCastVersion) {
    localStorage.setItem(STONE_HEART_CAST_KEY, state.appMeta.stoneHeartCastVersion);
  }
  if (state.appMeta?.stoneHeartScenesVersion) {
    localStorage.setItem(STONE_HEART_SCENES_KEY, state.appMeta.stoneHeartScenesVersion);
  }
}

function hasPlayCastData(state: AppState, playId: string): boolean {
  return (
    state.playRoles.some((role) => role.playId === playId) ||
    state.performances.some((performance) => performance.playId === playId) ||
    state.castAssignments.some((assignment) => assignment.playId === playId)
  );
}

function hasPlaySceneData(state: AppState, playId: string): boolean {
  return state.scenes.some((scene) => scene.playId === playId);
}

function ensureTheaterScope(state: AppState): AppState {
  if (state.theaters.length === 0) {
    return { ...state, activeTheaterId: null, activePlayId: null };
  }

  const theaters = state.theaters;
  const activeTheaterId =
    state.activeTheaterId && theaters.some((theater) => theater.id === state.activeTheaterId)
      ? state.activeTheaterId
      : theaters[0]?.id ?? null;
  const fallbackTheaterId = activeTheaterId ?? theaters[0]?.id;

  const actors = state.actors.map((actor) => ({ ...actor, theaterId: actor.theaterId ?? fallbackTheaterId }));
  const plays = state.plays.map((play) => ({ ...play, theaterId: play.theaterId ?? fallbackTheaterId }));
  const tasks = state.tasks.map((task) => ({ ...task, theaterId: task.theaterId ?? fallbackTheaterId }));
  const venues = state.venues.map((venue) => ({ ...venue, theaterId: venue.theaterId ?? fallbackTheaterId }));
  const rehearsals = state.rehearsals.map((rehearsal) => ({
    ...rehearsal,
    theaterId:
      rehearsal.theaterId ??
      plays.find((play) => play.id === rehearsal.playId)?.theaterId ??
      fallbackTheaterId,
  }));
  const activePlayId =
    state.activePlayId &&
    plays.some((play) => play.id === state.activePlayId && play.theaterId === activeTheaterId)
      ? state.activePlayId
      : plays.find((play) => play.theaterId === activeTheaterId)?.id ?? null;

  return { ...state, theaters, activeTheaterId, actors, plays, tasks, venues, rehearsals, activePlayId };
}

function bootstrapAppState(data: AppState): AppState {
  const migrated = runOneTimeMigrations(migrateState(data));
  syncStoneHeartMigrationKeys(migrated);
  return migrated;
}

function mirrorLocalStorage(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[rehearsals] Ошибка записи localStorage', error);
  }
}

function createBlankAppState(theaterId: string, theaterName = 'Мой театр'): AppState {
  return {
    theaters: [{ id: theaterId, name: theaterName }],
    activeTheaterId: theaterId,
    actors: [],
    plays: [],
    activePlayId: null,
    selectedPerformanceByPlayId: {},
    playRoles: [],
    performances: [],
    castAssignments: [],
    scenes: [],
    tasks: [],
    venues: [],
    rehearsals: [],
    appMeta: {},
  };
}

async function loadInitialAppState(accessibleTheaterIds: Set<string>): Promise<AppState> {
  const apiOk = await checkApiHealth();
  if (!apiOk) {
    throw new Error('API_UNAVAILABLE');
  }

  let remote: AppState | null = null;
  try {
    remote = await fetchAppState();
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      throw error;
    }
    console.error('[rehearsals] Ошибка чтения SQLite', error);
    throw error;
  }

  let backup: AppState | null = null;
  try {
    backup = await fetchLatestBackupState();
  } catch {
    // резервные копии необязательны
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  const local = raw ? parseSavedState(raw) : null;
  const best = pickAccessibleAppState(accessibleTheaterIds, remote, local, backup);

  if (best) {
    const bootstrapped = bootstrapAppState(best);
    const source =
      best === remote ? 'SQLite' : best === local ? 'браузера' : 'резервной копии';
    const shouldPushToServer = best !== remote;

    if (remote && best !== remote && scoreAppState(best) > scoreAppState(remote)) {
      console.info(`[rehearsals] В SQLite менее полные данные — восстановление из ${source}`);
    }

    if (shouldPushToServer) {
      try {
        await saveAppStateWithRetry(bootstrapped);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isConflict =
          message.includes('FORBIDDEN') ||
          message.includes('UNIQUE constraint') ||
          message.includes('SQLITE_CONSTRAINT');
        if (isConflict && remote) {
          const fromServer = bootstrapAppState(
            pickAccessibleAppState(accessibleTheaterIds, remote, null, null) ?? remote
          );
          mirrorLocalStorage(fromServer);
          return fromServer;
        }
        if (message.includes('FORBIDDEN')) {
          throw new Error('FORBIDDEN_RELOAD');
        }
        throw error;
      }
    }

    mirrorLocalStorage(bootstrapped);
    return bootstrapped;
  }

  if (accessibleTheaterIds.size === 0) {
    const empty = bootstrapAppState(createEmptyAppState());
    mirrorLocalStorage(empty);
    return empty;
  }

  const initialTheaterId = [...accessibleTheaterIds][0];
  const initial = bootstrapAppState(createBlankAppState(initialTheaterId));
  try {
    await saveAppStateWithRetry(initial);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('FORBIDDEN')) {
      throw new Error('FORBIDDEN_RELOAD');
    }
    throw error;
  }
  mirrorLocalStorage(initial);
  return initial;
}

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function formatSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'AUTH_REQUIRED') {
    return 'Сессия истекла. Войдите снова через страницу входа.';
  }
  if (message === 'API_UNAVAILABLE') {
    return isLocalDevHost()
      ? 'База данных недоступна. Запустите restart.bat и дождитесь строки [api] http://localhost:3001'
      : 'Сервер временно недоступен. Попробуйте обновить страницу через минуту.';
  }
  if (message.includes('UNIQUE constraint') || message.includes('SQLITE_CONSTRAINT')) {
    return 'Не удалось синхронизировать данные с сервером. Нажмите «Повторить подключение».';
  }
  if (message.includes('WOULD_LOSE_USER_DATA')) {
    return 'Сохранение отклонено: попытка затереть данные. Обновите страницу.';
  }
  if (message.includes('FORBIDDEN_RELOAD')) {
    return 'Не удалось синхронизировать данные. Обновите страницу.';
  }
  if (message.includes('FORBIDDEN')) {
    return 'Недостаточно прав для сохранения изменений в этом театре.';
  }
  if (message === 'SUBSCRIPTION_THEATER_LIMIT') {
    return 'На тарифе Free доступен один театр. Перейдите на Pro или удалите лишний театр.';
  }
  if (message === 'SUBSCRIPTION_PLAY_LIMIT') {
    return 'На тарифе Free доступна одна активная постановка. Архивируйте лишнюю или перейдите на Pro.';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return isLocalDevHost()
      ? 'Нет связи с базой (порт 3001). Запустите restart.bat — изменения не сохранены.'
      : 'Нет связи с сервером — изменения не сохранены. Попробуйте обновить страницу.';
  }
  if (isLocalDevHost()) {
    return `Не удалось записать в базу: ${message}. Проверьте, что restart.bat запущен.`;
  }
  return `Не удалось записать в базу: ${message}`;
}

let persistChain: Promise<void> = Promise.resolve();

function persistToStorage(
  state: AppState,
  setSaveError: (message: string | null) => void,
  setSaveStatus: (status: SaveStatus) => void,
  readOnly: boolean,
  refreshSession?: () => Promise<unknown>
): void {
  mirrorLocalStorage(state);
  if (readOnly) {
    setSaveError(null);
    setSaveStatus('saved');
    return;
  }

  setSaveStatus('saving');
  persistChain = persistChain
    .then(async () => {
      await saveAppStateWithRetry(state);
      if (refreshSession) {
        await refreshSession();
      }
      mirrorLocalStorage(state);
      setSaveError(null);
      setSaveStatus('saved');
    })
    .catch((error) => {
      console.error('[rehearsals] Ошибка сохранения в SQLite', error);
      setSaveStatus('error');
      setSaveError(formatSaveError(error));
    });
}

const initialState: AppState = {
  theaters: [],
  activeTheaterId: null,
  actors: [],
  plays: [],
  activePlayId: null,
  selectedPerformanceByPlayId: {},
  playRoles: [],
  performances: [],
  castAssignments: [],
  scenes: [],
  tasks: [],
  venues: [],
  rehearsals: [],
};

type LegacyAppState = AppState & { play?: Play | null };
type LegacyActor = Actor & { role?: string };
type LegacyPlayRole = PlayRole & { kind?: PlayRole['kind']; order?: number };

function migrateState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return initialState;

  const data = raw as LegacyAppState;
  let plays = data.plays ?? [];
  let activePlayId = data.activePlayId ?? null;

  if (data.play !== undefined && data.plays === undefined) {
    plays = data.play ? [data.play] : [];
    activePlayId = data.play?.id ?? null;
  }

  if (plays.length > 0 && !activePlayId) {
    activePlayId = plays[0].id;
  }

  const rawActors = (data.actors ?? []) as LegacyActor[];
  const actors = enrichActorPhotos(
    rawActors.map((actor) => {
      const status = actor.status ?? 'active';
      const { role: _role, ...rest } = actor;
      return {
        ...rest,
        status,
        archiveReason: status === 'archived' ? actor.archiveReason : undefined,
      };
    })
  );

  let migrated: AppState = {
    ...ensureDefaultVenues({
      theaters: data.theaters ?? [],
      activeTheaterId: data.activeTheaterId ?? null,
      actors,
      plays: plays.map((play) =>
        enrichPlayDocumentMeta(
          isStoneHeartPlay(play.title)
            ? {
                ...play,
                author: play.author?.trim() || STONE_HEART_PLAY_META.author,
                description: play.description ?? STONE_HEART_PLAY_META.description,
                year: play.year ?? STONE_HEART_PLAY_META.year,
                documentUrl: play.documentUrl ?? STONE_HEART_PLAY_META.documentUrl,
              }
            : play
        )
      ),
      activePlayId,
      selectedPerformanceByPlayId: data.selectedPerformanceByPlayId ?? {},
      playRoles: (data.playRoles ?? []).map((role, index) => {
        const legacy = role as LegacyPlayRole;
        return {
          ...legacy,
          kind: legacy.kind ?? 'character',
          order: legacy.order ?? index + 1,
        };
      }),
      performances: data.performances ?? [],
      castAssignments: (data.castAssignments ?? []) as CastAssignment[],
      scenes: (data.scenes ?? []).map((scene) => ({
        ...scene,
        priority: scene.priority ?? 'medium',
        directorNotes: scene.directorNotes ?? undefined,
      })),
      tasks: (data.tasks ?? []).map((task) => normalizeTask(task as Task)),
      venues: data.venues ?? [],
      rehearsals: (data.rehearsals ?? []).map((rehearsal) => ({
        ...rehearsal,
        attendance: rehearsal.attendance ?? {},
        schedule: (rehearsal.schedule ?? []).map((block) => ({
          ...block,
          decidedNotes: block.decidedNotes ?? undefined,
          remainingNotes: block.remainingNotes ?? undefined,
        })),
      })),
      appMeta: data.appMeta ?? {},
    }),
  };

  migrated = migratePerformances(migrated);
  if (migrated.playRoles.length === 0 && rawActors.some((a) => a.role?.trim())) {
    migrated = migrateLegacyCast(migrated, rawActors);
  }
  migrated = migrateSceneRehearsalDuration(migrated);
  migrated = ensureTheaterScope(migrated);

  return migrated;
}

function migrateSceneRehearsalDuration(state: AppState): AppState {
  return {
    ...state,
    scenes: state.scenes.map((scene) => ({
      ...scene,
      estimatedMinutes:
        scene.estimatedMinutes === undefined || scene.estimatedMinutes === 5
          ? DEFAULT_SCENE_REHEARSAL_MINUTES
          : scene.estimatedMinutes,
    })),
  };
}

function runOneTimeMigrations(state: AppState): AppState {
  let migrated = maybeApplyStoneHeartCast(state);
  migrated = maybeApplyStoneHeartScenes(migrated);
  return migrated;
}

function migratePerformances(state: AppState): AppState {
  let performances: Performance[] = state.performances.map((p) => ({
    ...p,
    description: p.description ?? p.notes,
  }));
  let castAssignments = state.castAssignments.map((a) => ({ ...a }));

  for (const play of state.plays) {
    const playPerformances = performances.filter((p) => p.playId === play.id);
    let defaultPerformance =
      playPerformances.find((p) => p.isDefault) ?? playPerformances[0];

    if (!defaultPerformance) {
      defaultPerformance = {
        id: generateId(),
        playId: play.id,
        name: 'Основной состав',
        isDefault: true,
      };
      performances.push(defaultPerformance);
    }

    castAssignments = castAssignments.map((assignment) => {
      if (assignment.playId !== play.id || assignment.performanceId) return assignment;
      return { ...assignment, performanceId: defaultPerformance!.id };
    });
  }

  return { ...state, performances, castAssignments };
}

function ensureStoneHeartActors(state: AppState): AppState {
  const existing = new Set(state.actors.map((a) => a.name));
  const missing = STONE_HEART_ACTOR_NAMES.filter((name) => !existing.has(name));
  if (missing.length === 0) return state;

  const newActors = missing.map((name) => ({
    id: generateId(),
    name,
    status: 'active' as const,
    photoUrl: ACTOR_PHOTOS[name as keyof typeof ACTOR_PHOTOS],
  }));

  return {
    ...state,
    actors: enrichActorPhotos([...state.actors, ...newActors]),
  };
}

function maybeApplyStoneHeartCast(state: AppState): AppState {
  if (typeof window === 'undefined') return state;

  const play = state.plays.find((p) => isStoneHeartPlay(p.title));
  if (!play) return state;

  const appliedVersion =
    state.appMeta?.stoneHeartCastVersion ?? localStorage.getItem(STONE_HEART_CAST_KEY);

  if (hasPlayCastData(state, play.id)) {
    return touchAppMeta(state, { stoneHeartCastVersion: STONE_HEART_CAST_VERSION });
  }

  if (appliedVersion === STONE_HEART_CAST_VERSION) return state;

  const withActors = ensureStoneHeartActors(state);
  const actorByName = Object.fromEntries(withActors.actors.map((a) => [a.name, a]));
  const updated = applyStoneHeartCastToState(withActors, play.id, actorByName);

  return touchAppMeta(updated, { stoneHeartCastVersion: STONE_HEART_CAST_VERSION });
}

function maybeApplyStoneHeartScenes(state: AppState): AppState {
  if (typeof window === 'undefined') return state;

  const play = state.plays.find((p) => isStoneHeartPlay(p.title));
  if (!play) return state;

  const appliedVersion =
    state.appMeta?.stoneHeartScenesVersion ?? localStorage.getItem(STONE_HEART_SCENES_KEY);

  if (hasPlaySceneData(state, play.id)) {
    const withDescriptions =
      appliedVersion === STONE_HEART_SCENES_VERSION
        ? state
        : applyStoneHeartSceneDescriptionsToState(state, play.id);
    return touchAppMeta(withDescriptions, { stoneHeartScenesVersion: STONE_HEART_SCENES_VERSION });
  }

  if (appliedVersion === STONE_HEART_SCENES_VERSION) return state;

  const updated = applyStoneHeartScenesToState(state, play.id);

  return touchAppMeta(updated, { stoneHeartScenesVersion: STONE_HEART_SCENES_VERSION });
}

function migrateLegacyCast(state: AppState, legacyActors: LegacyActor[]): AppState {
  const playRoles: PlayRole[] = [...state.playRoles];
  const castAssignments: CastAssignment[] = [...state.castAssignments];
  const performances = [...state.performances];
  const roleIndex = new Map(playRoles.map((r) => [`${r.playId}:${r.name}`, r.id]));

  for (const actor of legacyActors) {
    const legacyRole = actor.role?.trim();
    if (!legacyRole || !actor.id) continue;

    const play = state.plays.find((p) => p.title === legacyRole) ?? state.plays[0];
    if (!play) continue;

    let performance =
      performances.find((p) => p.playId === play.id && p.isDefault) ??
      performances.find((p) => p.playId === play.id);
    if (!performance) {
      performance = {
        id: generateId(),
        playId: play.id,
        name: 'Основной состав',
        isDefault: true,
      };
      performances.push(performance);
    }

    const roleName = play.title === legacyRole ? 'Актёрский состав' : legacyRole;
    const roleKey = `${play.id}:${roleName}`;
    let roleId = roleIndex.get(roleKey);

    if (!roleId) {
      roleId = generateId();
      playRoles.push({
        id: roleId,
        playId: play.id,
        name: roleName,
        kind: 'character',
        order: playRoles.filter((r) => r.playId === play.id).length + 1,
      });
      roleIndex.set(roleKey, roleId);
    }

    const exists = castAssignments.some(
      (a) =>
        a.playId === play.id &&
        a.performanceId === performance!.id &&
        a.roleId === roleId &&
        a.actorId === actor.id
    );
    if (!exists) {
      castAssignments.push({
        id: generateId(),
        playId: play.id,
        performanceId: performance.id,
        roleId,
        actorId: actor.id,
      });
    }
  }

  return { ...state, playRoles, performances, castAssignments };
}

function ensureDefaultVenues(state: AppState): AppState {
  if (state.venues.length > 0) return state;
  const theaterId = state.activeTheaterId ?? state.theaters[0]?.id;
  if (!theaterId) return state;
  return { ...state, venues: [{ ...createDefaultVenue(), theaterId }] };
}

function parseSavedState(raw: string): AppState | null {
  try {
    const data = JSON.parse(raw) as unknown;
    return migrateState(data);
  } catch (error) {
    console.error('[rehearsals] Ошибка чтения localStorage', error);
    return null;
  }
}

function prepareNewRehearsal(state: AppState, rehearsalPayload: Rehearsal): Rehearsal {
  const rehearsalWithTheater = {
    ...rehearsalPayload,
    theaterId: rehearsalPayload.theaterId ?? state.activeTheaterId ?? undefined,
  };
  const schedule = rehearsalWithTheater.schedule;
  const sceneIds =
    rehearsalWithTheater.sceneIds.length > 0
      ? rehearsalWithTheater.sceneIds
      : getSceneIdsFromSchedule(schedule);
  const actorIds = mergeActorsForSceneIds(state, rehearsalWithTheater, sceneIds);
  const rehearsalDraft = { ...rehearsalWithTheater, schedule, sceneIds, actorIds };
  return {
    ...rehearsalDraft,
    participantOrder: resolveParticipantOrder(state, rehearsalDraft),
  };
}

type Action =
  | { type: 'LOAD'; payload: AppState }
  | { type: 'UPDATE_APP_META'; payload: NonNullable<AppState['appMeta']> }
  | { type: 'SET_ACTIVE_THEATER'; payload: string }
  | { type: 'ADD_THEATER'; payload: Theater }
  | { type: 'UPDATE_THEATER'; payload: Theater }
  | { type: 'DELETE_THEATER'; payload: string }
  | { type: 'SET_ACTIVE_PLAY'; payload: string }
  | { type: 'SET_SELECTED_PERFORMANCE'; payload: { playId: string; performanceId: string } }
  | { type: 'ADD_PLAY'; payload: Play }
  | { type: 'UPDATE_PLAY'; payload: Play }
  | { type: 'DELETE_PLAY'; payload: string }
  | { type: 'ADD_PLAY_ROLE'; payload: PlayRole }
  | { type: 'UPDATE_PLAY_ROLE'; payload: PlayRole }
  | { type: 'DELETE_PLAY_ROLE'; payload: string }
  | { type: 'ADD_PERFORMANCE'; payload: Performance }
  | { type: 'UPDATE_PERFORMANCE'; payload: Performance }
  | { type: 'DELETE_PERFORMANCE'; payload: string }
  | { type: 'ADD_CAST_ASSIGNMENT'; payload: CastAssignment }
  | { type: 'DELETE_CAST_ASSIGNMENT'; payload: string }
  | { type: 'ADD_ACTOR'; payload: Actor }
  | { type: 'UPDATE_ACTOR'; payload: Actor }
  | { type: 'DELETE_ACTOR'; payload: string }
  | { type: 'ADD_SCENE'; payload: Scene }
  | { type: 'UPDATE_SCENE'; payload: Scene }
  | {
      type: 'APPLY_SCENE_SCRIPT_ANCHORS';
      payload: {
        playId: string;
        syncedAt: string;
        updates: { sceneId: string; scriptAnchor?: Scene['scriptAnchor'] }[];
      };
    }
  | {
      type: 'APPLY_SCENE_CHARACTER_COUNTS';
      payload: {
        playId: string;
        syncedAt: string;
        applyRehearsalMinutes: boolean;
        updates: { sceneId: string; characterCount: number }[];
      };
    }
  | { type: 'DELETE_SCENE'; payload: string }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'ADD_VENUE'; payload: Venue }
  | { type: 'UPDATE_VENUE'; payload: Venue }
  | { type: 'DELETE_VENUE'; payload: string }
  | { type: 'ADD_REHEARSAL'; payload: Rehearsal }
  | { type: 'UPDATE_REHEARSAL'; payload: Rehearsal }
  | { type: 'DELETE_REHEARSAL'; payload: string }
  | { type: 'ADD_REHEARSAL_TEMPLATE'; payload: RehearsalTemplate }
  | { type: 'DELETE_REHEARSAL_TEMPLATE'; payload: string }
  | {
      type: 'ADD_REHEARSAL_SERIES';
      payload: {
        series: RehearsalSeries;
        template?: RehearsalTemplate;
        rehearsals: Rehearsal[];
      };
    }
  | { type: 'UPDATE_SCHEDULE'; payload: { rehearsalId: string; schedule: ScheduleBlock[] } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD':
      return action.payload;
    case 'UPDATE_APP_META':
      return touchAppMeta(state, action.payload);
    case 'SET_ACTIVE_THEATER': {
      const nextPlayId = state.plays.find((play) => play.theaterId === action.payload)?.id ?? null;
      return { ...state, activeTheaterId: action.payload, activePlayId: nextPlayId };
    }
    case 'ADD_THEATER':
      return {
        ...state,
        theaters: [...state.theaters, action.payload],
        activeTheaterId: action.payload.id,
        activePlayId: null,
      };
    case 'UPDATE_THEATER':
      return {
        ...state,
        theaters: state.theaters.map((theater) =>
          theater.id === action.payload.id ? action.payload : theater
        ),
      };
    case 'DELETE_THEATER': {
      if (state.theaters.length <= 1) return state;
      const theaters = state.theaters.filter((theater) => theater.id !== action.payload);
      const activeTheaterId =
        state.activeTheaterId === action.payload ? theaters[0]?.id ?? null : state.activeTheaterId;
      const activePlayId =
        state.activePlayId &&
        state.plays.some((play) => play.id === state.activePlayId && play.theaterId === activeTheaterId)
          ? state.activePlayId
          : state.plays.find((play) => play.theaterId === activeTheaterId)?.id ?? null;
      const removedPlayIds = new Set(
        state.plays.filter((play) => play.theaterId === action.payload).map((play) => play.id)
      );
      return {
        ...state,
        theaters,
        activeTheaterId,
        activePlayId,
        actors: state.actors.filter((actor) => actor.theaterId !== action.payload),
        plays: state.plays.filter((play) => play.theaterId !== action.payload),
        playRoles: state.playRoles.filter((role) => !removedPlayIds.has(role.playId)),
        performances: state.performances.filter((performance) => !removedPlayIds.has(performance.playId)),
        castAssignments: state.castAssignments.filter((assignment) => !removedPlayIds.has(assignment.playId)),
        scenes: state.scenes.filter((scene) => !removedPlayIds.has(scene.playId)),
        tasks: state.tasks.filter((task) => task.theaterId !== action.payload),
        venues: state.venues.filter((venue) => venue.theaterId !== action.payload),
        rehearsals: state.rehearsals.filter((rehearsal) => rehearsal.theaterId !== action.payload),
        appMeta: {
          ...state.appMeta,
          rehearsalTemplates: (state.appMeta?.rehearsalTemplates ?? []).filter(
            (template) => template.theaterId !== action.payload
          ),
          rehearsalSeries: (state.appMeta?.rehearsalSeries ?? []).filter(
            (series) => series.theaterId !== action.payload
          ),
        },
      };
    }
    case 'SET_ACTIVE_PLAY':
      return { ...state, activePlayId: action.payload };
    case 'SET_SELECTED_PERFORMANCE':
      return {
        ...state,
        selectedPerformanceByPlayId: {
          ...state.selectedPerformanceByPlayId,
          [action.payload.playId]: action.payload.performanceId,
        },
      };
    case 'ADD_PLAY': {
      const play = { ...action.payload, theaterId: action.payload.theaterId ?? state.activeTheaterId ?? undefined };
      const isFirstInTheater = state.plays.every((item) => item.theaterId !== play.theaterId);
      const defaultPerformance: Performance = {
        id: generateId(),
        playId: play.id,
        name: 'Основной состав',
        isDefault: true,
      };
      return {
        ...state,
        plays: [...state.plays, play],
        activePlayId: isFirstInTheater ? play.id : state.activePlayId,
        performances: [...state.performances, defaultPerformance],
      };
    }
    case 'UPDATE_PLAY':
      return {
        ...state,
        plays: state.plays.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'DELETE_PLAY': {
      const remaining = state.plays.filter((p) => p.id !== action.payload);
      let activePlayId = state.activePlayId;
      if (activePlayId === action.payload) {
        activePlayId = remaining[0]?.id ?? null;
      }
      const { [action.payload]: _removed, ...selectedPerformanceByPlayId } =
        state.selectedPerformanceByPlayId ?? {};
      return {
        ...state,
        plays: remaining,
        activePlayId,
        selectedPerformanceByPlayId,
        playRoles: state.playRoles.filter((r) => r.playId !== action.payload),
        performances: state.performances.filter((p) => p.playId !== action.payload),
        castAssignments: state.castAssignments.filter((a) => a.playId !== action.payload),
        scenes: state.scenes.filter((s) => s.playId !== action.payload),
        rehearsals: state.rehearsals.map((r) =>
          r.playId === action.payload
            ? { ...r, playId: undefined, performanceId: undefined }
            : r
        ),
      };
    }
    case 'ADD_PLAY_ROLE':
      return { ...state, playRoles: [...state.playRoles, action.payload] };
    case 'UPDATE_PLAY_ROLE':
      return {
        ...state,
        playRoles: state.playRoles.map((r) =>
          r.id === action.payload.id ? action.payload : r
        ),
      };
    case 'DELETE_PLAY_ROLE': {
      return {
        ...state,
        playRoles: state.playRoles.filter((r) => r.id !== action.payload),
        castAssignments: state.castAssignments.filter((a) => a.roleId !== action.payload),
      };
    }
    case 'ADD_CAST_ASSIGNMENT':
      return {
        ...state,
        castAssignments: [...state.castAssignments, action.payload],
      };
    case 'DELETE_CAST_ASSIGNMENT':
      return {
        ...state,
        castAssignments: state.castAssignments.filter((a) => a.id !== action.payload),
      };
    case 'ADD_PERFORMANCE':
      return { ...state, performances: [...state.performances, action.payload] };
    case 'UPDATE_PERFORMANCE':
      return {
        ...state,
        performances: state.performances.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'DELETE_PERFORMANCE': {
      const performance = state.performances.find((p) => p.id === action.payload);
      if (performance?.isDefault) return state;
      return {
        ...state,
        performances: state.performances.filter((p) => p.id !== action.payload),
        castAssignments: state.castAssignments.filter(
          (a) => a.performanceId !== action.payload
        ),
        rehearsals: state.rehearsals.map((r) =>
          r.performanceId === action.payload ? { ...r, performanceId: undefined } : r
        ),
      };
    }
    case 'ADD_ACTOR':
      return {
        ...state,
        actors: [
          ...state.actors,
          { ...action.payload, theaterId: action.payload.theaterId ?? state.activeTheaterId ?? undefined },
        ],
      };
    case 'UPDATE_ACTOR':
      return {
        ...state,
        actors: state.actors.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case 'DELETE_ACTOR':
      return {
        ...state,
        actors: state.actors.filter((a) => a.id !== action.payload),
        castAssignments: state.castAssignments.filter((a) => a.actorId !== action.payload),
      };
    case 'ADD_SCENE':
      return { ...state, scenes: [...state.scenes, action.payload] };
    case 'UPDATE_SCENE':
      return {
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case 'APPLY_SCENE_SCRIPT_ANCHORS': {
      const updateMap = new Map(
        action.payload.updates.map((update) => [update.sceneId, update.scriptAnchor])
      );
      return {
        ...state,
        plays: state.plays.map((play) =>
          play.id === action.payload.playId
            ? { ...play, googleDocsLinksSyncedAt: action.payload.syncedAt }
            : play
        ),
        scenes: state.scenes.map((scene) => {
          if (scene.playId !== action.payload.playId) return scene;
          if (!updateMap.has(scene.id)) return scene;
          return { ...scene, scriptAnchor: updateMap.get(scene.id) };
        }),
      };
    }
    case 'APPLY_SCENE_CHARACTER_COUNTS': {
      const updateMap = new Map(
        action.payload.updates.map((update) => [update.sceneId, update.characterCount])
      );
      const settings = resolveSceneTimingSettings(state.appMeta);
      return {
        ...state,
        scenes: state.scenes.map((scene) => {
          if (scene.playId !== action.payload.playId) return scene;
          const characterCount = updateMap.get(scene.id);
          if (characterCount === undefined) return scene;
          return {
            ...scene,
            scriptCharacterCount: characterCount,
            scriptCharacterCountSyncedAt: action.payload.syncedAt,
            ...(action.payload.applyRehearsalMinutes && characterCount > 0
              ? {
                  estimatedMinutes: estimateRehearsalMinutes(characterCount, settings),
                }
              : {}),
          };
        }),
      };
    }
    case 'DELETE_SCENE':
      return {
        ...state,
        scenes: state.scenes.filter((s) => s.id !== action.payload),
      };
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [
          ...state.tasks,
          { ...action.payload, theaterId: action.payload.theaterId ?? state.activeTheaterId ?? undefined },
        ],
      };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };
    case 'ADD_VENUE':
      return {
        ...state,
        venues: [
          ...state.venues,
          { ...action.payload, theaterId: action.payload.theaterId ?? state.activeTheaterId ?? undefined },
        ],
      };
    case 'UPDATE_VENUE':
      return {
        ...state,
        venues: state.venues.map((v) =>
          v.id === action.payload.id ? action.payload : v
        ),
      };
    case 'DELETE_VENUE':
      return {
        ...state,
        venues: state.venues.filter((v) => v.id !== action.payload),
        rehearsals: state.rehearsals.map((r) =>
          r.venueId === action.payload ? { ...r, venueId: undefined } : r
        ),
      };
    case 'ADD_REHEARSAL':
      return {
        ...state,
        rehearsals: [...state.rehearsals, prepareNewRehearsal(state, action.payload)],
      };
    case 'UPDATE_REHEARSAL': {
      const previous = state.rehearsals.find((r) => r.id === action.payload.id);
      const schedule = removeDeselectedScenesFromSchedule(
        { schedule: action.payload.schedule, startTime: action.payload.startTime },
        action.payload.sceneIds
      );
      const sceneIds = action.payload.sceneIds;
      const actorIds = previous
        ? mergeActorsForNewScenes(state, action.payload, previous.sceneIds, sceneIds)
        : action.payload.actorIds;
      const rehearsalDraft = clearRemindersOnScheduleChange(
        { ...action.payload, schedule, sceneIds, actorIds },
        previous
      );
      const participantOrder = resolveParticipantOrder(state, {
        ...rehearsalDraft,
        participantOrder: action.payload.participantOrder ?? previous?.participantOrder,
      });
      return {
        ...state,
        rehearsals: state.rehearsals.map((r) =>
          r.id === action.payload.id ? { ...rehearsalDraft, participantOrder } : r
        ),
      };
    }
    case 'DELETE_REHEARSAL':
      return {
        ...state,
        rehearsals: state.rehearsals.filter((r) => r.id !== action.payload),
      };
    case 'ADD_REHEARSAL_TEMPLATE':
      return {
        ...state,
        appMeta: {
          ...state.appMeta,
          rehearsalTemplates: [...(state.appMeta?.rehearsalTemplates ?? []), action.payload],
        },
      };
    case 'DELETE_REHEARSAL_TEMPLATE':
      return {
        ...state,
        appMeta: {
          ...state.appMeta,
          rehearsalTemplates: (state.appMeta?.rehearsalTemplates ?? []).filter(
            (template) => template.id !== action.payload
          ),
          rehearsalSeries: (state.appMeta?.rehearsalSeries ?? []).map((series) =>
            series.templateId === action.payload ? { ...series, templateId: undefined } : series
          ),
        },
      };
    case 'ADD_REHEARSAL_SERIES': {
      const { series, template, rehearsals } = action.payload;
      const templates = [...(state.appMeta?.rehearsalTemplates ?? [])];
      if (template) templates.push(template);
      const prepared = rehearsals.map((rehearsal) => prepareNewRehearsal(state, rehearsal));
      return {
        ...state,
        appMeta: {
          ...state.appMeta,
          rehearsalTemplates: templates,
          rehearsalSeries: [...(state.appMeta?.rehearsalSeries ?? []), series],
        },
        rehearsals: [...state.rehearsals, ...prepared],
      };
    }
    case 'UPDATE_SCHEDULE':
      return {
        ...state,
        rehearsals: state.rehearsals.map((r) => {
          if (r.id !== action.payload.rehearsalId) return r;
          const actorIds = mergeActorsForNewScheduleBlocks(state, r, action.payload.schedule);
          const rehearsalDraft = { ...r, schedule: action.payload.schedule, actorIds };
          return {
            ...rehearsalDraft,
            participantOrder: resolveParticipantOrder(state, rehearsalDraft),
          };
        }),
      };
    default:
      return state;
  }
}

interface RehearsalContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  ready: boolean;
  loadError: string | null;
  saveError: string | null;
  saveStatus: SaveStatus;
  backupFiles: string[];
  readOnly: boolean;
  restoreLatestBackup: () => Promise<void>;
  retryConnection: () => void;
}

const RehearsalContext = createContext<RehearsalContextValue | null>(null);

export function RehearsalProvider({ children }: { children: ReactNode }) {
  const { canEditTheater, refreshSession } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const stateRef = useRef(state);
  const saveTimerRef = useRef<number | null>(null);
  stateRef.current = state;
  const readOnly = !canEditTheater(state.activeTheaterId);

  const retryConnection = () => setLoadAttempt((value) => value + 1);

  const restoreLatestBackup = async () => {
    const files = await fetchBackupList();
    if (files.length === 0) return;
    const restored = await restoreBackupState(files[0]);
    const bootstrapped = bootstrapAppState(restored);
    await saveAppStateWithRetry(bootstrapped);
    mirrorLocalStorage(bootstrapped);
    dispatch({ type: 'LOAD', payload: bootstrapped });
    setSaveError(null);
    setSaveStatus('saved');
    setBackupFiles(files);
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);

    void refreshSession()
      .then((session) => {
        if (cancelled) return null;
        const theaterIds = new Set(session?.theaters.map((entry) => entry.theaterId) ?? []);
        return loadInitialAppState(theaterIds);
      })
      .then((loaded) => {
        if (cancelled || !loaded) return;
        dispatch({ type: 'LOAD', payload: loaded });
        setSaveStatus('saved');
        setSaveError(null);
        setReady(true);
        void fetchBackupList().then((files) => {
          if (!cancelled) setBackupFiles(files);
        });
      })
      .catch((error) => {
        console.error('[rehearsals] Ошибка загрузки', error);
        if (!cancelled) {
          setLoadError(formatSaveError(error));
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, refreshSession]);

  useEffect(() => {
    if (!ready || loadError) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistToStorage(stateRef.current, setSaveError, setSaveStatus, readOnly, refreshSession);
    }, 200);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        persistToStorage(stateRef.current, setSaveError, setSaveStatus, readOnly, refreshSession);
      }
    };
  }, [state, ready, loadError, readOnly, refreshSession]);

  useEffect(() => {
    if (!ready || loadError) return;

    return () => {
      persistToStorage(stateRef.current, setSaveError, setSaveStatus, readOnly, refreshSession);
    };
  }, [ready, loadError, readOnly, refreshSession]);

  useLayoutEffect(() => {
    if (!ready || loadError || readOnly) return;

    const saveOnClose = () => {
      void saveAppStateWithRetry(stateRef.current, { keepalive: true, attempts: 1 })
        .then(() => {
          mirrorLocalStorage(stateRef.current);
        })
        .catch(() => {
          // При закрытии вкладки браузер может оборвать keepalive-запрос.
        });
    };
    window.addEventListener('beforeunload', saveOnClose);
    window.addEventListener('pagehide', saveOnClose);
    return () => {
      window.removeEventListener('beforeunload', saveOnClose);
      window.removeEventListener('pagehide', saveOnClose);
    };
  }, [ready, loadError, readOnly]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted">
        Загрузка данных…
      </div>
    );
  }

  if (loadError) {
    const isPermissionError = loadError.includes('прав');
    const isAuthError = loadError.includes('Сессия истекла');
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="text-xl font-semibold text-white">
            {isPermissionError || isAuthError ? 'Не удалось загрузить данные' : 'База данных недоступна'}
          </h1>
          <p className="text-red-300">{loadError}</p>
          {isPermissionError ? (
            <p className="text-sm text-muted">
              В браузере могли остаться старые данные до входа. Нажмите «Повторить» — приложение
              загрузит только театры, к которым у вас есть доступ.
            </p>
          ) : isAuthError ? (
            <p className="text-sm text-muted">
              <a href="/login" className="text-gold-light hover:underline">
                Войти снова
              </a>
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                {isLocalDevHost() ? (
                  <>
                    Все данные хранятся в SQLite (
                    <code className="rounded bg-white/5 px-1">data\rehearsals.db</code>). Без API-сервера
                    приложение не может загрузить и сохранить ваши репетиции.
                  </>
                ) : (
                  <>Не удалось связаться с сервером приложения. Данные на сервере в безопасности.</>
                )}
              </p>
              {isLocalDevHost() ? (
                <ol className="text-left text-sm text-muted">
                  <li>1. Закройте это окно браузера</li>
                  <li>2. Запустите <code className="rounded bg-white/5 px-1">restart.bat</code></li>
                  <li>3. Дождитесь строки <code className="rounded bg-white/5 px-1">[api] http://localhost:3001</code></li>
                  <li>4. Откройте <code className="rounded bg-white/5 px-1">http://localhost:3003</code></li>
                </ol>
              ) : (
                <p className="text-sm text-muted">
                  Нажмите «Повторить подключение» или обновите страницу. Если ошибка повторяется — выйдите и войдите снова.
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={retryConnection}
            className="rounded-xl bg-gold/20 px-4 py-2 text-sm text-gold-light ring-1 ring-gold/30 hover:bg-gold/30"
          >
            Повторить подключение
          </button>
        </div>
      </div>
    );
  }

  return (
    <RehearsalContext.Provider
      value={{
        state,
        dispatch,
        ready,
        loadError,
        saveError,
        saveStatus,
        backupFiles,
        readOnly,
        restoreLatestBackup,
        retryConnection,
      }}
    >
      {children}
    </RehearsalContext.Provider>
  );
}

export function useRehearsalStore() {
  const ctx = useContext(RehearsalContext);
  if (!ctx) throw new Error('useRehearsalStore must be used within RehearsalProvider');
  return ctx;
}
