import type { PlayRole, Scene } from '../types';
import type { DocTextAnchor, SceneAnchorMatch } from '../utils/googleDocs';
import { API_BASE } from '../api/apiBase';

export class ScriptImportClientError extends Error {
  code: string;
  details?: string;

  constructor(code: string, details?: string) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

export async function parseScriptImport(
  fileId: string,
  scenes: Scene[],
  playRoles: PlayRole[] = []
): Promise<{
  matches: SceneAnchorMatch[];
  anchorCount: number;
  anchors: DocTextAnchor[];
  characterCounts: Record<string, number>;
  descriptions?: Record<string, string>;
  roleIds?: Record<string, string[]>;
}> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/script-import/parse`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        scenes: scenes.map((scene) => ({
          id: scene.id,
          playId: scene.playId,
          number: scene.number,
          title: scene.title,
        })),
        playRoles: playRoles
          .filter((role) => role.kind === 'character')
          .map((role) => ({
            id: role.id,
            playId: role.playId,
            name: role.name,
            kind: role.kind,
            description: role.description,
          })),
      }),
    });
  } catch {
    throw new ScriptImportClientError(
      'NETWORK_ERROR',
      'Не удалось связаться с сервером. Убедитесь, что API запущен.'
    );
  }

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
    matches?: SceneAnchorMatch[];
    anchorCount?: number;
    anchors?: DocTextAnchor[];
    descriptions?: Record<string, string>;
    roleIds?: Record<string, string[]>;
    characterCounts?: Record<string, number>;
  } | null;

  if (!response.ok) {
    throw new ScriptImportClientError(body?.error ?? `API_ERROR_${response.status}`, body?.message);
  }

  return {
    matches: body?.matches ?? [],
    anchorCount: body?.anchorCount ?? 0,
    anchors: body?.anchors ?? [],
    characterCounts: body?.characterCounts ?? {},
    descriptions: body?.descriptions ?? {},
    roleIds: body?.roleIds ?? {},
  };
}

export function resolveScriptImportError(error: unknown): string {
  if (!(error instanceof ScriptImportClientError)) {
    return 'Не удалось разобрать файл сценария.';
  }

  switch (error.code) {
    case 'UNSUPPORTED_FORMAT':
      return error.details ?? 'Поддерживаются только файлы .txt и .docx.';
    case 'NOT_FOUND':
      return 'Файл сценария не найден. Загрузите его снова в карточке постановки.';
    case 'NETWORK_ERROR':
      return error.details ?? 'Сетевая ошибка при обращении к API.';
    default:
      return error.details ?? 'Не удалось разобрать файл сценария.';
  }
}
