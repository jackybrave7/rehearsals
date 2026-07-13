import type { PlatformSettings, RegistrationMode, RegistrationNotificationSettings } from '../types/admin';
import { API_BASE } from './apiBase';

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const response = await adminFetch('/admin/platform-settings');
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) throw new Error(`ADMIN_SETTINGS_${response.status}`);
  return response.json() as Promise<PlatformSettings>;
}

export async function updatePlatformSettings(payload: {
  registrationMode?: RegistrationMode;
  registrationNotifyEnabled?: boolean;
  registrationNotifyEmail?: string;
}): Promise<PlatformSettings> {
  const response = await adminFetch('/admin/platform-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`ADMIN_SETTINGS_${response.status}`);
  return response.json() as Promise<PlatformSettings>;
}

export type { RegistrationNotificationSettings };
