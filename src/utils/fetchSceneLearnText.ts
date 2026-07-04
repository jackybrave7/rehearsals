import type { Play, Scene } from '../types';
import { fetchGoogleDocument } from '../services/googleDocsClient';
import {
  extractSceneLearnTextsFromGoogleDoc,
  parseGoogleDocumentId,
} from './googleDocs';
import { parseScriptFileId } from './scriptDocument';
import { API_BASE } from '../api/apiBase';

export type SceneLearnTextSource = 'script_file' | 'google_docs' | 'none';

export interface SceneLearnTextResult {
  text: string | null;
  source: SceneLearnTextSource;
  needsGoogleAuth?: boolean;
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

async function fetchSceneBodyFromGoogleDocs(
  play: Play,
  scene: Scene,
  accessToken: string
): Promise<string | null> {
  const documentId =
    play.googleDocumentId ?? (play.documentUrl ? parseGoogleDocumentId(play.documentUrl) : null);
  if (!documentId || !scene.scriptAnchor || scene.scriptAnchor.id.startsWith('file-')) {
    return null;
  }

  const document = await fetchGoogleDocument(documentId, accessToken);
  const texts = extractSceneLearnTextsFromGoogleDoc(document, [scene]);
  return texts.get(scene.id)?.trim() || null;
}

export async function fetchSceneLearnText(
  play: Play,
  scene: Scene,
  accessToken?: string | null,
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
        if (data.needsGoogleAuth) {
          return { text: null, source: 'none', needsGoogleAuth: true };
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

  const documentId =
    play.googleDocumentId ?? (play.documentUrl ? parseGoogleDocumentId(play.documentUrl) : null);
  const hasGoogleAnchor =
    Boolean(scene.scriptAnchor) && !scene.scriptAnchor?.id.startsWith('file-');

  if (documentId && hasGoogleAnchor) {
    if (accessToken) {
      try {
        const fromDocs = await fetchSceneBodyFromGoogleDocs(play, scene, accessToken);
        if (fromDocs) {
          return { text: fromDocs, source: 'google_docs' };
        }
      } catch {
        // fall through
      }
    }
    return { text: null, source: 'none', needsGoogleAuth: !accessToken };
  }

  return { text: null, source: 'none' };
}
