import type {
  BroadcastDetail,
  BroadcastFilters,
  BroadcastHistoryItem,
  BroadcastPreview,
  BroadcastScheduleResult,
  BroadcastSendResult,
} from '../types/admin';
import { API_BASE } from './apiBase';

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });
}

export const defaultBroadcastFilters = (): BroadcastFilters => ({
  subscriptionPlan: 'all',
  registrationStatus: 'approved',
  emailVerified: 'yes',
  hasTheater: 'all',
  isTheaterOwner: 'all',
  minActiveSessions: 0,
  excludePlatformAdmins: true,
});

export async function previewAdminBroadcast(filters: BroadcastFilters): Promise<BroadcastPreview> {
  const response = await adminFetch('/admin/broadcast/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters }),
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 400) throw new Error('INVALID_FILTERS');
  if (!response.ok) throw new Error(`BROADCAST_PREVIEW_${response.status}`);
  return response.json() as Promise<BroadcastPreview>;
}

export async function sendAdminBroadcast(payload: {
  filters: BroadcastFilters;
  subject: string;
  bodyText: string;
  confirm: true;
}): Promise<BroadcastSendResult> {
  const response = await adminFetch('/admin/broadcast/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 503) throw new Error('MAIL_NOT_CONFIGURED');
  if (response.status === 400) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (data.error === 'CONFIRM_REQUIRED') throw new Error('CONFIRM_REQUIRED');
    if (data.error === 'NO_RECIPIENTS') throw new Error('NO_RECIPIENTS');
    throw new Error('INVALID_BODY');
  }
  if (!response.ok) throw new Error('BROADCAST_SEND_FAILED');
  return response.json() as Promise<BroadcastSendResult>;
}

export async function scheduleAdminBroadcast(payload: {
  filters: BroadcastFilters;
  subject: string;
  bodyText: string;
  scheduledAt: string;
  confirm: true;
}): Promise<BroadcastScheduleResult> {
  const response = await adminFetch('/admin/broadcast/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 503) throw new Error('MAIL_NOT_CONFIGURED');
  if (response.status === 400) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (data.error === 'CONFIRM_REQUIRED') throw new Error('CONFIRM_REQUIRED');
    if (data.error === 'NO_RECIPIENTS') throw new Error('NO_RECIPIENTS');
    if (data.error === 'SCHEDULE_TOO_SOON') throw new Error('SCHEDULE_TOO_SOON');
    if (data.error === 'INVALID_SCHEDULE_TIME') throw new Error('INVALID_SCHEDULE_TIME');
    throw new Error('INVALID_BODY');
  }
  if (!response.ok) throw new Error('BROADCAST_SCHEDULE_FAILED');
  return response.json() as Promise<BroadcastScheduleResult>;
}

export async function cancelAdminBroadcast(broadcastId: string): Promise<void> {
  const response = await adminFetch(`/admin/broadcast/${broadcastId}/cancel`, {
    method: 'POST',
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new Error('BROADCAST_CANCEL_FAILED');
}

export async function fetchAdminBroadcastHistory(limit = 20): Promise<BroadcastHistoryItem[]> {
  const response = await adminFetch(`/admin/broadcast/history?limit=${limit}`);
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) throw new Error(`BROADCAST_HISTORY_${response.status}`);
  const data = (await response.json()) as { items?: BroadcastHistoryItem[] };
  return data.items ?? [];
}

export async function fetchAdminBroadcastDetail(broadcastId: string): Promise<BroadcastDetail> {
  const response = await adminFetch(`/admin/broadcast/${broadcastId}`);
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new Error(`BROADCAST_DETAIL_${response.status}`);
  return response.json() as Promise<BroadcastDetail>;
}
