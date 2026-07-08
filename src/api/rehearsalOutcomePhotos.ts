import { API_BASE } from './apiBase';

export const MAX_OUTCOME_PHOTOS_PER_REHEARSAL = 50;

export interface UploadedOutcomePhoto {
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export function formatOutcomePhotoUploadError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'FILE_TOO_LARGE') return 'Фото слишком большое. Максимум — 10 МБ.';
  if (code === 'INVALID_IMAGE_TYPE') return 'Поддерживаются только JPEG, PNG, WebP и GIF.';
  if (code === 'SUBSCRIPTION_PRO_REQUIRED') return 'Итоговые фото доступны на тарифе Pro.';
  if (code === 'TOO_MANY_PHOTOS') {
    return `Слишком много фото для одной репетиции (максимум ${MAX_OUTCOME_PHOTOS_PER_REHEARSAL}).`;
  }
  if (code === 'S3_NOT_CONFIGURED') return 'Хранилище фото не настроено на сервере.';
  if (code === 'UNAUTHORIZED') return 'Сессия истекла — обновите страницу и войдите снова.';
  return 'Не удалось загрузить фото. Проверьте формат и подключение.';
}

const MAX_OUTCOME_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function validateOutcomePhotoFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Поддерживаются только JPEG, PNG, WebP и GIF.';
  }
  if (file.size > MAX_OUTCOME_PHOTO_BYTES) {
    return 'Фото слишком большое. Максимум — 10 МБ.';
  }
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

export async function uploadRehearsalOutcomePhoto(
  rehearsalId: string,
  file: File
): Promise<UploadedOutcomePhoto> {
  const validationError = validateOutcomePhotoFile(file);
  if (validationError) throw new Error(validationError);

  const dataBase64 = await readFileBase64(file);
  const response = await fetch(`${API_BASE}/rehearsals/${rehearsalId}/outcome-photos`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || 'image/jpeg',
      dataBase64,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401) throw new Error('UNAUTHORIZED');
    if (response.status === 402) throw new Error('SUBSCRIPTION_PRO_REQUIRED');
    throw new Error(data?.error ?? `UPLOAD_${response.status}`);
  }

  return response.json() as Promise<UploadedOutcomePhoto>;
}

export async function deleteRehearsalOutcomePhoto(
  rehearsalId: string,
  url: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/rehearsals/${rehearsalId}/outcome-photos`, {
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
