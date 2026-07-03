import type { AdminUserDetail, AdminUserSummary } from '../types/admin';
import { API_BASE } from './apiBase';

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });
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

export interface DeleteAdminUserResult {
  deletedUserId: string;
  deletedTheaterIds: string[];
  deletedFilesCount: number;
}

export async function updateAdminUserSubscription(
  userId: string,
  payload: {
    plan: 'free' | 'pro';
    proDuration?: 'unlimited' | '1m' | '3m' | '12m' | 'custom';
    proExpiresAt?: string;
  }
): Promise<{
  userId: string;
  plan: 'free' | 'pro';
  subscriptionPlanStored?: 'free' | 'pro';
  subscriptionProExpiresAt?: string | null;
  mailSent?: boolean | null;
}> {
  const response = await adminFetch(`/admin/users/${encodeURIComponent(userId)}/subscription`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (response.status === 400) throw new Error('UPDATE_SUBSCRIPTION_INVALID');
  if (!response.ok) throw new Error('UPDATE_SUBSCRIPTION_FAILED');
  return response.json() as Promise<{
    userId: string;
    plan: 'free' | 'pro';
    subscriptionPlanStored?: 'free' | 'pro';
    subscriptionProExpiresAt?: string | null;
    mailSent?: boolean | null;
  }>;
}

export async function deleteAdminUser(userId: string): Promise<DeleteAdminUserResult> {
  const response = await adminFetch(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (response.status === 400) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (data.error === 'CANNOT_DELETE_SELF') throw new Error('CANNOT_DELETE_SELF');
    throw new Error('DELETE_USER_BAD_REQUEST');
  }
  if (!response.ok) throw new Error('DELETE_USER_FAILED');
  return response.json() as Promise<DeleteAdminUserResult>;
}

export async function approveAdminUserRegistration(
  userId: string
): Promise<{ mailSent?: boolean | null; alreadyApproved?: boolean }> {
  const response = await adminFetch(`/admin/users/${encodeURIComponent(userId)}/approve-registration`, {
    method: 'POST',
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (response.status === 400) throw new Error('EMAIL_NOT_VERIFIED');
  if (!response.ok) throw new Error('APPROVE_REGISTRATION_FAILED');
  return response.json() as Promise<{ mailSent?: boolean | null; alreadyApproved?: boolean }>;
}

export async function resendAdminUserVerification(
  userId: string
): Promise<{ mailSent: boolean; verifyUrl: string | null; alreadyVerified?: boolean }> {
  const response = await adminFetch(`/admin/users/${encodeURIComponent(userId)}/resend-verification`, {
    method: 'POST',
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (response.status === 503) throw new Error('MAIL_NOT_CONFIGURED');
  if (!response.ok) throw new Error('RESEND_VERIFICATION_FAILED');
  return response.json() as Promise<{
    mailSent: boolean;
    verifyUrl: string | null;
    alreadyVerified?: boolean;
  }>;
}

export async function verifyAdminUserEmail(
  userId: string
): Promise<{ alreadyVerified?: boolean }> {
  const response = await adminFetch(`/admin/users/${encodeURIComponent(userId)}/verify-email`, {
    method: 'POST',
  });
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new Error('VERIFY_EMAIL_FAILED');
  return response.json() as Promise<{ alreadyVerified?: boolean }>;
}
