import { API_BASE } from './apiBase';

export const MAX_OUTCOME_VIDEOS_PER_REHEARSAL = 10;
export const MAX_OUTCOME_VIDEO_BYTES = 30 * 1024 * 1024;

export interface UploadedOutcomeVideo {
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export function formatOutcomeVideoUploadError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'FILE_TOO_LARGE') return 'Видео слишком большое. Максимум — 30 МБ.';
  if (code === 'INVALID_VIDEO_LINK') {
    return 'Не удалось распознать ссылку. Поддерживаются YouTube, Rutube, Vimeo и VK Видео.';
  }
  if (code === 'INVALID_VIDEO_TYPE') return 'Поддерживаются MP4, WebM и MOV.';
  if (code === 'SUBSCRIPTION_PRO_REQUIRED') return 'Итоговые видео доступны на тарифе Pro.';
  if (code === 'TOO_MANY_VIDEOS') {
    return `Слишком много видео для одной репетиции (максимум ${MAX_OUTCOME_VIDEOS_PER_REHEARSAL}).`;
  }
  if (code === 'S3_NOT_CONFIGURED') return 'Хранилище не настроено на сервере.';
  if (code === 'UNAUTHORIZED') return 'Сессия истекла — обновите страницу и войдите снова.';
  return 'Не удалось загрузить видео. Проверьте формат и подключение.';
}

const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function validateOutcomeVideoFile(file: File): string | null {
  const mime = file.type || guessVideoMimeFromName(file.name);
  if (!mime || !ALLOWED_VIDEO_TYPES.has(mime)) {
    return 'Поддерживаются MP4, WebM и MOV.';
  }
  if (file.size > MAX_OUTCOME_VIDEO_BYTES) {
    return 'Видео слишком большое. Максимум — 30 МБ.';
  }
  return null;
}

function guessVideoMimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  return null;
}

async function readFileBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('INVALID_FILE');
  return base64;
}

export async function uploadRehearsalOutcomeVideo(
  rehearsalId: string,
  file: File
): Promise<UploadedOutcomeVideo> {
  const validationError = validateOutcomeVideoFile(file);
  if (validationError) throw new Error(validationError);

  const mimeType = file.type || guessVideoMimeFromName(file.name) || 'video/mp4';
  const dataBase64 = await readFileBase64(file);
  const response = await fetch(`${API_BASE}/rehearsals/${rehearsalId}/outcome-videos`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      mimeType,
      dataBase64,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401) throw new Error('UNAUTHORIZED');
    if (response.status === 402) throw new Error('SUBSCRIPTION_PRO_REQUIRED');
    throw new Error(data?.error ?? `UPLOAD_${response.status}`);
  }

  return response.json() as Promise<UploadedOutcomeVideo>;
}

export async function addRehearsalOutcomeVideoLink(
  rehearsalId: string,
  linkUrl: string
): Promise<{ url: string; provider: string }> {
  const trimmed = linkUrl.trim();
  if (!trimmed) throw new Error('INVALID_VIDEO_LINK');

  const response = await fetch(`${API_BASE}/rehearsals/${rehearsalId}/outcome-videos`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ linkUrl: trimmed }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401) throw new Error('UNAUTHORIZED');
    if (response.status === 402) throw new Error('SUBSCRIPTION_PRO_REQUIRED');
    throw new Error(data?.error ?? `LINK_${response.status}`);
  }

  return response.json() as Promise<{ url: string; provider: string }>;
}

export async function deleteRehearsalOutcomeVideo(
  rehearsalId: string,
  url: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/rehearsals/${rehearsalId}/outcome-videos`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401) throw new Error('UNAUTHORIZED');
    if (response.status === 402) throw new Error('SUBSCRIPTION_PRO_REQUIRED');
    throw new Error(data?.error ?? `DELETE_${response.status}`);
  }
}
