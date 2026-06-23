import type { AdminUserDetail, AdminUserSummary } from '../types/admin';
import { API_BASE } from './apiBase';

async function adminFetch(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: 'include' });
}

export async function fetchAdminUsers(): Promise<AdminUserSummary[]> {
  const response = await adminFetch('/admin/users');
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) throw new Error(`ADMIN_USERS_${response.status}`);
  const data = (await response.json()) as { users?: AdminUserSummary[] };
  return data.users ?? [];
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const response = await adminFetch(`/admin/users/${encodeURIComponent(userId)}`);
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new Error(`ADMIN_USER_${response.status}`);
  return response.json() as Promise<AdminUserDetail>;
}
