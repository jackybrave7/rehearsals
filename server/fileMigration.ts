import type { AppState } from '../src/types/index.js';
import type { AppDatabase } from './db.js';
import { publicFileUrl, saveDataUrlAsFile } from './fileStorage.js';

const MIGRATION_VERSION = '1';

export function migrateEmbeddedFilesIfNeeded(
  state: AppState,
  userId: string,
  db: AppDatabase
): { state: AppState; changed: boolean } {
  if (state.appMeta?.filesMigratedVersion === MIGRATION_VERSION) {
    return { state, changed: false };
  }

  let changed = false;

  const actors = state.actors.map((actor) => {
    if (!actor.photoUrl?.startsWith('data:')) return actor;
    try {
      const stored = saveDataUrlAsFile(
        db,
        userId,
        actor.photoUrl,
        `${actor.name || 'actor'}-photo`
      );
      changed = true;
      return { ...actor, photoUrl: publicFileUrl(stored.id) };
    } catch (error) {
      console.error(`[files] failed to migrate photo for actor ${actor.id}`, error);
      return actor;
    }
  });

  const plays = state.plays.map((play) => {
    if (!play.scriptFileDataUrl?.startsWith('data:')) return play;
    try {
      const stored = saveDataUrlAsFile(
        db,
        userId,
        play.scriptFileDataUrl,
        play.scriptFileName ?? `${play.title}-script`
      );
      changed = true;
      return {
        ...play,
        scriptFileUrl: publicFileUrl(stored.id),
        scriptFileDataUrl: undefined,
      };
    } catch (error) {
      console.error(`[files] failed to migrate script for play ${play.id}`, error);
      return play;
    }
  });

  if (!changed) {
    return {
      state: {
        ...state,
        appMeta: { ...state.appMeta, filesMigratedVersion: MIGRATION_VERSION },
      },
      changed: true,
    };
  }

  return {
    state: {
      ...state,
      actors,
      plays,
      appMeta: { ...state.appMeta, filesMigratedVersion: MIGRATION_VERSION },
    },
    changed: true,
  };
}
