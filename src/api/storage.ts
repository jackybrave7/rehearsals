import type { AppState } from '../types';
import { API_BASE } from './apiBase';

async function parseSaveError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    if (data.error === 'WOULD_LOSE_USER_DATA') {
      return 'WOULD_LOSE_USER_DATA';
    }
    return data.message ?? data.error ?? `SAVE_STATE_${response.status}`;
  } catch {
    return `SAVE_STATE_${response.status}`;
  }
}

export async function fetchAppState(): Promise<AppState | null> {
  const response = await fetch(`${API_BASE}/state`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`FETCH_STATE_${response.status}`);
  }
  return response.json() as Promise<AppState>;
}

export async function saveAppState(
  state: AppState,
  options?: { keepalive?: boolean }
): Promise<void> {
  const response = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
    keepalive: options?.keepalive ?? false,
  });
  if (!response.ok) {
    throw new Error(await parseSaveError(response));
  }
}

export async function saveAppStateWithRetry(
  state: AppState,
  options?: { keepalive?: boolean; attempts?: number }
): Promise<void> {
  const attempts = options?.attempts ?? 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await saveAppState(state, options);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) return false;
    const data = (await response.json()) as { ok?: boolean; db?: string };
    return data.ok === true && typeof data.db === 'string' && data.db.length > 0;
  } catch {
    return false;
  }
}

export async function fetchLatestBackupState(): Promise<AppState | null> {
  try {
    const response = await fetch(`${API_BASE}/state/backups/latest`);
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return response.json() as Promise<AppState>;
  } catch {
    return null;
  }
}

export async function fetchBackupList(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/state/backups`);
    if (!response.ok) return [];
    const data = (await response.json()) as { files?: string[] };
    return data.files ?? [];
  } catch {
    return [];
  }
}

export async function restoreBackupState(filename: string): Promise<AppState> {
  const response = await fetch(`${API_BASE}/state/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  if (!response.ok) {
    throw new Error(`RESTORE_FAILED_${response.status}`);
  }
  return response.json() as Promise<AppState>;
}

export type SaveStatus = 'saved' | 'saving' | 'error';
