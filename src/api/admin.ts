import type { PlatformStats } from '../types/admin';
import { API_BASE } from './apiBase';

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const response = await fetch(`${API_BASE}/admin/stats`, { credentials: 'include' });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) throw new Error(`ADMIN_STATS_${response.status}`);
  return response.json() as Promise<PlatformStats>;
}
