import { API_BASE } from './apiBase';

export interface UploadedFile {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
}

export function formatFileUploadError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'FILE_TOO_LARGE') return 'Файл слишком большой. Максимум — 5 МБ.';
  if (code === 'UNAUTHORIZED') return 'Сессия истекла — обновите страницу и войдите снова.';
  if (code === 'INVALID_BODY' || code === 'INVALID_BASE64') return 'Не удалось прочитать файл. Попробуйте другой формат.';
  if (code.startsWith('UPLOAD_')) return 'Не удалось загрузить файл на сервер. Попробуйте ещё раз.';
  return 'Не удалось загрузить файл. Проверьте формат и подключение.';
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const dataBase64 = await readFileBase64(file);
  const response = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 401) throw new Error('UNAUTHORIZED');
    if (data?.error === 'FILE_TOO_LARGE') throw new Error('FILE_TOO_LARGE');
    throw new Error(data?.error ?? `UPLOAD_${response.status}`);
  }

  return response.json() as Promise<UploadedFile>;
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
