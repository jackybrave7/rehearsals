import type { AppState, Play } from '../types';
import {
  DEMO_CHAIKA_GOOGLE_DOC_URL,
  DEMO_CHAIKA_SCRIPT_FILE_NAME,
  DEMO_CHAIKA_SCRIPT_FILE_URL,
  DEMO_CHAIKA_SCRIPT_MIME,
} from '../data/demoChaikaPlayMaterial';
import { DEMO_CHAIKA_PLAY_META } from '../data/demoChaika';
import { enrichPlayDocumentMeta } from './googleDocs';
import { isDemoTheater } from './demoTheaterIdentity';

const DEMO_SCRIPT_SIZE_BYTES = 86_874;

function withDemoChaikaMaterial(play: Play): Play {
  return enrichPlayDocumentMeta({
    ...play,
    documentUrl: play.documentUrl?.trim() || DEMO_CHAIKA_GOOGLE_DOC_URL,
    scriptFileName: play.scriptFileName ?? DEMO_CHAIKA_SCRIPT_FILE_NAME,
    scriptFileUrl: play.scriptFileUrl ?? DEMO_CHAIKA_SCRIPT_FILE_URL,
    scriptFileMimeType: play.scriptFileMimeType ?? DEMO_CHAIKA_SCRIPT_MIME,
    scriptFileSize: play.scriptFileSize ?? DEMO_SCRIPT_SIZE_BYTES,
    description:
      play.description?.trim() || DEMO_CHAIKA_PLAY_META.description,
  });
}

export function migrateDemoChaikaPlayMaterial(state: AppState): AppState {
  const demoTheaterIds = new Set(state.theaters.filter(isDemoTheater).map((theater) => theater.id));
  if (demoTheaterIds.size === 0) return state;

  let changed = false;
  const plays = state.plays.map((play) => {
    if (!play.theaterId || !demoTheaterIds.has(play.theaterId)) return play;
    if (play.title !== DEMO_CHAIKA_PLAY_META.title) return play;

    const needsGoogle = !play.documentUrl?.includes('docs.google.com');
    const needsFile = play.scriptFileUrl !== DEMO_CHAIKA_SCRIPT_FILE_URL;
    if (!needsGoogle && !needsFile) return play;

    changed = true;
    return withDemoChaikaMaterial(play);
  });

  return changed ? { ...state, plays } : state;
}
