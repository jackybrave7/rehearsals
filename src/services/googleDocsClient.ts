import {
  countSceneCharactersFromGoogleDoc,
  extractDocTextAnchors,
  matchScenesToDocAnchors,
  parseGoogleDocumentId,
  type SceneAnchorMatch,
  type GoogleDocsDocument,
} from '../utils/googleDocs';
import type { Scene } from '../types';

export class GoogleDocsClientError extends Error {
  code: string;
  details?: string;

  constructor(code: string, details?: string) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

async function readApiError(response: Response): Promise<{ error?: string; message?: string } | null> {
  try {
    return (await response.json()) as { error?: string; message?: string };
  } catch {
    return null;
  }
}

export async function fetchGoogleDocument(
  documentId: string,
  accessToken: string
): Promise<GoogleDocsDocument> {
  let response: Response;

  try {
    response = await fetch(`/api/google-docs/documents/${encodeURIComponent(documentId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new GoogleDocsClientError(
      'NETWORK_ERROR',
      'Не удалось связаться с локальным API. Убедитесь, что сервер запущен (restart.bat).'
    );
  }

  if (!response.ok) {
    const body = await readApiError(response);
    const code = body?.error ?? `API_ERROR_${response.status}`;
    throw new GoogleDocsClientError(code, body?.message);
  }

  return response.json();
}

export async function syncSceneAnchorsFromGoogleDoc(
  documentUrl: string,
  scenes: Scene[],
  accessToken: string
): Promise<{
  matches: SceneAnchorMatch[];
  anchorCount: number;
}> {
  const documentId = parseGoogleDocumentId(documentUrl);
  if (!documentId) {
    throw new GoogleDocsClientError('INVALID_URL');
  }

  const document = await fetchGoogleDocument(documentId, accessToken);
  const docAnchors = extractDocTextAnchors(document);
  const matches = matchScenesToDocAnchors(scenes, docAnchors);

  return { matches, anchorCount: docAnchors.length };
}

export async function syncSceneCharacterCountsFromGoogleDoc(
  documentUrl: string,
  scenes: Scene[],
  accessToken: string
): Promise<Map<string, number>> {
  const documentId = parseGoogleDocumentId(documentUrl);
  if (!documentId) {
    throw new GoogleDocsClientError('INVALID_URL');
  }

  const document = await fetchGoogleDocument(documentId, accessToken);
  return countSceneCharactersFromGoogleDoc(document, scenes);
}

export function resolveGoogleDocsSyncError(error: unknown): string {
  if (!(error instanceof GoogleDocsClientError)) {
    return 'Не удалось загрузить документ через Google Docs API.';
  }

  switch (error.code) {
    case 'AUTH_EXPIRED':
    case 'AUTH_REQUIRED':
      return 'Сессия Google истекла. Войдите снова и повторите синхронизацию.';
    case 'ACCESS_DENIED':
      return 'Нет доступа к документу. Откройте его в Google Docs под тем же аккаунтом, с которым вы вошли.';
    case 'API_DISABLED':
      return 'Google Docs API не включён в Google Cloud Console. Включите API и повторите попытку.';
    case 'NOT_FOUND':
      return 'Документ не найден. Проверьте ссылку в карточке постановки.';
    case 'INVALID_URL':
      return 'Некорректная ссылка на Google Docs в карточке постановки.';
    case 'OFFICE_FILE':
      return (
        'Ссылка ведёт на загруженный Word/PDF, а не на нативный Google Документ — API его не читает. ' +
        'Откройте файл в Google Docs → Файл → «Сохранить как Google Документ» (или создайте копию в формате Google Docs), ' +
        'затем вставьте новую ссылку в карточке постановки и повторите сопоставление.'
      );
    case 'NETWORK_ERROR':
      return error.details ?? 'Сетевая ошибка при обращении к API.';
    case 'FETCH_FAILED':
      return 'Локальный сервер не смог загрузить документ из Google. Перезапустите приложение.';
    default:
      if (
        error.details &&
        /office file|not supported for this document/i.test(error.details)
      ) {
        return resolveGoogleDocsSyncError(new GoogleDocsClientError('OFFICE_FILE', error.details));
      }
      if (error.details) {
        return `Google Docs API: ${error.details}`;
      }
      return 'Не удалось загрузить документ через Google Docs API.';
  }
}
