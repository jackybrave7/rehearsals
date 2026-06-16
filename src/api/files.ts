import { API_BASE } from './apiBase';

export interface UploadedFile {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
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
