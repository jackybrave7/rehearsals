import type { Play, Scene } from '../types';
import { parseScriptFileId } from './scriptDocument';
import { API_BASE } from '../api/apiBase';

export type SceneLearnTextSource = 'script_file' | 'google_docs' | 'none';

export interface SceneLearnTextResult {
  text: string | null;
  source: SceneLearnTextSource;
}

async function fetchSceneBodyFromScriptFile(
  play: Play,
  scene: Scene
): Promise<string | null> {
  const fileId = parseScriptFileId(play.scriptFileUrl);
  if (!fileId) {
    return null;
  }

  const response = await fetch(`${API_BASE}/script-import/scene-body`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, scene }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { text?: string };
  return data.text?.trim() || null;
}

export async function fetchSceneLearnText(
  play: Play,
  scene: Scene,
  theaterId?: string | null
): Promise<SceneLearnTextResult> {
  if (theaterId) {
    try {
      const response = await fetch(
        `${API_BASE}/actor/me/scenes/${encodeURIComponent(scene.id)}/learn-text?theaterId=${encodeURIComponent(theaterId)}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = (await response.json()) as SceneLearnTextResult;
        if (data.text) {
          return { text: data.text, source: data.source ?? 'script_file' };
        }
      }
    } catch {
      // fall through to client-side loaders
    }
  }

  const fromFile = await fetchSceneBodyFromScriptFile(play, scene);
  if (fromFile) {
    return { text: fromFile, source: 'script_file' };
  }

  return { text: null, source: 'none' };
}
