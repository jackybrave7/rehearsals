import type { AppState } from '../src/types/index.js';
import type { AuthSessionPayload } from './authTypes.js';
import { canEditTheater } from './auth.js';
import { backupState } from './backup.js';
import { getDb, type AppDatabase } from './db.js';
import {
  deleteTheaterContent,
  deleteTheaterData,
  filterStateByTheaters,
  insertStateEntities,
  isEmptyState,
  loadState,
  type LoadStateOptions,
  wouldLoseUserData,
} from './stateRepository.js';
import { migrateEmbeddedFilesIfNeeded } from './fileMigration.js';
import { validateSubscriptionLimits } from './subscription.js';

function getEditableTheaterIds(session: AuthSessionPayload): Set<string> {
  return new Set(
    session.theaters.filter((t) => t.role === 'owner' || t.role === 'editor').map((t) => t.theaterId)
  );
}

function getAccessibleTheaterIds(session: AuthSessionPayload): Set<string> {
  return new Set(session.theaters.map((t) => t.theaterId));
}

function getNewTheaterIdsForUser(
  db: AppDatabase,
  clientState: AppState,
  dbState: AppState,
  session: AuthSessionPayload
): Set<string> {
  const knownInDb = new Set(dbState.theaters.map((theater) => theater.id));
  const created = new Set<string>();

  for (const theater of clientState.theaters) {
    if (knownInDb.has(theater.id)) continue;

    const row = db.prepare(`SELECT owner_user_id FROM theaters WHERE id = ?`).get(theater.id) as
      | { owner_user_id: string | null }
      | undefined;

    if (row?.owner_user_id && row.owner_user_id !== session.user.id) {
      throw new Error('FORBIDDEN');
    }

    created.add(theater.id);
  }

  return created;
}

function expandTheaterAccess(
  session: AuthSessionPayload,
  newTheaterIds: Set<string>
): { accessibleIds: Set<string>; editableIds: Set<string> } {
  const accessibleIds = getAccessibleTheaterIds(session);
  const editableIds = getEditableTheaterIds(session);
  for (const theaterId of newTheaterIds) {
    accessibleIds.add(theaterId);
    editableIds.add(theaterId);
  }
  return { accessibleIds, editableIds };
}

function mergeStateForSave(
  clientState: AppState,
  dbState: AppState,
  editableIds: Set<string>,
  accessibleIds: Set<string>
): AppState {
  const observerIds = [...accessibleIds].filter((id) => !editableIds.has(id));
  const observerState = filterStateByTheaters(dbState, new Set(observerIds));
  const editableState = filterStateByTheaters(clientState, editableIds);

  return {
    theaters: [...editableState.theaters, ...observerState.theaters],
    activeTheaterId: clientState.activeTheaterId,
    actors: [...editableState.actors, ...observerState.actors],
    plays: [...editableState.plays, ...observerState.plays],
    activePlayId: clientState.activePlayId,
    selectedPerformanceByPlayId: clientState.selectedPerformanceByPlayId,
    playRoles: [...editableState.playRoles, ...observerState.playRoles],
    performances: [...editableState.performances, ...observerState.performances],
    castAssignments: [...editableState.castAssignments, ...observerState.castAssignments],
    scenes: [...editableState.scenes, ...observerState.scenes],
    tasks: [...editableState.tasks, ...observerState.tasks],
    venues: [...editableState.venues, ...observerState.venues],
    rehearsals: [...editableState.rehearsals, ...observerState.rehearsals],
    appMeta: clientState.appMeta,
  };
}

export function loadStateForUser(
  session: AuthSessionPayload,
  db: AppDatabase = getDb()
): AppState | null {
  const theaterIds = session.theaters.map((t) => t.theaterId);
  const options: LoadStateOptions = { userId: session.user.id, theaterIds };
  const loaded = loadState(db, options);
  if (!loaded) return null;

  const canMigrate = session.theaters.some((t) => t.role === 'owner' || t.role === 'editor');
  if (!canMigrate) return loaded;

  const { state: migrated, changed } = migrateEmbeddedFilesIfNeeded(loaded, session.user.id, db);
  if (changed) {
    saveStateForUser(migrated, session, db);
  }
  return migrated;
}

export function saveStateForUser(
  clientState: AppState,
  session: AuthSessionPayload,
  db: AppDatabase = getDb()
): void {
  const theaterIds = session.theaters.map((t) => t.theaterId);
  const loadOptions: LoadStateOptions = { userId: session.user.id, theaterIds };
  const dbState =
    loadState(db, loadOptions) ??
    ({
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
      appMeta: {},
    } satisfies AppState);

  const newTheaterIds = getNewTheaterIdsForUser(db, clientState, dbState, session);
  const { accessibleIds, editableIds } = expandTheaterAccess(session, newTheaterIds);

  for (const theater of clientState.theaters) {
    if (!accessibleIds.has(theater.id)) {
      throw new Error('FORBIDDEN');
    }
  }

  const mergedForCheck = mergeStateForSave(clientState, dbState, editableIds, accessibleIds);
  if (wouldLoseUserData(mergedForCheck, dbState)) {
    throw new Error('WOULD_LOSE_USER_DATA');
  }

  validateSubscriptionLimits(
    db,
    session.user.id,
    session.user.email,
    mergedForCheck,
    dbState,
    newTheaterIds
  );

  if (!isEmptyState(dbState)) {
    backupState(dbState);
  }

  const clientTheaterIds = new Set(clientState.theaters.map((t) => t.id));
  const editablePayload = filterStateByTheaters(clientState, editableIds);

  const ownerByTheaterId = new Map<string, string | null>();
  const addOwnerMembershipFor = new Set<string>();
  for (const theater of dbState.theaters) {
    if (!editableIds.has(theater.id)) continue;
    const row = db.prepare('SELECT owner_user_id FROM theaters WHERE id = ?').get(theater.id) as
      | { owner_user_id: string | null }
      | undefined;
    ownerByTheaterId.set(theater.id, row?.owner_user_id ?? session.user.id);
  }
  for (const theater of editablePayload.theaters) {
    if (!ownerByTheaterId.has(theater.id)) {
      ownerByTheaterId.set(theater.id, session.user.id);
      addOwnerMembershipFor.add(theater.id);
    }
  }

  const tx = db.transaction(() => {
    for (const theaterId of editableIds) {
      if (!newTheaterIds.has(theaterId) && !canEditTheater(session, theaterId)) continue;
      const existsInDb = dbState.theaters.some((t) => t.id === theaterId);
      const existsInClient = clientTheaterIds.has(theaterId);
      if (!existsInClient && existsInDb) {
        deleteTheaterData(db, theaterId);
      } else if (existsInClient && existsInDb) {
        deleteTheaterContent(db, theaterId);
      }
    }

    insertStateEntities(db, editablePayload, { ownerByTheaterId, addOwnerMembershipFor });

    db.prepare(
      `INSERT INTO user_settings (user_id, active_theater_id, active_play_id, selected_performance_by_play_id, app_meta)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         active_theater_id = excluded.active_theater_id,
         active_play_id = excluded.active_play_id,
         selected_performance_by_play_id = excluded.selected_performance_by_play_id,
         app_meta = excluded.app_meta`
    ).run(
      session.user.id,
      clientState.activeTheaterId,
      clientState.activePlayId,
      JSON.stringify(clientState.selectedPerformanceByPlayId ?? {}),
      JSON.stringify(clientState.appMeta ?? {})
    );
  });

  tx();
}
